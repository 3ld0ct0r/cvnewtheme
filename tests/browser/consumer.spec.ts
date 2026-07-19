import { expect, test } from "@playwright/test";
import {
  attachPdf,
  expectNoHorizontalOverflow,
  expectNoPageDiagnostics,
  expectOrderedIds,
  generateA4Pdf,
  observePage,
  openResume,
  parsePdf,
  pdfSentinelKey,
} from "./support";

test("consumer site satisfies the migrated screen and one-page print contract", async ({
  page,
}, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL as string).origin;
  const diagnostics = observePage(page, origin);
  await openResume(page);

  await expectOrderedIds(page, "address.resume-contact", [
    "online_cv",
    "website",
    "location",
  ]);
  await expectOrderedIds(page, "nav.resume-actions", [
    "online_cv",
    "email",
    "pdf",
    "linkedin",
    "github",
  ]);
  await expect(
    page.locator('nav.resume-actions a[data-resume-kind="pdf"]'),
  ).toHaveCount(1);
  await expect(page.locator("nav.resume-actions [target]")).toHaveCount(0);
  await expect(page.locator("nav.resume-actions i")).toHaveCount(0);
  await expect(
    page.locator('address.resume-contact [data-resume-link-id="online_cv"] a'),
  ).toHaveAttribute("href", "https://YOUR_SITE.example.invalid/");
  await expect(
    page.locator('address.resume-contact [data-resume-link-id="website"] a'),
  ).toHaveAttribute("href", "https://YOUR_SITE.example.invalid/");
  await expect(
    page.locator('nav.resume-actions [data-resume-link-id="email"] a'),
  ).toHaveAttribute("href", "mailto:YOUR_EMAIL@example.invalid");
  await expect(
    page.locator('nav.resume-actions [data-resume-link-id="pdf"] a'),
  ).toHaveAttribute("href", "/CVTest.pdf");
  await expect(
    page.locator('nav.resume-actions [data-resume-link-id="pdf"] a'),
  ).toHaveAttribute("download", "");
  await expect(
    page.locator('nav.resume-actions [data-resume-link-id="linkedin"] a'),
  ).toHaveAttribute("href", "https://YOUR_PROFILE.example.invalid/");
  await expect(
    page.locator('nav.resume-actions [data-resume-link-id="github"] a'),
  ).toHaveAttribute("href", "https://YOUR_CODE_PROFILE.example.invalid/");
  await expectNoHorizontalOverflow(page);

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
      tooltipsVisible: Array.from(
        document.querySelectorAll<HTMLElement>(".resume-action-tooltip"),
      ).some((element) => getComputedStyle(element).display !== "none"),
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
  expect(printState.tooltipsVisible).toBe(false);

  const bytes = await generateA4Pdf(page);
  await attachPdf(testInfo, "consumer.pdf", bytes);
  const parsed = await parsePdf(bytes);

  expect(parsed.document.numPages).toBe(1);
  expect(parsed.pageTexts).toHaveLength(1);
  expect(parsed.pageTexts[0].trim().length).toBeGreaterThan(0);
  for (const viewport of parsed.pageViewports) {
    expect(viewport.width).toBeCloseTo(595.28, 0);
    expect(viewport.height).toBeCloseTo(841.89, 0);
  }

  const allText = pdfSentinelKey(parsed.pageTexts.join(" "));
  const top = allText.indexOf(pdfSentinelKey("YOUR_NAME"));
  const middle = allText.indexOf(pdfSentinelKey("YOUR_PROJECT_2"));
  const final = allText.indexOf(pdfSentinelKey("YOUR_AWARD_YEAR_2"));
  expect(top).toBeGreaterThanOrEqual(0);
  expect(middle).toBeGreaterThan(top);
  expect(final).toBeGreaterThan(middle);

  const urls = parsed.annotations.flatMap((annotation) =>
    annotation.url ? [annotation.url.toLowerCase()] : [],
  );
  expect(urls).toContain("https://your_site.example.invalid/");
  expect(
    urls.filter((url) => url === "https://your_site.example.invalid/").length,
  ).toBeGreaterThanOrEqual(3);
  expect(urls).toContain("mailto:your_email@example.invalid");
  expect(urls).toContain("https://your_profile.example.invalid/");
  expect(urls).toContain("https://your_code_profile.example.invalid/");
  expect(urls.some((url) => /\.pdf(?:$|[?#])/.test(url))).toBe(false);

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
