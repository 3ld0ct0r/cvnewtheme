import { describe, expect, test } from "bun:test";
import {
  buildTemporarySite,
  requireSuccessfulBuild,
  samplePdf,
} from "./helpers/hugo";

const siteConfig = String.raw`
baseURL = "https://resume.example.invalid/"
locale = "en"
title = "Resume Link Contract"
theme = "cvnewtheme"
disableKinds = ["taxonomy", "term", "rss"]

[params]
author = "Avery Morgan"
description = "Semantic resume link validation fixture."

[params.seo]
canonical = "https://resume.example.invalid/"
robots = "noindex, nofollow"
personName = "Avery Morgan"
personJobTitle = "Principal Engineer"
keywords = ["platform engineering"]

[params.profile]
enable = true
name = "Avery Morgan"
tagline = "Principal Engineer"

[params.summary]
enable = true
[[params.summary.list]]
[[params.summary.list.items]]
text = "Builds dependable systems."

[params.experience]
enable = true
[[params.experience.list]]
title = "Principal Engineer"
dates = "2022 - Present"
company = "Example Systems"
location = "Bengaluru"
details = "Leads platform architecture and delivery."
[[params.experience.list.items]]
details = "Improved reliability and deployment speed."

[params.skills]
enable = true
[[params.skills.list]]
title = "Architecture"
[[params.skills.list.items]]
details = "Distributed systems, reliability, delivery"

[params.education]
enable = false
[params.certifications]
enable = false
[params.awards]
enable = false
[params.languages]
enable = false
[params.interests]
enable = false
[params.projects]
enable = false
[params.information]
enable = false
`;

const canonicalRegistry = String.raw`
[params.resumeLinks]
header = ["online_cv", "website", "location"]
actions = ["online_cv", "email", "pdf", "linkedin", "github"]

[params.resumeLinks.items.online_cv]
kind = "online-cv"
url = "https://resume.example.invalid/"
text = "Online CV"
label = "View online CV"

[params.resumeLinks.items.website]
kind = "website"
url = "https://avery.example.invalid/"
text = "avery.example.invalid"
label = "Visit website"

[params.resumeLinks.items.location]
kind = "location"
text = "Bengaluru, India"
label = "Location: Bengaluru, India"

[params.resumeLinks.items.email]
kind = "email"
url = "mailto:avery@example.invalid"
text = "avery@example.invalid"
label = "Email Avery Morgan"

[params.resumeLinks.items.pdf]
kind = "pdf"
url = "/resume.pdf"
text = "Resume PDF"
label = "Download resume PDF"

[params.resumeLinks.items.linkedin]
kind = "linkedin"
url = "https://linkedin.example.invalid/in/avery-morgan"
text = "LinkedIn"
label = "View LinkedIn profile"

[params.resumeLinks.items.github]
kind = "github"
url = "https://github.example.invalid/avery-morgan"
text = "GitHub"
label = "View GitHub profile"
`;

const pdfRegistryBlock = String.raw`
[params.resumeLinks.items.pdf]
kind = "pdf"
url = "/resume.pdf"
text = "Resume PDF"
label = "Download resume PDF"
`;

const configWith = (registry: string) => `${siteConfig}\n${registry}`;

function replaceRequired(contents: string, before: string, after: string): string {
  expect(contents).toContain(before);
  return contents.replace(before, after);
}

function idsWithin(html: string, selectorClass: string): string[] {
  const elementPattern = new RegExp(
    `<(?:address|nav)[^>]*class="[^"]*${selectorClass}[^"]*"[\\s\\S]*?<\\/(?:address|nav)>`,
  );
  const section = html.match(elementPattern)?.[0] ?? "";
  return Array.from(
    section.matchAll(/data-resume-link-id="([a-z][a-z0-9_]*)"/g),
    (match) => match[1],
  );
}

async function expectContractFailure(
  registry: string,
  options: { directories?: string[]; includePdf?: boolean } = {},
): Promise<void> {
  const result = await buildTemporarySite({
    config: configWith(registry),
    directories: options.directories,
    files: options.includePdf
      ? { "static/resume.pdf": await samplePdf() }
      : undefined,
  });

  try {
    expect(result.exitCode).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain("resumeLinks:");
  } finally {
    await result.cleanup();
  }
}

describe("semantic resumeLinks contract", () => {
  test("renders the canonical registry in configured order without a new-tab policy", async () => {
    const result = await buildTemporarySite({
      config: configWith(canonicalRegistry),
      files: { "static/resume.pdf": await samplePdf() },
    });

    try {
      requireSuccessfulBuild(result);
      const html = await result.readOutput();

      expect(idsWithin(html, "resume-contact")).toEqual([
        "online_cv",
        "website",
        "location",
      ]);
      expect(idsWithin(html, "resume-actions")).toEqual([
        "online_cv",
        "email",
        "pdf",
        "linkedin",
        "github",
      ]);
      expect(html).not.toMatch(/\starget=/i);
      expect(html).toMatch(
        /data-resume-kind="pdf"[^>]*(?:download(?:="")?|href="\/resume\.pdf")/,
      );
      expect(html.match(/\brel="?me"?/g)).toHaveLength(3);
      expect(html).not.toMatch(/data-resume-kind="online-cv"[^>]*\brel="?me"?/);
      expect(html).toContain("aria-label=\"Contact information\"");
      expect(html).toContain("aria-label=\"Resume actions\"");
      expect(html).toMatch(
        /<a[^>]*aria-label="Online CV — View online CV"[^>]*data-resume-kind="online-cv"/,
      );
      expect(html).toMatch(
        /<a[^>]*aria-label="avery\.example\.invalid — Visit website"[^>]*data-resume-kind="website"/,
      );
      expect(html).toContain(
        '<span class="visually-hidden">Location: Bengaluru, India</span>',
      );
      expect(html).toContain('<span class="visually-hidden">Download resume PDF</span>');
      expect(html).toMatch(
        /<svg[^>]*aria-hidden="true"[^>]*focusable="false"[^>]*>/,
      );
      expect(html).not.toMatch(/<svg[^>]*(?:role|title)=/i);
      expect(
        html.match(/Icon geometry: Font Awesome Free 7\.3\.1 \(CC BY 4\.0\)\./g),
      ).toHaveLength(1);

      const personScript = Array.from(
        html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
        (match) => match[1],
      )
        .map((value) => JSON.parse(value) as Record<string, unknown>)
        .find((value) => value["@type"] === "Person");

      expect(personScript?.sameAs).toEqual([
        "https://avery.example.invalid/",
        "https://linkedin.example.invalid/in/avery-morgan",
        "https://github.example.invalid/avery-morgan",
      ]);
    } finally {
      await result.cleanup();
    }
  });

  test("accepts a valid registry with no PDF declaration or action", async () => {
    let registry = replaceRequired(
      canonicalRegistry,
      'actions = ["online_cv", "email", "pdf", "linkedin", "github"]',
      'actions = ["online_cv", "email", "linkedin", "github"]',
    );
    registry = replaceRequired(registry, pdfRegistryBlock, "");

    const result = await buildTemporarySite({ config: configWith(registry) });
    try {
      requireSuccessfulBuild(result);
      const html = await result.readOutput();
      expect(idsWithin(html, "resume-contact")).toEqual([
        "online_cv",
        "website",
        "location",
      ]);
      expect(idsWithin(html, "resume-actions")).toEqual([
        "online_cv",
        "email",
        "linkedin",
        "github",
      ]);
      expect(html).not.toMatch(/data-resume-kind="pdf"|resume\.pdf|Download resume PDF/);
    } finally {
      await result.cleanup();
    }
  });

  test("normalizes a PDF URL for a base-path deployment", async () => {
    const config = configWith(canonicalRegistry).replace(
      'baseURL = "https://resume.example.invalid/"',
      'baseURL = "https://resume.example.invalid/cv/"',
    );
    const result = await buildTemporarySite({
      config,
      files: { "static/resume.pdf": await samplePdf() },
    });
    try {
      requireSuccessfulBuild(result);
      const html = await result.readOutput();
      expect(html).toMatch(
        /data-resume-kind="pdf"[^>]*href="\/cv\/resume\.pdf"|href="\/cv\/resume\.pdf"[^>]*data-resume-kind="pdf"/,
      );
    } finally {
      await result.cleanup();
    }
  });

  test("marks a valid header PDF for print suppression", async () => {
    let registry = replaceRequired(
      canonicalRegistry,
      'header = ["online_cv", "website", "location"]',
      'header = ["pdf"]',
    );
    registry = replaceRequired(
      registry,
      'actions = ["online_cv", "email", "pdf", "linkedin", "github"]',
      "actions = []",
    );
    const result = await buildTemporarySite({
      config: configWith(registry),
      files: { "static/resume.pdf": await samplePdf() },
    });
    try {
      requireSuccessfulBuild(result);
      const html = await result.readOutput();
      expect(idsWithin(html, "resume-contact")).toEqual(["pdf"]);
      expect(idsWithin(html, "resume-actions")).toEqual([]);
      expect(html).toMatch(
        /<li[^>]*class="resume-contact-item"[^>]*data-resume-kind="pdf"[^>]*data-pdf-action/,
      );
      expect(html).toMatch(
        /<a[^>]*href="\/resume\.pdf"[^>]*download[^>]*data-pdf-action/,
      );
    } finally {
      await result.cleanup();
    }
  });

  test("accepts empty surfaces, cross-surface reuse, and a header phone", async () => {
    let registry = replaceRequired(
      canonicalRegistry,
      'header = ["online_cv", "website", "location"]',
      'header = ["phone"]',
    );
    registry = replaceRequired(
      registry,
      'actions = ["online_cv", "email", "pdf", "linkedin", "github"]',
      'actions = ["phone"]',
    );
    registry += String.raw`

[params.resumeLinks.items.phone]
kind = "phone"
url = "tel:*123#;phone-context=+91"
text = "*123#"
label = "Call Avery Morgan"
`;

    const result = await buildTemporarySite({
      config: configWith(registry),
      files: { "static/resume.pdf": await samplePdf() },
    });

    try {
      requireSuccessfulBuild(result);
      const html = await result.readOutput();
      expect(idsWithin(html, "resume-contact")).toEqual(["phone"]);
      expect(idsWithin(html, "resume-actions")).toEqual(["phone"]);
      expect(html).toContain(
        'href="tel:*123#;phone-context=&#43;91"',
      );
    } finally {
      await result.cleanup();
    }

    const emptyRegistry = replaceRequired(
      replaceRequired(registry, 'header = ["phone"]', "header = []"),
      'actions = ["phone"]',
      "actions = []",
    );
    const empty = await buildTemporarySite({
      config: configWith(emptyRegistry),
      files: { "static/resume.pdf": await samplePdf() },
    });
    try {
      requireSuccessfulBuild(empty);
      const html = await empty.readOutput();
      expect(idsWithin(html, "resume-contact")).toEqual([]);
      expect(idsWithin(html, "resume-actions")).toEqual([]);
    } finally {
      await empty.cleanup();
    }
  });

  test("deduplicates sameAs by exact URL while preserving first-seen order", async () => {
    let registry = replaceRequired(
      canonicalRegistry,
      'actions = ["online_cv", "email", "pdf", "linkedin", "github"]',
      'actions = ["website", "github", "linkedin"]',
    );
    registry = replaceRequired(
      registry,
      'url = "https://github.example.invalid/avery-morgan"',
      'url = "https://avery.example.invalid/"',
    );

    const result = await buildTemporarySite({
      config: configWith(registry),
      files: { "static/resume.pdf": await samplePdf() },
    });
    try {
      requireSuccessfulBuild(result);
      const html = await result.readOutput();
      const person = Array.from(
        html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
        (match) => JSON.parse(match[1]) as Record<string, unknown>,
      ).find((value) => value["@type"] === "Person");
      expect(person?.sameAs).toEqual([
        "https://avery.example.invalid/",
        "https://linkedin.example.invalid/in/avery-morgan",
      ]);
    } finally {
      await result.cleanup();
    }
  });

  test("escapes configured text and labels as plain text", async () => {
    let registry = replaceRequired(
      canonicalRegistry,
      'text = "avery.example.invalid"',
      'text = "<strong>avery.example.invalid</strong>"',
    );
    registry = replaceRequired(
      registry,
      'label = "View online CV"',
      'label = "View <script>online CV</script>"',
    );

    const result = await buildTemporarySite({
      config: configWith(registry),
      files: { "static/resume.pdf": await samplePdf() },
    });
    try {
      requireSuccessfulBuild(result);
      const html = await result.readOutput();
      expect(html).toContain("&lt;strong&gt;avery.example.invalid&lt;/strong&gt;");
      expect(html).toContain("View &lt;script&gt;online CV&lt;/script&gt;");
      expect(html).not.toContain("<strong>avery.example.invalid</strong>");
      expect(html).not.toContain("<script>online CV</script>");
    } finally {
      await result.cleanup();
    }
  });

  const invalidRegistries: Array<[string, (registry: string) => string]> = [
    ["missing registry", () => ""],
    [
      "missing header",
      (registry) =>
        replaceRequired(
          registry,
          'header = ["online_cv", "website", "location"]\n',
          "",
        ),
    ],
    [
      "missing actions",
      (registry) =>
        replaceRequired(
          registry,
          'actions = ["online_cv", "email", "pdf", "linkedin", "github"]\n',
          "",
        ),
    ],
    [
      "non-array header",
      (registry) =>
        replaceRequired(
          registry,
          'header = ["online_cv", "website", "location"]',
          'header = "online_cv"',
        ),
    ],
    [
      "non-array actions",
      (registry) =>
        replaceRequired(
          registry,
          'actions = ["online_cv", "email", "pdf", "linkedin", "github"]',
          'actions = "online_cv"',
        ),
    ],
    [
      "non-string header entry",
      (registry) =>
        replaceRequired(
          registry,
          'header = ["online_cv", "website", "location"]',
          "header = [42]",
        ),
    ],
    [
      "non-string actions entry",
      (registry) =>
        replaceRequired(
          registry,
          'actions = ["online_cv", "email", "pdf", "linkedin", "github"]',
          "actions = [42]",
        ),
    ],
    [
      "missing items",
      () => String.raw`[params.resumeLinks]
header = []
actions = []`,
    ],
    [
      "items with wrong type",
      () => String.raw`[params.resumeLinks]
header = []
actions = []
items = 42`,
    ],
    [
      "item with wrong type",
      () => String.raw`[params.resumeLinks]
header = []
actions = []
items = { broken = 42 }`,
    ],
    [
      "unknown registry key",
      (registry) =>
        replaceRequired(
          registry,
          '[params.resumeLinks]\n',
          '[params.resumeLinks]\nlegacy = true\n',
        ),
    ],
    [
      "malformed item id",
      (registry) =>
        `${registry}\n[params.resumeLinks.items.Bad-ID]\nkind = "website"\nurl = "https://bad.example.invalid/"\ntext = "Bad"\nlabel = "Bad item"`,
    ],
    [
      "malformed selected id",
      (registry) =>
        replaceRequired(
          registry,
          'header = ["online_cv", "website", "location"]',
          'header = ["Bad-ID"]',
        ),
    ],
    [
      "unknown selected id",
      (registry) =>
        replaceRequired(
          registry,
          'header = ["online_cv", "website", "location"]',
          'header = ["not_declared"]',
        ),
    ],
    [
      "same-surface duplicate",
      (registry) =>
        replaceRequired(
          registry,
          'header = ["online_cv", "website", "location"]',
          'header = ["online_cv", "online_cv"]',
        ),
    ],
    [
      "actions duplicate",
      (registry) =>
        replaceRequired(
          registry,
          'actions = ["online_cv", "email", "pdf", "linkedin", "github"]',
          'actions = ["email", "email"]',
        ),
    ],
    [
      "location action",
      (registry) =>
        replaceRequired(
          registry,
          'actions = ["online_cv", "email", "pdf", "linkedin", "github"]',
          'actions = ["location"]',
        ),
    ],
    [
      "unsupported dormant kind",
      (registry) =>
        `${registry}\n[params.resumeLinks.items.dormant]\nkind = "mastodon"\nurl = "https://social.example.invalid/avery"\ntext = "Social"\nlabel = "View social profile"`,
    ],
    [
      "unknown item key",
      (registry) =>
        replaceRequired(
          registry,
          'label = "Visit website"',
          'label = "Visit website"\nicon = "fa-solid fa-globe"',
        ),
    ],
    [
      "missing item kind",
      (registry) => replaceRequired(registry, 'kind = "online-cv"\n', ""),
    ],
    [
      "missing item text",
      (registry) => replaceRequired(registry, 'text = "Online CV"\n', ""),
    ],
    [
      "missing item label",
      (registry) => replaceRequired(registry, 'label = "View online CV"\n', ""),
    ],
    [
      "missing item url",
      (registry) =>
        replaceRequired(
          registry,
          'url = "https://resume.example.invalid/"\n',
          "",
        ),
    ],
    [
      "non-string item kind",
      (registry) => replaceRequired(registry, 'kind = "online-cv"', "kind = 42"),
    ],
    [
      "non-string item text",
      (registry) =>
        replaceRequired(
          registry,
          'text = "avery.example.invalid"',
          "text = 42",
        ),
    ],
    [
      "non-string item label",
      (registry) =>
        replaceRequired(registry, 'label = "View online CV"', "label = 42"),
    ],
    [
      "non-string item url",
      (registry) =>
        replaceRequired(
          registry,
          'url = "https://resume.example.invalid/"',
          "url = 42",
        ),
    ],
    [
      "blank item label",
      (registry) =>
        replaceRequired(registry, 'label = "View online CV"', 'label = "   "'),
    ],
    [
      "URL with surrounding whitespace",
      (registry) =>
        replaceRequired(
          registry,
          'url = "https://resume.example.invalid/"',
          'url = " https://resume.example.invalid/"',
        ),
    ],
    [
      "insecure identity URL",
      (registry) =>
        replaceRequired(
          registry,
          'url = "https://avery.example.invalid/"',
          'url = "http://avery.example.invalid/"',
        ),
    ],
    [
      "identity URL credentials",
      (registry) =>
        replaceRequired(
          registry,
          'url = "https://avery.example.invalid/"',
          'url = "https://user:secret@avery.example.invalid/"',
        ),
    ],
    [
      "protocol-relative identity URL",
      (registry) =>
        replaceRequired(
          registry,
          'url = "https://avery.example.invalid/"',
          'url = "//avery.example.invalid/"',
        ),
    ],
    [
      "empty email address",
      (registry) =>
        replaceRequired(
          registry,
          'url = "mailto:avery@example.invalid"',
          'url = "mailto:"',
        ),
    ],
    [
      "email fragment",
      (registry) =>
        replaceRequired(
          registry,
          'url = "mailto:avery@example.invalid"',
          'url = "mailto:avery@example.invalid#fragment"',
        ),
    ],
    [
      "invalid dormant phone",
      (registry) =>
        `${registry}\n[params.resumeLinks.items.phone]\nkind = "phone"\nurl = "sms:+918000000000"\ntext = "+91 80000 00000"\nlabel = "Call Avery Morgan"`,
    ],
    [
      "empty dormant phone dial string",
      (registry) =>
        `${registry}\n[params.resumeLinks.items.phone]\nkind = "phone"\nurl = "tel:"\ntext = "Phone"\nlabel = "Call Avery Morgan"`,
    ],
    [
      "dormant phone dial string with leading whitespace",
      (registry) =>
        `${registry}\n[params.resumeLinks.items.phone]\nkind = "phone"\nurl = "tel: +918000000000"\ntext = "+91 80000 00000"\nlabel = "Call Avery Morgan"`,
    ],
    [
      "dormant phone dial string with a control character",
      (registry) =>
        String.raw`${registry}
[params.resumeLinks.items.phone]
kind = "phone"
url = "tel:+91\u0009000"
text = "+91 80000 00000"
label = "Call Avery Morgan"`,
    ],
    [
      "location with URL",
      (registry) =>
        replaceRequired(
          registry,
          'kind = "location"\ntext = "Bengaluru, India"',
          'kind = "location"\nurl = "https://maps.example.invalid/"\ntext = "Bengaluru, India"',
        ),
    ],
  ];

  test.each(invalidRegistries)("rejects %s", async (_name, mutate) => {
    await expectContractFailure(mutate(canonicalRegistry), {
      includePdf: true,
    });
  });

  const invalidPdfPaths = [
    "resume.pdf",
    "//resume.pdf",
    "https://resume.example.invalid/resume.pdf",
    "/resume.PDF",
    "/folder//resume.pdf",
    "/folder/../resume.pdf",
    "/folder/./resume.pdf",
    "/resume.pdf?download=1",
    "/resume.pdf#page=1",
    "/resume%2epdf",
    "/folder\\resume.pdf",
  ];

  test.each(invalidPdfPaths)("rejects malformed PDF path %s", async (path) => {
    const registry = replaceRequired(
      canonicalRegistry,
      'url = "/resume.pdf"',
      `url = ${JSON.stringify(path)}`,
    );
    await expectContractFailure(registry, { includePdf: true });
  });

  test("rejects a missing PDF and a directory masquerading as a PDF", async () => {
    await expectContractFailure(canonicalRegistry);
    await expectContractFailure(canonicalRegistry, {
      directories: ["static/resume.pdf"],
    });
  });
});
