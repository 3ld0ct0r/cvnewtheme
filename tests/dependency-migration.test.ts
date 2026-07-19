import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  access,
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

import {
  assertExactHugoVersion,
  EXPECTED_HUGO_VERSION,
} from "../scripts/hugo-version";

const projectRoot = resolve(import.meta.dir, "..");

const expectedVersions = {
  axePlaywright: "4.12.1",
  bootstrap: "5.3.8",
  bun: "1.3.14",
  fontAwesome: "7.3.1",
  fontTools: "4.63.0",
  pdfjs: "6.1.200",
  playwright: "1.61.1",
  python: "3.14.6",
  sass: "1.101.0",
  uv: "0.11.29",
} as const;

const dependencyPackages = {
  axePlaywright: "@axe-core/playwright",
  bootstrap: "bootstrap",
  fontAwesome: "@fortawesome/fontawesome-free",
  pdfjs: "pdfjs-dist",
  playwright: "@playwright/test",
  sass: "sass",
} as const;

const expectedIconKinds = [
  "email",
  "github",
  "linkedin",
  "location",
  "online-cv",
  "pdf",
  "phone",
  "website",
] as const;

type PackageManifest = {
  packageManager: string;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
};

type DependencyManifest = {
  budgets: {
    individualBudgetBytes: number;
    initialBudgetBytes: number;
    initialBytes: number;
    totalBudgetBytes: number;
    totalBytes: number;
  };
  generatedBy: {
    bun: string;
    fontTools: string;
    python: string;
    sass: string;
    uv: string;
  };
  operations: {
    font: {
      declaredSubsets: { latin: string; latinExt: string };
      familyRename: { family: string; postscriptPrefix: string };
      opticalSize: { frozen: number };
      overlapAssignment: { codepoints: string[]; owner: "latin" };
      subsets: { latin: string; latinExt: string };
      weight: { maximum: number; minimum: number };
      width: { maximum: number; minimum: number };
    };
    icons: { count: number; parser: string; policy: string };
  };
  outputs: {
    css: { bytes: number; path: string; sha256: string };
    fonts: Array<{
      axes: Record<string, [number, number, number]>;
      bytes: number;
      layoutFeatures: { GPOS: string[]; GSUB: string[] };
      path: string;
      sha256: string;
      style: "italic" | "normal";
      subset: "latin" | "latin-ext";
      unicodeRange: string;
    }>;
    icons: {
      budgetBytes: number;
      bytes: number;
      count: number;
      path: string;
      sha256: string;
    };
    licenses: Array<{
      bytes: number;
      path: string;
      sha256: string;
      source: string;
    }>;
    notices: { bytes: number; path: string; sha256: string };
  };
  schemaVersion: number;
  sources: {
    bootstrap: { version: string };
    fontAwesome: {
      icons: Array<{ kind: string; path: string; sha256: string }>;
      version: string;
    };
    monaSans: {
      archiveSha256: string;
      italicSource: { sha256: string };
      licenseSha256: string;
      normalSource: { sha256: string };
      version: string;
    };
  };
};

type IconRegistry = Record<
  string,
  { paths: string[]; viewBox: [number, number, number, number] }
>;

const sha256 = (contents: Uint8Array) =>
  createHash("sha256").update(contents).digest("hex");

const sha256Integrity = (hexDigest: string) =>
  `sha256-${Buffer.from(hexDigest, "hex").toString("base64")}`;

function parseUnicodeRange(value: string): Set<number> {
  const codepoints = new Set<number>();
  for (const component of value.split(",")) {
    const [startText, endText = startText] = component.trim().slice(2).split("-");
    const start = Number.parseInt(startText, 16);
    const end = Number.parseInt(endText, 16);
    for (let codepoint = start; codepoint <= end; codepoint += 1) {
      codepoints.add(codepoint);
    }
  }
  return codepoints;
}

function contrastRatio(
  foreground: readonly [number, number, number],
  background: readonly [number, number, number],
): number {
  const luminance = (rgb: readonly [number, number, number]) =>
    rgb.reduce((total, channel, index) => {
      const value = channel / 255;
      const linear =
        value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      return total + linear * [0.2126, 0.7152, 0.0722][index];
    }, 0);
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function blendOverWhite(
  foreground: readonly [number, number, number],
  alpha: number,
): [number, number, number] {
  return foreground.map((channel) =>
    Math.round(channel * alpha + 255 * (1 - alpha)),
  ) as [number, number, number];
}

async function collectFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile()) {
        files.push(relative(root, path).split(sep).join("/"));
      }
    }
  };
  await walk(root);
  return files.sort();
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function collectActiveSourceFiles(): Promise<string[]> {
  const roots = ["archetypes", "assets/scss", "exampleSite", "i18n", "layouts"];
  const includedExtensions = new Set([
    ".html",
    ".md",
    ".scss",
    ".toml",
    ".yaml",
    ".yml",
  ]);
  const excludedDirectories = new Set([
    ".git",
    ".hugo_build.lock",
    "generated",
    "node_modules",
    "public",
    "resources",
  ]);
  const files: string[] = [];

  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) await walk(path);
        continue;
      }
      if (entry.isFile() && includedExtensions.has(extname(entry.name))) {
        files.push(path);
      }
    }
  };

  for (const root of roots) await walk(join(projectRoot, root));
  return files.sort();
}

describe("Bun-managed dependency and asset migration", () => {
  test("requires the exact Hugo Extended reference toolchain", async () => {
    const hugo = await assertExactHugoVersion(projectRoot);

    expect(hugo.version).toBe(EXPECTED_HUGO_VERSION);
    expect(hugo.output).toMatch(/\+extended(?:\+|\s)/);
  });

  test("pins exact development and generation tool versions", async () => {
    const packageManifest = await readJson<PackageManifest>(
      join(projectRoot, "package.json"),
    );
    const generated = await readJson<DependencyManifest>(
      join(projectRoot, "assets/generated/dependencies.json"),
    );
    const lockfile = await readFile(join(projectRoot, "bun.lock"), "utf8");
    const pythonVersion = (await readFile(join(projectRoot, ".python-version"), "utf8")).trim();
    const pyproject = await readFile(join(projectRoot, "pyproject.toml"), "utf8");

    expect(Bun.version).toBe(expectedVersions.bun);
    expect(packageManifest.packageManager).toBe(`bun@${expectedVersions.bun}`);
    expect(packageManifest.scripts.dev).toBe(
      "bun run build:assets && bun scripts/preview-test.ts --source exampleSite --port 1313",
    );
    expect(packageManifest.scripts["capture:consumer-screenshots"]).toBe(
      "bun scripts/capture-consumer-screenshots.ts",
    );
    expect(generated.schemaVersion).toBe(1);
    expect(generated.generatedBy).toMatchObject({
      bun: expectedVersions.bun,
      fontTools: expectedVersions.fontTools,
      python: expectedVersions.python,
      sass: expectedVersions.sass,
      uv: expectedVersions.uv,
    });
    expect(pythonVersion).toBe(expectedVersions.python);
    expect(pyproject).toContain('requires-python = "==3.14.6"');
    expect(pyproject).toContain('"fonttools[woff]==4.63.0"');

    for (const [key, packageName] of Object.entries(dependencyPackages) as Array<
      [keyof typeof dependencyPackages, string]
    >) {
      const expectedVersion = expectedVersions[key];
      const installed = await readJson<{ version: string }>(
        join(projectRoot, "node_modules", packageName, "package.json"),
      );
      expect(packageManifest.devDependencies[packageName]).toBe(expectedVersion);
      expect(installed.version).toBe(expectedVersion);
      expect(lockfile).toContain(`\"${packageName}\": \"${expectedVersion}\"`);
    }

    expect(generated.sources.bootstrap.version).toBe(expectedVersions.bootstrap);
    expect(generated.sources.fontAwesome.version).toBe(expectedVersions.fontAwesome);
    expect(generated.sources.monaSans.version).toBe("2.0.27");
  });

  test("locks accessible text and graphical contrast for every theme state", () => {
    const white = [255, 255, 255] as const;
    const offWhite = [248, 249, 250] as const;
    const body = [31, 35, 40] as const;
    const blue = [0, 102, 174] as const;
    const mutedText = [91, 113, 134] as const;
    const mutedIcon = [111, 132, 152] as const;
    const hoverTint = blendOverWhite(blue, 0.08);

    for (const [foreground, background] of [
      [body, white],
      [blue, white],
      [blue, offWhite],
      [blue, hoverTint],
      [mutedText, white],
      [mutedText, offWhite],
      [white, body],
    ] as const) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(mutedIcon, white)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(blue, white)).toBeGreaterThanOrEqual(3);
  });

  test("tracks deterministic CSS, icon, font, license, and notice outputs", async () => {
    const generated = await readJson<DependencyManifest>(
      join(projectRoot, "assets/generated/dependencies.json"),
    );
    const css = await readFile(join(projectRoot, generated.outputs.css.path));
    const iconBytes = await readFile(join(projectRoot, generated.outputs.icons.path));
    const icons = JSON.parse(iconBytes.toString("utf8")) as IconRegistry;

    expect(css.toString("utf8")).toContain(
      `Bootstrap  v${expectedVersions.bootstrap}`,
    );
    expect(css.toString("utf8")).toContain('font-family:"CV Resume Sans"');
    expect(css.toString("utf8")).not.toMatch(/Bootstrap\s+v4\./i);
    expect(css.byteLength).toBe(generated.outputs.css.bytes);
    expect(sha256(css)).toBe(generated.outputs.css.sha256);

    expect(Object.keys(icons).sort()).toEqual([...expectedIconKinds]);
    expect(iconBytes.byteLength).toBeLessThanOrEqual(20_480);
    expect(iconBytes.byteLength).toBe(generated.outputs.icons.bytes);
    expect(sha256(iconBytes)).toBe(generated.outputs.icons.sha256);
    expect(generated.outputs.icons.count).toBe(8);
    expect(generated.operations.icons).toMatchObject({
      count: 8,
      parser: "Bun.HTMLRewriter",
    });
    for (const icon of Object.values(icons)) {
      expect(icon.viewBox).toEqual([0, 0, 640, 640]);
      expect(icon.paths.length).toBeGreaterThan(0);
      expect(icon.paths.every((path) => /^[0-9+\-.,\sAaCcHhLlMmQqSsTtVvZzEe]+$/.test(path))).toBe(true);
    }

    expect(generated.outputs.fonts).toHaveLength(4);
    let totalFontBytes = 0;
    for (const font of generated.outputs.fonts) {
      const contents = await readFile(join(projectRoot, font.path));
      expect(contents.subarray(0, 4).toString("ascii")).toBe("wOF2");
      expect(contents.byteLength).toBe(font.bytes);
      expect(contents.byteLength).toBeLessThanOrEqual(
        generated.budgets.individualBudgetBytes,
      );
      expect(sha256(contents)).toBe(font.sha256);
      expect(font.axes.wdth).toEqual([95, 100, 100]);
      expect(font.axes.wght).toEqual([400, 400, 800]);
      expect(font.layoutFeatures.GPOS).toContain("kern");
      expect(font.layoutFeatures.GSUB).toEqual(
        expect.arrayContaining(["aalt", "case", "ccmp", "locl"]),
      );
      if (font.subset === "latin") {
        expect(font.layoutFeatures.GPOS).toEqual(
          expect.arrayContaining(["kern", "mark", "mkmk"]),
        );
        expect(font.layoutFeatures.GSUB).toEqual(
          expect.arrayContaining(["liga", "tnum"]),
        );
      }
      totalFontBytes += contents.byteLength;
    }
    expect(totalFontBytes).toBe(generated.budgets.totalBytes);
    expect(totalFontBytes).toBeLessThanOrEqual(generated.budgets.totalBudgetBytes);
    expect(generated.budgets.initialBytes).toBeLessThanOrEqual(
      generated.budgets.initialBudgetBytes,
    );
    expect(generated.operations.font).toMatchObject({
      familyRename: {
        family: "CV Resume Sans",
        postscriptPrefix: "CVResumeSans",
      },
      opticalSize: { frozen: 20 },
      weight: { maximum: 800, minimum: 400 },
      width: { maximum: 100, minimum: 95 },
    });
    expect(generated.operations.font.declaredSubsets.latinExt).toBe(
      "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
    );
    expect(generated.operations.font.overlapAssignment).toEqual({
      codepoints: [
        "U+0131",
        "U+0152",
        "U+0153",
        "U+0304",
        "U+0308",
        "U+0329",
        "U+2020",
      ],
      owner: "latin",
    });
    const latin = parseUnicodeRange(generated.operations.font.subsets.latin);
    const latinExt = parseUnicodeRange(generated.operations.font.subsets.latinExt);
    expect([...latin].filter((codepoint) => latinExt.has(codepoint))).toEqual([]);
    const declaredLatinExt = parseUnicodeRange(
      generated.operations.font.declaredSubsets.latinExt,
    );
    expect(
      [...declaredLatinExt]
        .filter((codepoint) => !latin.has(codepoint))
        .sort((left, right) => left - right),
    ).toEqual([...latinExt].sort((left, right) => left - right));

    for (const output of [
      ...generated.outputs.licenses,
      generated.outputs.notices,
    ]) {
      const contents = await readFile(join(projectRoot, output.path));
      expect(contents.byteLength).toBe(output.bytes);
      expect(sha256(contents)).toBe(output.sha256);
    }

    await expect(
      access(join(projectRoot, "assets/generated/fontawesome.min.js")),
    ).rejects.toThrow();
  });

  test("contains no retired runtime, raw icon classes, legacy config, or asset CDNs", async () => {
    const patterns: Array<[string, RegExp]> = [
      ["left/right spacing utility", /\b(?:m|p)[lr]-(?:(?:sm|md|lg|xl)-)?(?:0|1|2|3|4|5|auto)\b/],
      ["font-weight utility", /\bfont-weight-(?:bold|normal|light)\b/],
      ["left/right text utility", /\btext-(?:(?:sm|md|lg|xl)-)?(?:left|right)\b/],
      ["retired text-muted utility", /\btext-muted\b/],
      ["raw Font Awesome class", /\bfa-(?:solid|regular|brands|[a-z0-9-]+)\b/],
      ["Font Awesome runtime", /fontawesome(?:\.min)?\.js/i],
      ["Font Awesome transform", /data-fa-transform/i],
      ["icon-font element", /<i(?:\s|>)/i],
      ["legacy contact/social config", /\.Site\.Params\.(?:contact|social)\b|\[params\.(?:contact|social)\]/],
      ["forced new tab", /target=["']?_blank/i],
      [
        "external Font Awesome or Google Fonts host",
        /(?:use|kit)\.fontawesome\.com|cdnjs\.cloudflare\.com\/ajax\/libs\/(?:font-awesome|fontawesome)|maxcdn\.bootstrapcdn\.com\/font-awesome|fonts\.googleapis\.com/i,
      ],
      ["Bootstrap 4 source reference", /Bootstrap\s+v?4(?:\.|\b)/i],
    ];
    const sourceFiles = await collectActiveSourceFiles();
    const violations: string[] = [];

    expect(sourceFiles.length).toBeGreaterThan(10);
    for (const path of sourceFiles) {
      const contents = await readFile(path, "utf8");
      for (const [label, pattern] of patterns) {
        if (pattern.test(contents)) {
          violations.push(`${relative(projectRoot, path)}: ${label}`);
        }
      }
    }
    expect(violations).toEqual([]);

    const staticFiles = await collectFiles(join(projectRoot, "static"));
    expect(
      staticFiles.filter((path) => /fontawesome.*\.(?:css|js)$/i.test(path)),
    ).toEqual([]);
    expect(
      staticFiles.filter((path) => /\.(?:eot|otf|ttf|woff)$/i.test(path)),
    ).toEqual([]);
    expect(staticFiles.filter((path) => /\.woff2$/i.test(path))).toEqual([
      "generated/fonts/cv-resume-sans-latin-ext-italic.woff2",
      "generated/fonts/cv-resume-sans-latin-ext-normal.woff2",
      "generated/fonts/cv-resume-sans-latin-italic.woff2",
      "generated/fonts/cv-resume-sans-latin-normal.woff2",
    ]);
    const generatedAssetFiles = await collectFiles(
      join(projectRoot, "assets/generated"),
    );
    expect(generatedAssetFiles.filter((path) => /\.(?:js|woff2?)$/i.test(path))).toEqual([]);
  });

  test("builds the example cold with strict Hugo and emits only local fingerprinted assets", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "cvnewtheme-hugo-test-"));
    const source = join(temporaryRoot, "exampleSite");
    const destination = join(temporaryRoot, "public");
    const cacheDirectory = join(temporaryRoot, "cache");

    try {
      const exampleSite = join(projectRoot, "exampleSite");
      await cp(exampleSite, source, {
        recursive: true,
        filter: (sourcePath) => {
          const relativePath = relative(exampleSite, sourcePath);
          const firstSegment = relativePath.split(sep)[0];
          return !["public", "resources", ".hugo_build.lock"].includes(firstSegment);
        },
      });

      const hugo = Bun.spawn(
        [
          "hugo",
          "--source",
          source,
          "--themesDir",
          resolve(projectRoot, ".."),
          "--theme",
          "cvnewtheme",
          "--destination",
          destination,
          "--cacheDir",
          cacheDirectory,
          "--gc",
          "--ignoreCache",
          "--minify",
          "--noBuildLock",
          "--panicOnWarning",
        ],
        { cwd: temporaryRoot, stderr: "pipe", stdout: "pipe" },
      );
      const [exitCode, stdout, stderr] = await Promise.all([
        hugo.exited,
        new Response(hugo.stdout).text(),
        new Response(hugo.stderr).text(),
      ]);
      if (exitCode !== 0) {
        throw new Error(
          `Cold Hugo build failed with exit code ${exitCode}.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        );
      }

      const generated = await readJson<DependencyManifest>(
        join(projectRoot, "assets/generated/dependencies.json"),
      );
      const cssFilename = `devresume.min.${generated.outputs.css.sha256}.css`;
      const html = await readFile(join(destination, "index.html"), "utf8");
      const builtCss = await readFile(join(destination, "generated", cssFilename));

      expect(html).toContain("<html lang=en>");
      expect(html).toContain(`href=/generated/${cssFilename}`);
      expect(html).toContain(
        `integrity=\"${sha256Integrity(generated.outputs.css.sha256)}\"`,
      );
      expect(html).toContain(
        "href=/generated/fonts/cv-resume-sans-latin-normal.woff2",
      );
      expect(html).toContain('<svg class="resume-icon');
      expect(
        html.match(/<!--\[if IE\]>Icon geometry: Font Awesome Free 7\.3\.1 \(CC BY 4\.0\)\.<!\[endif\]-->/g),
      ).toHaveLength(1);
      expect(html).not.toMatch(/<i(?:\s|>)/i);
      expect(html).not.toMatch(/fontawesome(?:\.min)?\.js|data-fa-transform/i);
      expect(html).not.toMatch(/<script[^>]+src=/i);
      expect(html).not.toMatch(
        /(?:use|kit)\.fontawesome\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com/i,
      );
      expect(sha256(builtCss)).toBe(generated.outputs.css.sha256);

      const publishedFiles = await collectFiles(destination);
      expect(publishedFiles.filter((path) => /\.js$/i.test(path))).toEqual([]);
      expect(
        publishedFiles.filter((path) => /fontawesome.*\.(?:css|js|woff2?)$/i.test(path)),
      ).toEqual([]);
      expect(publishedFiles.filter((path) => /\.(?:eot|otf|ttf|woff)$/i.test(path))).toEqual([]);
      expect(publishedFiles.filter((path) => /\.woff2$/i.test(path))).toEqual([
        "generated/fonts/cv-resume-sans-latin-ext-italic.woff2",
        "generated/fonts/cv-resume-sans-latin-ext-normal.woff2",
        "generated/fonts/cv-resume-sans-latin-italic.woff2",
        "generated/fonts/cv-resume-sans-latin-normal.woff2",
      ]);

      for (const output of [
        ...generated.outputs.fonts,
        ...generated.outputs.licenses,
      ]) {
        const publishedPath = output.path.replace(/^static\//, "");
        const published = await readFile(join(destination, publishedPath));
        expect(sha256(published)).toBe(output.sha256);
        expect((await stat(join(destination, publishedPath))).isFile()).toBe(true);
      }
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });
});
