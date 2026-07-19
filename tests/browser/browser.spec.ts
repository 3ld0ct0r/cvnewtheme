import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  expectedActionIds,
  expectedActionLabels,
  expectedHeaderIds,
  expectedHeaderLabels,
  expectElementsDoNotOverlap,
  expectNoHorizontalOverflow,
  expectNoPageDiagnostics,
  expectOrderedIds,
  expectVisibleContentWithinHorizontalViewport,
  FONT_BASIC_URL,
  fontResourceURLs,
  iconResourceURLs,
  observePage,
  openResume,
} from "./support";

const subpixelTolerance = 0.001;

test("the resume is responsive, accessible, local, and keyboard operable", async ({
  browserName,
  page,
}, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL as string).origin;
  const diagnostics = observePage(page, origin);
  await openResume(page);

  await expect(page.locator("h1.resume-name")).toHaveCount(1);
  await expect(page.locator("h1.resume-name")).toHaveText("MAXIMUM CONTENT TOP");
  const headingLevels = await page
    .locator("article :is(h1, h2, h3, h4, h5, h6)")
    .evaluateAll((headings) =>
      headings.map((heading) => Number.parseInt(heading.tagName.slice(1), 10)),
    );
  expect(headingLevels[0]).toBe(1);
  for (let index = 1; index < headingLevels.length; index += 1) {
    expect(
      headingLevels[index] - headingLevels[index - 1],
      `heading level ${headingLevels[index - 1]} to ${headingLevels[index]}`,
    ).toBeLessThanOrEqual(1);
  }

  await expect(page.locator('address.resume-contact[aria-label="Contact information"]')).toBeVisible();
  await expect(page.locator('nav.resume-actions[aria-label="Resume actions"]')).toBeVisible();
  await expectOrderedIds(page, "address.resume-contact", expectedHeaderIds);
  await expectOrderedIds(page, "nav.resume-actions", expectedActionIds);
  await expect(
    page.locator(
      '.resume-contact-item[data-resume-link-id="location"] .visually-hidden',
    ),
  ).toHaveText("Location: Bengaluru, India");

  for (const [id, label] of Object.entries(expectedHeaderLabels)) {
    await expect(
      page.locator(
        `.resume-contact-item[data-resume-link-id="${id}"] > a.resume-link`,
      ),
    ).toHaveAccessibleName(label);
  }

  const headerPdf = page.locator(
    '.resume-contact-item[data-resume-link-id="pdf"] > a.resume-contact-download',
  );
  await expect(headerPdf).toHaveText("Download PDF");
  await expect(headerPdf).toHaveAttribute("href", "/resume.pdf");
  await expect(headerPdf).toHaveAttribute("download", "");
  await expect(headerPdf.locator("svg.resume-contact-icon")).toHaveCount(1);
  await expect(
    page.locator(
      '.resume-contact-item[data-resume-link-id="email"] svg.resume-contact-icon',
    ),
  ).toHaveCount(0);
  await expect(
    page.locator(
      '.resume-contact-item[data-resume-link-id="location"] svg.resume-contact-icon',
    ),
  ).toHaveCount(1);
  await expect(page.locator("address.resume-contact svg.resume-contact-icon")).toHaveCount(2);
  await expect(
    page.locator(
      'address.resume-contact svg.resume-contact-icon:not([aria-hidden="true"])',
    ),
  ).toHaveCount(0);
  await expect(
    page.locator(
      'address.resume-contact svg.resume-contact-icon:not([focusable="false"])',
    ),
  ).toHaveCount(0);
  await expect(
    page.locator(
      "address.resume-contact svg.resume-contact-icon[role], address.resume-contact svg.resume-contact-icon title",
    ),
  ).toHaveCount(0);
  const headerPdfBox = await headerPdf.boundingBox();
  expect(headerPdfBox).not.toBeNull();
  expect(headerPdfBox!.height + subpixelTolerance).toBeGreaterThanOrEqual(40);
  await expect(headerPdf).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(headerPdf.locator("svg.resume-contact-icon")).toHaveCSS(
    "color",
    "rgb(111, 132, 152)",
  );
  await headerPdf.hover();
  await expect(headerPdf).toHaveCSS("background-color", "rgba(0, 102, 174, 0.08)");
  await expect(headerPdf).toHaveCSS("color", "rgb(0, 102, 174)");
  await expect(headerPdf.locator("svg.resume-contact-icon")).toHaveCSS(
    "color",
    "rgb(0, 102, 174)",
  );
  await page.mouse.move(0, 0);

  const originalContactText = await page.evaluate(() => {
    const selectors = [
      '.resume-contact-item[data-resume-link-id="pdf"] .resume-contact-text',
      '.resume-contact-item[data-resume-link-id="email"] .resume-contact-text',
      '.resume-contact-item[data-resume-link-id="location"] .resume-location-text',
    ];
    return selectors.map((selector, index) => {
      const element = document.querySelector<HTMLElement>(selector)!;
      const text = element.textContent ?? "";
      element.textContent = `${"internationalizedcontactvalue".repeat(12)}${index}`;
      return { selector, text };
    });
  });
  await expectNoHorizontalOverflow(page);
  await expectVisibleContentWithinHorizontalViewport(page);
  await page.evaluate((entries) => {
    for (const { selector, text } of entries) {
      document.querySelector<HTMLElement>(selector)!.textContent = text;
    }
  }, originalContactText);

  const actionLinks = page.locator("a.resume-action-link[data-resume-kind]");
  await expect(actionLinks).toHaveCount(expectedActionIds.length);
  await expect(page.locator("nav.resume-actions i")).toHaveCount(0);
  await expect(page.locator("nav.resume-actions svg.resume-icon")).toHaveCount(
    expectedActionIds.length,
  );
  await expect(
    page.locator('nav.resume-actions svg.resume-icon:not([aria-hidden="true"])'),
  ).toHaveCount(0);
  await expect(
    page.locator('nav.resume-actions svg.resume-icon:not([focusable="false"])'),
  ).toHaveCount(0);
  await expect(page.locator("nav.resume-actions [target]")).toHaveCount(0);
  await expect(page.locator("nav.resume-actions img, nav.resume-actions use")).toHaveCount(0);
  expect(await iconResourceURLs(page)).toEqual([]);

  for (const id of expectedActionIds) {
    const action = page.locator(
      `.resume-action-item[data-resume-link-id="${id}"] > a.resume-action-link`,
    );
    await expect(action).toHaveAccessibleName(expectedActionLabels[id]);
    const box = await action.boundingBox();
    expect(box, `${id} must have a layout box`).not.toBeNull();
    expect(box!.width + subpixelTolerance, `${id} target width`).toBeGreaterThanOrEqual(40);
    expect(box!.height + subpixelTolerance, `${id} target height`).toBeGreaterThanOrEqual(40);
  }
  const actionLayout = await page.locator(".resume-actions-list").evaluate((list) => {
    const link = list.querySelector<HTMLElement>(".resume-action-link")!;
    const icon = link.querySelector<SVGElement>(".resume-action-icon")!;
    const linkStyle = getComputedStyle(link);
    return {
      backgroundColor: linkStyle.backgroundColor,
      borderRadius: Number.parseFloat(linkStyle.borderRadius),
      gap: Number.parseFloat(getComputedStyle(list).gap),
      iconHeight: icon.getBoundingClientRect().height,
      iconWidth: icon.getBoundingClientRect().width,
    };
  });
  expect(actionLayout.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(actionLayout.borderRadius).toBe(8);
  expect(actionLayout.gap).toBe(6);
  expect(actionLayout.iconHeight).toBeCloseTo(17.6, 1);
  expect(actionLayout.iconWidth).toBeCloseTo(17.6, 1);

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  const keyboardOrder: string[] = [];
  let advanceFocusKey = "Tab";
  for (let index = 0; index < 2 + expectedActionIds.length; index += 1) {
    await page.keyboard.press(advanceFocusKey);
    let focusedItem = await page.evaluate(() => {
        const focused = document.activeElement;
        if (!(focused instanceof HTMLElement)) return "missing";
        const item = focused.closest<HTMLElement>("[data-resume-link-id]");
        const surface = focused.closest("address.resume-contact")
          ? "header"
          : focused.closest("nav.resume-actions")
            ? "actions"
            : "other";
        return `${surface}:${item?.dataset.resumeLinkId ?? "missing"}`;
      });
    if (index === 0 && browserName === "webkit" && focusedItem === "other:missing") {
      advanceFocusKey = "Alt+Tab";
      await page.keyboard.press(advanceFocusKey);
      focusedItem = await page.evaluate(() => {
        const focused = document.activeElement;
        if (!(focused instanceof HTMLElement)) return "missing";
        const item = focused.closest<HTMLElement>("[data-resume-link-id]");
        const surface = focused.closest("address.resume-contact")
          ? "header"
          : focused.closest("nav.resume-actions")
            ? "actions"
            : "other";
        return `${surface}:${item?.dataset.resumeLinkId ?? "missing"}`;
      });
    }
    if (index === 0) {
      expect(focusedItem).toBe("header:pdf");
      await expect(headerPdf).toBeFocused();
      await expect(headerPdf).toHaveCSS(
        "background-color",
        "rgba(0, 102, 174, 0.08)",
      );
      const headerFocusStyle = await headerPdf.evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return {
          backgroundColor: style.backgroundColor,
          borderRadius: Number.parseFloat(style.borderRadius),
          bottom: box.bottom,
          outlineColor: style.outlineColor,
          outlineOffset: Number.parseFloat(style.outlineOffset),
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth),
          left: box.left,
          right: box.right,
          top: box.top,
        };
      });
      expect(headerFocusStyle.backgroundColor).toBe("rgba(0, 102, 174, 0.08)");
      expect(headerFocusStyle.borderRadius).toBe(8);
      expect(headerFocusStyle.outlineColor).toBe("rgb(0, 102, 174)");
      expect(headerFocusStyle.outlineStyle).not.toBe("none");
      expect(headerFocusStyle.outlineWidth).toBe(2);
      expect(headerFocusStyle.outlineOffset).toBe(2);
      expect(
        headerFocusStyle.left -
          headerFocusStyle.outlineWidth -
          headerFocusStyle.outlineOffset,
      ).toBeGreaterThanOrEqual(0);
      expect(
        headerFocusStyle.right +
          headerFocusStyle.outlineWidth +
          headerFocusStyle.outlineOffset,
      ).toBeLessThanOrEqual(page.viewportSize()!.width);
      expect(
        headerFocusStyle.top -
          headerFocusStyle.outlineWidth -
          headerFocusStyle.outlineOffset,
      ).toBeGreaterThanOrEqual(0);
      expect(
        headerFocusStyle.bottom +
          headerFocusStyle.outlineWidth +
          headerFocusStyle.outlineOffset,
      ).toBeLessThanOrEqual(page.viewportSize()!.height);
    }
    keyboardOrder.push(focusedItem);
  }
  expect(keyboardOrder).toEqual([
    "header:pdf",
    "header:email",
    ...expectedActionIds.map((id) => `actions:${id}`),
  ]);

  await expectNoHorizontalOverflow(page);
  await expectVisibleContentWithinHorizontalViewport(page);
  await expectElementsDoNotOverlap(page, ".resume-contact-item");
  await expectElementsDoNotOverlap(page, ".resume-action-item");
  await expectElementsDoNotOverlap(
    page,
    ".work-section .experience-heading .item-title > *",
  );

  const emptySemanticContainers = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        "address.resume-contact, nav.resume-actions, .resume-contact-list, .resume-actions-list",
      ),
    )
      .filter((element) => element.children.length === 0)
      .map((element) => element.outerHTML),
  );
  expect(emptySemanticContainers).toEqual([]);
  const emptyFooters = await page.locator("footer").evaluateAll((footers) =>
    footers.filter((footer) => !footer.textContent?.trim()).length,
  );
  expect(emptyFooters).toBe(0);

  const viewport = page.viewportSize()!;
  const width = viewport.width;
  const headerColumns = await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>(".resume-header-row")!;
    const title = document.querySelector<HTMLElement>(".resume-title")!;
    const contact = document.querySelector<HTMLElement>(".resume-contact")!;
    const rowBox = row.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    const contactBox = contact.getBoundingClientRect();
    return {
      contactLeft: contactBox.left,
      contactRatio: contactBox.width / rowBox.width,
      contactRight: contactBox.right,
      rowRight: rowBox.right,
      titleRatio: titleBox.width / rowBox.width,
      titleRight: titleBox.right,
    };
  });
  if (width >= 992) {
    expect(headerColumns.titleRatio).toBeCloseTo(0.54, 2);
    expect(headerColumns.contactRatio).toBeCloseTo(0.46, 2);
    expect(headerColumns.contactLeft).toBeGreaterThanOrEqual(
      headerColumns.titleRight - 1,
    );
    expect(headerColumns.contactRight).toBeLessThanOrEqual(
      headerColumns.rowRight + 1,
    );
  }
  const columns = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".resume-main");
    const aside = document.querySelector<HTMLElement>(".resume-aside");
    const row = document.querySelector<HTMLElement>(".resume-body-row");
    if (!main || !aside || !row) return null;
    const mainBox = main.getBoundingClientRect();
    const asideBox = aside.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    return {
      asideRatio: asideBox.width / rowBox.width,
      asideTop: asideBox.top,
      mainRatio: mainBox.width / rowBox.width,
      mainTop: mainBox.top,
    };
  });
  expect(columns).not.toBeNull();
  if (width >= 992) {
    expect(columns!.mainRatio).toBeGreaterThanOrEqual(0.595);
    expect(columns!.mainRatio).toBeLessThanOrEqual(0.605);
    expect(Math.abs(columns!.mainTop - columns!.asideTop)).toBeLessThanOrEqual(1);
  } else {
    expect(columns!.mainRatio).toBeGreaterThanOrEqual(0.99);
    expect(columns!.asideRatio).toBeGreaterThanOrEqual(0.99);
    expect(columns!.asideTop).toBeGreaterThan(columns!.mainTop);
  }

  for (const id of expectedActionIds) {
    const action = page.locator(
      `.resume-action-item[data-resume-link-id="${id}"] > a.resume-action-link`,
    );
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await action.focus();
    await expect(action).toBeFocused();
    await action.evaluate((element) => {
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      element.scrollIntoView({ block: "center", inline: "nearest" });
      root.style.scrollBehavior = previousScrollBehavior;
    });
    await expect(action).toHaveCSS(
      "background-color",
      "rgba(0, 102, 174, 0.08)",
    );
    await expect(action).toHaveCSS("color", "rgb(0, 102, 174)");
    await expect
      .poll(async () => {
        const box = await action.boundingBox();
        return (
          box !== null &&
          box.y >= 4 &&
          box.y + box.height <= viewport.height - 4
        );
      })
      .toBe(true);
    const focusStyle = await action.evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        backgroundColor: style.backgroundColor,
        bottom: box.bottom,
        color: style.color,
        left: box.left,
        outlineColor: style.outlineColor,
        outlineOffset: Number.parseFloat(style.outlineOffset),
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        right: box.right,
        top: box.top,
      };
    });
    expect(focusStyle.backgroundColor).toBe("rgba(0, 102, 174, 0.08)");
    expect(focusStyle.color).toBe("rgb(0, 102, 174)");
    expect(focusStyle.outlineColor).toBe("rgb(0, 102, 174)");
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(focusStyle.outlineWidth).toBe(2);
    expect(focusStyle.outlineOffset).toBe(2);
    expect(
      focusStyle.left - focusStyle.outlineWidth - focusStyle.outlineOffset,
    ).toBeGreaterThanOrEqual(0);
    expect(
      focusStyle.right + focusStyle.outlineWidth + focusStyle.outlineOffset,
    ).toBeLessThanOrEqual(viewport.width);
    expect(
      focusStyle.top - focusStyle.outlineWidth - focusStyle.outlineOffset,
    ).toBeGreaterThanOrEqual(0);
    expect(
      focusStyle.bottom + focusStyle.outlineWidth + focusStyle.outlineOffset,
    ).toBeLessThanOrEqual(viewport.height);
    const tooltip = action.locator('.resume-action-tooltip[aria-hidden="true"]');
    await expect(tooltip).toBeVisible();
    const tooltipBox = await tooltip.boundingBox();
    expect(tooltipBox).not.toBeNull();
    expect(tooltipBox!.x).toBeGreaterThanOrEqual(0);
    expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(viewport.width);
    expect(tooltipBox!.y).toBeGreaterThanOrEqual(0);
    expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(viewport.height);
  }

  for (const action of [actionLinks.first(), actionLinks.last()]) {
    await action.hover();
    const tooltip = action.locator('.resume-action-tooltip[aria-hidden="true"]');
    await expect(tooltip).toBeVisible();
    await expect(action).toHaveCSS("color", "rgb(0, 102, 174)");
    await expect(action).toHaveCSS("background-color", "rgba(0, 102, 174, 0.08)");
    const tooltipBox = await tooltip.boundingBox();
    expect(tooltipBox).not.toBeNull();
    expect(tooltipBox!.x).toBeGreaterThanOrEqual(0);
    expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(viewport.width);
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionHeader = await headerPdf.evaluate((element) => ({
    icon: getComputedStyle(
      element.querySelector<SVGElement>(".resume-contact-icon")!,
    ).transitionDuration,
    link: getComputedStyle(element).transitionDuration,
  }));
  expect(Number.parseFloat(reducedMotionHeader.link)).toBeLessThanOrEqual(0.01);
  expect(Number.parseFloat(reducedMotionHeader.icon)).toBeLessThanOrEqual(0.01);
  const reducedMotionStyles = await actionLinks.first().evaluate((element) => {
    const tooltip = element.querySelector<HTMLElement>(".resume-action-tooltip")!;
    const durations = (value: string) =>
      value.split(",").map((part) => {
        const trimmed = part.trim();
        const valueAsNumber = Number.parseFloat(trimmed);
        return trimmed.endsWith("ms") ? valueAsNumber / 1_000 : valueAsNumber;
      });
    return {
      action: durations(getComputedStyle(element).transitionDuration),
      tooltip: durations(getComputedStyle(tooltip).transitionDuration),
    };
  });
  expect(Math.max(...reducedMotionStyles.action)).toBeLessThanOrEqual(0.01);
  expect(Math.max(...reducedMotionStyles.tooltip)).toBeLessThanOrEqual(0.01);

  if (browserName === "chromium") {
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await headerPdf.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(headerPdf).toBeFocused();
    const forcedColorHeader = await headerPdf.evaluate((element) => {
      const icon = element.querySelector<SVGElement>(".resume-contact-icon")!;
      const style = getComputedStyle(element);
      return {
        color: style.color,
        iconColor: getComputedStyle(icon).color,
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(forcedColorHeader.outlineStyle).not.toBe("none");
    expect(forcedColorHeader.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(forcedColorHeader.color).not.toBe("rgba(0, 0, 0, 0)");
    expect(forcedColorHeader.iconColor).not.toBe("rgba(0, 0, 0, 0)");
    const forcedColorAction = actionLinks.first();
    await forcedColorAction.focus();
    await expect(forcedColorAction).toBeFocused();
    await expect(forcedColorAction).toHaveAccessibleName(
      expectedActionLabels.online_cv,
    );
    const forcedColorStyle = await forcedColorAction.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(forcedColorStyle.outlineStyle).not.toBe("none");
    expect(forcedColorStyle.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(forcedColorStyle.color).not.toBe("rgba(0, 0, 0, 0)");
  }
  await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });

  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.waitForTimeout(200);

  const fontChecks = await page.evaluate(() => {
    const role = getComputedStyle(document.querySelector(".role-name")!);
    const roleDate = getComputedStyle(document.querySelector(".role-dates")!);
    const roleLocation = getComputedStyle(document.querySelector(".role-location")!);
    const sidebarMetadata = getComputedStyle(
      document.querySelector(".resume-degree-time.resume-metadata")!,
    );
    return {
      bodyColor: getComputedStyle(document.body).color,
      bodyFamily: getComputedStyle(document.body).fontFamily,
      bodyWeight: getComputedStyle(document.body).fontWeight,
      headerLinkColor: getComputedStyle(
        document.querySelector(".resume-contact a.resume-link")!,
      ).color,
      contactWeight: getComputedStyle(
        document.querySelector(".resume-contact")!,
      ).fontWeight,
      headingWeight: getComputedStyle(
        document.querySelector(".resume-section-heading")!,
      ).fontWeight,
      nameWeight: getComputedStyle(document.querySelector(".resume-name")!).fontWeight,
      actionIconColor: getComputedStyle(
        document.querySelector(".resume-action-link")!,
      ).color,
      normal400: document.fonts.check('400 13px "CV Resume Sans"'),
      normal500: document.fonts.check('500 13px "CV Resume Sans"'),
      normal700: document.fonts.check('700 13px "CV Resume Sans"'),
      normal800: document.fonts.check('800 13px "CV Resume Sans"'),
      roleDateNumeric: roleDate.fontVariantNumeric,
      roleDateColor: roleDate.color,
      roleDateSize: Number.parseFloat(roleDate.fontSize),
      roleDateWeight: roleDate.fontWeight,
      roleLocationSize: Number.parseFloat(roleLocation.fontSize),
      roleWeight: role.fontWeight,
      roleSize: Number.parseFloat(role.fontSize),
      companySize: Number.parseFloat(
        getComputedStyle(document.querySelector(".company-name")!).fontSize,
      ),
      summaryColor: getComputedStyle(document.querySelector(".summary-line")!).color,
      bulletColor: getComputedStyle(
        document.querySelector(".work-section .resume-list li")!,
      ).color,
      sidebarMetadataNumeric: sidebarMetadata.fontVariantNumeric,
      sidebarMetadataColor: sidebarMetadata.color,
      sidebarMetadataStretch: Number.parseFloat(sidebarMetadata.fontStretch),
      sidebarMetadataWeight: sidebarMetadata.fontWeight,
    };
  });
  expect(fontChecks.bodyColor).toBe("rgb(31, 35, 40)");
  expect(fontChecks.summaryColor).toBe("rgb(31, 35, 40)");
  expect(fontChecks.bulletColor).toBe("rgb(31, 35, 40)");
  expect(fontChecks.headerLinkColor).toBe("rgb(0, 102, 174)");
  expect(fontChecks.actionIconColor).toBe("rgb(111, 132, 152)");
  expect(fontChecks.bodyFamily).toContain("CV Resume Sans");
  expect(fontChecks.bodyWeight).toBe("400");
  expect(fontChecks.contactWeight).toBe("500");
  expect(fontChecks.headingWeight).toBe("700");
  expect(fontChecks.nameWeight).toBe("800");
  expect(fontChecks.roleWeight).toBe("600");
  expect(fontChecks.roleSize + subpixelTolerance).toBeGreaterThanOrEqual(13.2);
  expect(fontChecks.companySize + subpixelTolerance).toBeGreaterThanOrEqual(13.2);
  expect(fontChecks.roleDateWeight).toBe("500");
  expect(fontChecks.roleDateColor).toBe("rgb(91, 113, 134)");
  expect(fontChecks.roleDateNumeric).toContain("lining-nums");
  expect(fontChecks.roleDateNumeric).toContain("tabular-nums");
  expect(fontChecks.roleDateSize + subpixelTolerance).toBeGreaterThanOrEqual(12);
  expect(fontChecks.roleLocationSize + subpixelTolerance).toBeGreaterThanOrEqual(12);
  expect(fontChecks.sidebarMetadataWeight).toBe("500");
  expect(fontChecks.sidebarMetadataColor).toBe("rgb(91, 113, 134)");
  expect(fontChecks.sidebarMetadataStretch).toBeGreaterThanOrEqual(95);
  expect(fontChecks.sidebarMetadataStretch).toBeLessThanOrEqual(97.5);
  expect(fontChecks.sidebarMetadataNumeric).toContain("lining-nums");
  expect(fontChecks.sidebarMetadataNumeric).toContain("tabular-nums");
  expect(fontChecks.normal400).toBe(true);
  expect(fontChecks.normal500).toBe(true);
  expect(fontChecks.normal700).toBe(true);
  expect(fontChecks.normal800).toBe(true);

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  const labelInName = await new AxeBuilder({ page })
    .options({
      rules: { "label-content-name-mismatch": { enabled: true } },
      runOnly: {
        type: "rule",
        values: ["label-content-name-mismatch"],
      },
    })
    .analyze();
  expect(labelInName.violations).toEqual([]);
  expectNoPageDiagnostics(diagnostics);
});

test("font subsets load on demand", async ({ browserName, page }, testInfo) => {
  test.skip(
    browserName !== "chromium" || testInfo.project.name !== "chromium-1440x1200",
    "One fresh Chromium context is sufficient for deterministic font request accounting.",
  );

  const basicDiagnostics = observePage(page, new URL(FONT_BASIC_URL).origin);
  await openResume(page, FONT_BASIC_URL);
  const basicFonts = await fontResourceURLs(page);
  expect(basicFonts).toHaveLength(1);
  expect(basicFonts[0]).toMatch(/latin-normal.*\.woff2(?:$|[?#])/);
  expectNoPageDiagnostics(basicDiagnostics);

  const extendedPage = await page.context().newPage();
  const extendedDiagnostics = observePage(
    extendedPage,
    new URL(testInfo.project.use.baseURL as string).origin,
  );
  await openResume(extendedPage, testInfo.project.use.baseURL as string);
  const extendedFonts = await fontResourceURLs(extendedPage);
  expect(extendedFonts.some((url) => /latin-normal/.test(url))).toBe(true);
  expect(extendedFonts.some((url) => /latin-ext-normal/.test(url))).toBe(true);
  expect(extendedFonts.some((url) => /latin-italic/.test(url))).toBe(true);
  expect(extendedFonts.some((url) => /latin-ext-italic/.test(url))).toBe(true);
  expect(
    await extendedPage.evaluate(() =>
      document.fonts.check(
        'italic 500 13px "CV Resume Sans"',
        "Łódź Český Krumlov",
      ),
    ),
  ).toBe(true);
  const loadedFaces = await extendedPage.evaluate(async () => {
    const faces = await document.fonts.load(
      'italic 500 13px "CV Resume Sans"',
      "Łódź Český Krumlov",
    );
    return faces.map((face) => ({
      family: face.family,
      status: face.status,
      stretch: face.stretch,
      style: face.style,
      weight: face.weight,
    }));
  });
  expect(loadedFaces.length).toBeGreaterThanOrEqual(2);
  expect(
    loadedFaces.every(
      (face) =>
        face.family === "CV Resume Sans" &&
        face.status === "loaded" &&
        face.stretch === "95% 100%" &&
        face.style === "italic" &&
        face.weight === "400 800",
    ),
  ).toBe(true);
  const italicDescriptor = await extendedPage.locator("em").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      family: style.fontFamily,
      stretch: style.fontStretch,
      style: style.fontStyle,
      weight: style.fontWeight,
    };
  });
  expect(italicDescriptor.family).toContain("CV Resume Sans");
  expect(italicDescriptor.stretch).toBe("100%");
  expect(italicDescriptor.style).toBe("italic");
  expect(italicDescriptor.weight).toBe("400");
  expectNoPageDiagnostics(extendedDiagnostics);
  await extendedPage.close();
});
