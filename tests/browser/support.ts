import { expect, type Page, type TestInfo } from "@playwright/test";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

export const MAX_CONTENT_URL = "http://127.0.0.1:4173";
export const FONT_BASIC_URL = "http://127.0.0.1:4174";
export const OVERLONG_URL = "http://127.0.0.1:4175";
export const EXAMPLE_SITE_URL = "http://127.0.0.1:4177";

export const expectedHeaderIds = ["online_cv", "website", "location"];
export const expectedHeaderLabels: Record<string, string> = {
  online_cv: "Online CV — View online CV",
  website: "avery.example.invalid — Visit Avery Morgan's website",
};
export const expectedActionIds = [
  "online_cv",
  "email",
  "pdf",
  "linkedin",
  "github",
];

export const expectedActionLabels: Record<string, string> = {
  email: "Email Avery Morgan",
  github: "View GitHub profile",
  linkedin: "View LinkedIn profile",
  online_cv: "View online CV",
  pdf: "Download resume PDF",
};

type BrowserDiagnostics = {
  consoleErrors: string[];
  externalRequests: string[];
  failedRequests: string[];
  httpErrors: string[];
  pageErrors: string[];
};

export function observePage(page: Page, expectedOrigin: string): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = {
    consoleErrors: [],
    externalRequests: [],
    failedRequests: [],
    httpErrors: [],
    pageErrors: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith("http://") && !url.startsWith("https://")) return;
    if (new URL(url).origin !== expectedOrigin) diagnostics.externalRequests.push(url);
  });
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "unknown failure"}`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  return diagnostics;
}

export function expectNoPageDiagnostics(diagnostics: BrowserDiagnostics): void {
  expect(diagnostics.consoleErrors, "browser console errors").toEqual([]);
  expect(diagnostics.pageErrors, "uncaught page errors").toEqual([]);
  expect(diagnostics.failedRequests, "failed resource requests").toEqual([]);
  expect(diagnostics.httpErrors, "HTTP error responses").toEqual([]);
  expect(diagnostics.externalRequests, "cross-origin runtime requests").toEqual([]);
}

export async function openResume(page: Page, url = "/"): Promise<void> {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

export async function expectOrderedIds(
  page: Page,
  parentSelector: string,
  expected: string[],
): Promise<void> {
  const ids = await page
    .locator(`${parentSelector} [data-resume-link-id]`)
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-resume-link-id")),
    );
  expect(ids).toEqual(expected);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const measurements = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    client: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));

  expect(measurements.document).toBeLessThanOrEqual(measurements.client + 1);
  expect(measurements.body).toBeLessThanOrEqual(measurements.viewport + 1);
}

export async function expectVisibleContentWithinHorizontalViewport(
  page: Page,
): Promise<void> {
  const clipped = await page
    .locator(
      "article :is(h1, h2, h3, h4, p, li, address, nav, a, span, svg)",
    )
    .evaluateAll((elements) => {
      const viewportWidth = document.documentElement.clientWidth;
      return elements.flatMap((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          rect.width <= 0 ||
          rect.height <= 0
        ) {
          return [];
        }
        if (rect.left >= -1 && rect.right <= viewportWidth + 1) return [];
        return [
          `${element.tagName.toLowerCase()}.${element.className || "(no-class)"}: ` +
            `${rect.left.toFixed(2)}..${rect.right.toFixed(2)} of ${viewportWidth}`,
        ];
      });
    });
  expect(clipped, "visible content clipped by the horizontal viewport").toEqual([]);
}

export async function expectElementsDoNotOverlap(
  page: Page,
  selector: string,
): Promise<void> {
  const overlaps = await page.locator(selector).evaluateAll((elements) => {
    const visible = elements
      .map((element) => ({
        id:
          element.getAttribute("data-resume-link-id") ??
          element.textContent?.trim() ??
          element.tagName,
        rect: element.getBoundingClientRect(),
        style: getComputedStyle(element),
      }))
      .filter(
        ({ rect, style }) =>
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0,
      );
    const collisions: string[] = [];

    for (let left = 0; left < visible.length; left += 1) {
      for (let right = left + 1; right < visible.length; right += 1) {
        const a = visible[left];
        const b = visible[right];
        const intersects =
          a.rect.left < b.rect.right - 0.5 &&
          a.rect.right > b.rect.left + 0.5 &&
          a.rect.top < b.rect.bottom - 0.5 &&
          a.rect.bottom > b.rect.top + 0.5;
        if (intersects) collisions.push(`${a.id} overlaps ${b.id}`);
      }
    }
    return collisions;
  });

  expect(overlaps).toEqual([]);
}

export async function fontResourceURLs(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => /\.woff2(?:$|[?#])/.test(url)),
  );
}

export async function iconResourceURLs(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) =>
        /(?:address-card|file-pdf|linkedin-in|location-dot|fontawesome|icons\.json|\/(?:at|github|globe|phone)\.svg)(?:$|[?#])/i.test(
          url,
        ),
      ),
  );
}

export type ParsedPdf = {
  annotations: Array<{ page: number; rect: number[]; url?: string }>;
  document: PDFDocumentProxy;
  fonts: Array<{ missingFile: boolean; name: string }>;
  markInfo: { Marked?: boolean } | null;
  outline: Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>;
  pageTexts: string[];
  pageViewports: Array<{ height: number; width: number }>;
  textBounds: Array<{
    height: number;
    page: number;
    str: string;
    width: number;
    x: number;
    y: number;
  }>;
};

// PDF.js derives word breaks from positioned glyphs, so Chromium builds can
// insert whitespace inside a word. Keep every non-whitespace character strict.
export function pdfSentinelKey(value: string): string {
  return value.replace(/\s+/gu, "");
}

export async function parsePdf(bytes: Uint8Array): Promise<ParsedPdf> {
  const loadingTask = getDocument({ data: bytes, disableWorker: true });
  const document = await loadingTask.promise;
  const markInfo = await document.getMarkInfo();
  const outline = await document.getOutline();
  const annotations: ParsedPdf["annotations"] = [];
  const fonts: ParsedPdf["fonts"] = [];
  const pageTexts: string[] = [];
  const pageViewports: ParsedPdf["pageViewports"] = [];
  const textBounds: ParsedPdf["textBounds"] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    await page.getOperatorList();
    const pageAnnotations = await page.getAnnotations({ intent: "display" });

    pageViewports.push({ height: viewport.height, width: viewport.width });

    for (const fontKey of Object.keys(content.styles)) {
      const font = page.commonObjs.get(fontKey) as {
        missingFile?: boolean;
        name?: string;
      };
      const entry = {
        missingFile: font.missingFile ?? true,
        name: font.name ?? "",
      };
      if (
        !fonts.some(
          (existing) =>
            existing.name === entry.name &&
            existing.missingFile === entry.missingFile,
        )
      ) {
        fonts.push(entry);
      }
    }
    pageTexts.push(
      content.items
        .filter((item): item is typeof item & { str: string } => "str" in item)
        .map((item) => item.str)
        .join(" "),
    );

    for (const item of content.items) {
      if (!("str" in item)) continue;
      textBounds.push({
        height: item.height,
        page: pageNumber,
        str: item.str,
        width: item.width,
        x: item.transform[4],
        y: item.transform[5],
      });
    }

    for (const annotation of pageAnnotations) {
      if (annotation.subtype !== "Link") continue;
      annotations.push({
        page: pageNumber,
        rect: annotation.rect,
        url: annotation.url,
      });
    }
  }

  return {
    annotations,
    document,
    fonts,
    markInfo,
    outline,
    pageTexts,
    pageViewports,
    textBounds,
  };
}

export async function attachPdf(
  testInfo: TestInfo,
  name: string,
  bytes: Uint8Array,
): Promise<void> {
  await testInfo.attach(name, {
    body: Buffer.from(bytes),
    contentType: "application/pdf",
  });
}

export async function generateA4Pdf(page: Page): Promise<Uint8Array> {
  const bytes = await page.pdf({
    displayHeaderFooter: false,
    format: "A4",
    outline: true,
    preferCSSPageSize: true,
    printBackground: true,
    tagged: true,
  });
  return new Uint8Array(bytes);
}
