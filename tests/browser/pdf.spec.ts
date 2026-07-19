import { expect, test } from "@playwright/test";
import {
  attachPdf,
  EXAMPLE_SITE_URL,
  generateA4Pdf,
  observePage,
  openResume,
  OVERLONG_URL,
  parsePdf,
  pdfSentinelKey,
  expectNoPageDiagnostics,
} from "./support";

function pageContaining(pageTexts: string[], sentinel: string): number {
  const key = pdfSentinelKey(sentinel);
  const page = pageTexts.findIndex((text) => pdfSentinelKey(text).includes(key));
  expect(page, `page containing ${sentinel}`).toBeGreaterThanOrEqual(0);
  return page;
}

test("PDF sentinel matching tolerates extractor-inserted whitespace only", () => {
  expect(pdfSentinelKey("MAXIMUM CONT ENT T OP")).toBe(
    pdfSentinelKey("MAXIMUM CONTENT TOP"),
  );
  expect(pdfSentinelKey("MAXIMUM CONT ENT POT")).not.toBe(
    pdfSentinelKey("MAXIMUM CONTENT TOP"),
  );
});

test("maximum-content fixture is one tagged, linked A4 page", async ({
  page,
}, testInfo) => {
  const diagnostics = observePage(page, new URL(testInfo.project.use.baseURL as string).origin);
  await openResume(page);
  await page.evaluate(() => {
    const source = document.querySelector<HTMLElement>(
      ".resume-action-item[data-pdf-action]",
    )!;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.className = "resume-contact-item";
    clone.dataset.testHeaderPdf = "true";
    clone.querySelector<HTMLElement>("a")!.className = "resume-link";
    document.querySelector(".resume-contact-list")!.append(clone);
  });
  await page.emulateMedia({ media: "print" });

  const printState = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".resume-main")!;
    const aside = document.querySelector<HTMLElement>(".resume-aside")!;
    const mainWidth = main.getBoundingClientRect().width;
    const asideWidth = aside.getBoundingClientRect().width;
    return {
      awardBreakInside: getComputedStyle(
        document.querySelector<HTMLElement>(".resume-awards-list li")!,
      ).breakInside,
      actionKinds: Array.from(
        document.querySelectorAll<HTMLElement>(".resume-action-link"),
      )
        .filter((element) => getComputedStyle(element).display !== "none")
        .map((element) => element.dataset.resumeKind),
      mainRatio: mainWidth / (mainWidth + asideWidth),
      headerPdfVisible:
        getComputedStyle(
          document.querySelector<HTMLElement>("[data-test-header-pdf]")!,
        ).display !== "none",
      tooltipsVisible: Array.from(
        document.querySelectorAll<HTMLElement>(".resume-action-tooltip"),
      ).some((element) => getComputedStyle(element).display !== "none"),
    };
  });
  expect(printState.awardBreakInside).toBe("avoid");
  expect(printState.mainRatio).toBeGreaterThanOrEqual(0.595);
  expect(printState.mainRatio).toBeLessThanOrEqual(0.605);
  expect(printState.headerPdfVisible).toBe(false);
  expect(printState.actionKinds).toEqual([
    "online-cv",
    "email",
    "linkedin",
    "github",
  ]);
  expect(printState.tooltipsVisible).toBe(false);

  const bytes = await generateA4Pdf(page);
  await attachPdf(testInfo, "maximum-content.pdf", bytes);
  const parsed = await parsePdf(bytes);

  expect(parsed.document.numPages).toBe(1);
  expect(parsed.pageTexts.every((text) => text.trim().length > 0)).toBe(true);
  for (const viewport of parsed.pageViewports) {
    expect(viewport.width).toBeCloseTo(595.28, 0);
    expect(viewport.height).toBeCloseTo(841.89, 0);
  }

  const allText = pdfSentinelKey(parsed.pageTexts.join(" "));
  const top = allText.indexOf(pdfSentinelKey("MAXIMUM CONTENT TOP"));
  const middle = allText.indexOf(pdfSentinelKey("MAXIMUM CONTENT MIDDLE"));
  const final = allText.indexOf(pdfSentinelKey("MAXIMUM CONTENT FINAL"));
  expect(top).toBeGreaterThanOrEqual(0);
  expect(middle).toBeGreaterThan(top);
  expect(final).toBeGreaterThan(middle);

  const urls = parsed.annotations.flatMap((annotation) =>
    annotation.url ? [annotation.url] : [],
  );
  expect(urls).toContain("https://resume.example.invalid/");
  expect(urls).toContain("https://avery.example.invalid/");
  expect(urls.some((url) => url.startsWith("mailto:avery@example.invalid"))).toBe(true);
  expect(urls.some((url) => url.includes("linkedin.example.invalid"))).toBe(true);
  expect(urls.some((url) => url.includes("github.example.invalid"))).toBe(true);
  expect(urls.some((url) => /resume\.pdf(?:$|[?#])/.test(url))).toBe(false);

  for (const annotation of parsed.annotations) {
    const viewport = parsed.pageViewports[annotation.page - 1];
    const [left, bottom, right, topEdge] = annotation.rect;
    expect(left).toBeGreaterThanOrEqual(-1);
    expect(bottom).toBeGreaterThanOrEqual(-1);
    expect(right).toBeLessThanOrEqual(viewport.width + 1);
    expect(topEdge).toBeLessThanOrEqual(viewport.height + 1);
  }

  for (const item of parsed.textBounds.filter((entry) => entry.str.trim())) {
    const viewport = parsed.pageViewports[item.page - 1];
    expect(item.x, item.str).toBeGreaterThanOrEqual(-2);
    expect(item.x + item.width, item.str).toBeLessThanOrEqual(viewport.width + 2);
    expect(item.y, item.str).toBeGreaterThanOrEqual(-2);
    expect(item.y + item.height, item.str).toBeLessThanOrEqual(viewport.height + 4);
  }

  expect(parsed.fonts.length).toBeGreaterThan(0);
  expect(parsed.fonts.every((font) => !font.missingFile)).toBe(true);
  expect(parsed.fonts.every((font) => /CVResumeSans/i.test(font.name))).toBe(true);
  expect(parsed.markInfo?.Marked).toBe(true);
  expect(parsed.outline?.length).toBeGreaterThan(0);
  expectNoPageDiagnostics(diagnostics);
  await parsed.document.cleanup();
});

test("exampleSite itself remains one linked A4 page", async ({ page }, testInfo) => {
  const diagnostics = observePage(page, new URL(EXAMPLE_SITE_URL).origin);
  await openResume(page, EXAMPLE_SITE_URL);
  await page.emulateMedia({ media: "print" });

  const bytes = await generateA4Pdf(page);
  await attachPdf(testInfo, "example-site.pdf", bytes);
  const parsed = await parsePdf(bytes);

  expect(parsed.document.numPages).toBe(1);
  expect(parsed.pageTexts).toHaveLength(1);
  expect(parsed.pageTexts[0].trim().length).toBeGreaterThan(0);
  expect(parsed.pageViewports[0].width).toBeCloseTo(595.28, 0);
  expect(parsed.pageViewports[0].height).toBeCloseTo(841.89, 0);

  const allText = pdfSentinelKey(parsed.pageTexts[0]);
  const top = allText.indexOf(pdfSentinelKey("YOUR_NAME"));
  const middle = allText.indexOf(pdfSentinelKey("YOUR_PROJECT_1"));
  const final = allText.indexOf(pdfSentinelKey("YOUR_AWARD_YEAR_2"));
  expect(top).toBeGreaterThanOrEqual(0);
  expect(middle).toBeGreaterThan(top);
  expect(final).toBeGreaterThan(middle);

  const urls = parsed.annotations.flatMap((annotation) =>
    annotation.url ? [annotation.url] : [],
  );
  expect(urls).toContain("https://resume.example.invalid/");
  expect(urls).toContain("https://portfolio.example.invalid/");
  expect(urls.some((url) => url.startsWith("mailto:your.name@example.invalid"))).toBe(
    true,
  );
  expect(urls.some((url) => url.includes("linkedin.example.invalid"))).toBe(true);
  expect(urls.some((url) => url.includes("github.example.invalid"))).toBe(true);
  expect(urls.some((url) => /resume\.pdf(?:$|[?#])/.test(url))).toBe(false);

  for (const annotation of parsed.annotations) {
    const viewport = parsed.pageViewports[annotation.page - 1];
    const [left, bottom, right, topEdge] = annotation.rect;
    expect(left).toBeGreaterThanOrEqual(-1);
    expect(bottom).toBeGreaterThanOrEqual(-1);
    expect(right).toBeLessThanOrEqual(viewport.width + 1);
    expect(topEdge).toBeLessThanOrEqual(viewport.height + 1);
  }

  for (const item of parsed.textBounds.filter((entry) => entry.str.trim())) {
    const viewport = parsed.pageViewports[item.page - 1];
    expect(item.x, item.str).toBeGreaterThanOrEqual(-2);
    expect(item.x + item.width, item.str).toBeLessThanOrEqual(viewport.width + 2);
    expect(item.y, item.str).toBeGreaterThanOrEqual(-2);
    expect(item.y + item.height, item.str).toBeLessThanOrEqual(viewport.height + 4);
  }

  expect(parsed.fonts.length).toBeGreaterThan(0);
  expect(parsed.fonts.every((font) => !font.missingFile)).toBe(true);
  expect(parsed.fonts.every((font) => /CVResumeSans/i.test(font.name))).toBe(true);
  expect(parsed.markInfo?.Marked).toBe(true);
  expect(parsed.outline?.length).toBeGreaterThan(0);
  expectNoPageDiagnostics(diagnostics);
  await parsed.document.cleanup();
});

test("overlong content paginates without clipping or a blank tail page", async ({
  page,
}, testInfo) => {
  const diagnostics = observePage(page, new URL(OVERLONG_URL).origin);
  await openResume(page, OVERLONG_URL);
  await page.emulateMedia({ media: "print" });
  const printState = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".resume-main")!;
    const aside = document.querySelector<HTMLElement>(".resume-aside")!;
    const mainWidth = main.getBoundingClientRect().width;
    const asideWidth = aside.getBoundingClientRect().width;
    return {
      actionKinds: Array.from(
        document.querySelectorAll<HTMLElement>(".resume-action-link"),
      )
        .filter((element) => getComputedStyle(element).display !== "none")
        .map((element) => element.dataset.resumeKind),
      mainRatio: mainWidth / (mainWidth + asideWidth),
    };
  });
  expect(printState.mainRatio).toBeGreaterThanOrEqual(0.595);
  expect(printState.mainRatio).toBeLessThanOrEqual(0.605);
  expect(printState.actionKinds).toEqual([
    "online-cv",
    "email",
    "linkedin",
    "github",
  ]);
  const domText = await page.locator("article").innerText();
  expect(domText.indexOf("OVERLONG DOCUMENT TAIL")).toBeGreaterThan(
    domText.indexOf("OVERLONG CONTENT FINAL"),
  );
  const bytes = await generateA4Pdf(page);
  await attachPdf(testInfo, "overlong.pdf", bytes);
  const parsed = await parsePdf(bytes);

  expect(parsed.document.numPages).toBeGreaterThanOrEqual(2);
  expect(parsed.pageTexts.every((text) => text.trim().length > 0)).toBe(true);
  for (const viewport of parsed.pageViewports) {
    expect(viewport.width).toBeCloseTo(595.28, 0);
    expect(viewport.height).toBeCloseTo(841.89, 0);
  }
  const allText = pdfSentinelKey(parsed.pageTexts.join(" "));
  const topPage = pageContaining(parsed.pageTexts, "OVERLONG CONTENT TOP");
  const middlePage = pageContaining(parsed.pageTexts, "OVERLONG CONTENT MIDDLE");
  const finalPage = pageContaining(parsed.pageTexts, "OVERLONG CONTENT FINAL");
  const splitStartPage = pageContaining(
    parsed.pageTexts,
    "OVERLONG SPLIT CONTROL START",
  );
  const splitEndPage = pageContaining(
    parsed.pageTexts,
    "OVERLONG SPLIT CONTROL END",
  );
  expect(
    allText.indexOf(pdfSentinelKey("OVERLONG CONTENT MIDDLE")),
  ).toBeGreaterThan(allText.indexOf(pdfSentinelKey("OVERLONG CONTENT TOP")));
  expect(
    allText.indexOf(pdfSentinelKey("OVERLONG CONTENT FINAL")),
  ).toBeGreaterThan(allText.indexOf(pdfSentinelKey("OVERLONG CONTENT MIDDLE")));
  expect(allText).toContain(pdfSentinelKey("OVERLONG DOCUMENT TAIL"));
  expect(topPage).toBe(0);
  expect(middlePage).toBeGreaterThanOrEqual(topPage);
  expect(finalPage).toBeGreaterThanOrEqual(middlePage);
  expect(splitStartPage).toBe(middlePage);
  expect(splitEndPage).toBe(splitStartPage);

  const urls = parsed.annotations.flatMap((annotation) =>
    annotation.url ? [annotation.url] : [],
  );
  expect(urls).toContain("https://overlong.example.invalid/");
  expect(urls).toContain("https://morgan.example.invalid/");
  expect(urls.some((url) => url.startsWith("mailto:morgan@example.invalid"))).toBe(
    true,
  );
  expect(urls.some((url) => url.includes("linkedin.example.invalid"))).toBe(true);
  expect(urls.some((url) => url.includes("github.example.invalid"))).toBe(true);

  for (const annotation of parsed.annotations) {
    const viewport = parsed.pageViewports[annotation.page - 1];
    const [left, bottom, right, topEdge] = annotation.rect;
    expect(left).toBeGreaterThanOrEqual(-1);
    expect(bottom).toBeGreaterThanOrEqual(-1);
    expect(right).toBeLessThanOrEqual(viewport.width + 1);
    expect(topEdge).toBeLessThanOrEqual(viewport.height + 1);
  }

  for (const item of parsed.textBounds.filter((entry) => entry.str.trim())) {
    const viewport = parsed.pageViewports[item.page - 1];
    expect(item.x, item.str).toBeGreaterThanOrEqual(-2);
    expect(item.x + item.width, item.str).toBeLessThanOrEqual(viewport.width + 2);
    expect(item.y, item.str).toBeGreaterThanOrEqual(-2);
    expect(item.y + item.height, item.str).toBeLessThanOrEqual(viewport.height + 4);
  }

  expect(parsed.fonts.length).toBeGreaterThan(0);
  expect(parsed.fonts.every((font) => !font.missingFile)).toBe(true);
  expect(parsed.fonts.every((font) => /CVResumeSans/i.test(font.name))).toBe(true);
  expect(parsed.markInfo?.Marked).toBe(true);
  expect(parsed.outline?.length).toBeGreaterThan(0);
  expectNoPageDiagnostics(diagnostics);
  await parsed.document.cleanup();
});
