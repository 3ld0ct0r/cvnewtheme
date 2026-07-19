import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

import * as sass from "sass";

type PackageManifest = {
  devDependencies: Record<string, string>;
  packageManager: string;
};

type FontOutput = {
  axes: Record<string, [number, number, number]>;
  bytes: number;
  codepoints: number;
  filename: string;
  glyphs: number;
  layoutFeatures: Record<"GPOS" | "GSUB", string[]>;
  sha256: string;
  style: "normal" | "italic";
  subset: "latin" | "latin-ext";
  unicodeRange: string;
};

type FontBuildManifest = {
  brotliVersion: string;
  declaredUnicodeRanges: Record<"latin" | "latinExt", string>;
  family: string;
  fontToolsVersion: string;
  outputs: Record<string, FontOutput>;
  overlapAssignment: { codepoints: string[]; owner: "latin" };
  pythonVersion: string;
  sourceArchiveSha256: string;
  sourceVersion: string;
  totals: {
    initialBudgetBytes: number;
    initialBytes: number;
    individualBudgetBytes: number;
    totalBudgetBytes: number;
    totalBytes: number;
  };
  zopfliVersion: string;
};

type IconDefinition = {
  paths: string[];
  viewBox: [number, number, number, number];
};

type SemanticIconKind =
  | "online-cv"
  | "email"
  | "pdf"
  | "linkedin"
  | "github"
  | "website"
  | "location"
  | "phone";

type IconSource = {
  kind: SemanticIconKind;
  sha256: string;
  source: string;
};

const EXPECTED = {
  bootstrap: "5.3.8",
  brotli: "1.2.0",
  bun: "1.3.14",
  fontawesome: "7.3.1",
  fontTools: "4.63.0",
  python: "3.14.6",
  sass: "1.101.0",
  uv: "0.11.29",
  zopfli: "0.4.3",
} as const;

const projectRoot = resolve(import.meta.dir, "..");
const checkOnly = process.argv.includes("--check");
const packageManifest = JSON.parse(
  await readFile(join(projectRoot, "package.json"), "utf8"),
) as PackageManifest;

const dependencyNames = {
  bootstrap: "bootstrap",
  fontawesome: "@fortawesome/fontawesome-free",
  sass: "sass",
} as const;

const dependencyPaths = {
  bootstrap: join(projectRoot, "node_modules/bootstrap/package.json"),
  fontawesome: join(
    projectRoot,
    "node_modules/@fortawesome/fontawesome-free/package.json",
  ),
  sass: join(projectRoot, "node_modules/sass/package.json"),
};

const iconSources: readonly IconSource[] = [
  { kind: "online-cv", sha256: "b1ee2e5684df2b13c8c98bc95e50eda1fb4a911ed75ed199d2e4c14f8bd0de1f", source: "svgs-full/solid/address-card.svg" },
  { kind: "email", sha256: "5ac9feee21a5cec0e3f387777da31a2bb5c330a5c0d1ed0d658379408b8a8ec9", source: "svgs-full/solid/at.svg" },
  { kind: "pdf", sha256: "e1069283f2e2e2e4e2119329648981b03746bf8aff975168ed60cc79e7736592", source: "svgs-full/solid/file-pdf.svg" },
  { kind: "linkedin", sha256: "8e3b5f80a8cbf9da169bf100454351b9a27ed71cf63889ccdba4351aec1263b5", source: "svgs-full/brands/linkedin-in.svg" },
  { kind: "github", sha256: "d2708dcc457f2a094bc92c056b48f6f7c2a0f9a8f149ffbc6b71a1c8c623bf0f", source: "svgs-full/brands/github.svg" },
  { kind: "website", sha256: "9ab47d1fa39f3fb0cd7c42262161d507229c267ea610ff11eeeb00ead5d28f02", source: "svgs-full/solid/globe.svg" },
  { kind: "location", sha256: "4d0f436c8db98c59b6cf2e64c6e7722d058759ea2dfd2c23d29098024d621d67", source: "svgs-full/solid/location-dot.svg" },
  { kind: "phone", sha256: "4b21c0aed8cbac28393c7f7850e135243db17cb2dd6ed3ffa92cd59d6a61f65d", source: "svgs-full/solid/phone.svg" },
] as const;

const digest = (contents: Buffer | string) =>
  createHash("sha256").update(contents).digest("hex");

const readJson = async <T>(path: string) =>
  JSON.parse(await readFile(path, "utf8")) as T;

const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const packageManagerVersion = packageManifest.packageManager.split("@").at(-1);
if (process.versions.bun !== EXPECTED.bun) {
  throw new Error(
    `Bun ${EXPECTED.bun} is required; found ${process.versions.bun ?? "unknown"}`,
  );
}
if (packageManagerVersion !== EXPECTED.bun) {
  throw new Error(
    `package.json must pin bun@${EXPECTED.bun}; found ${packageManifest.packageManager}`,
  );
}

const installedVersions = Object.fromEntries(
  await Promise.all(
    Object.entries(dependencyPaths).map(async ([key, packagePath]) => {
      const installed = await readJson<{ version: string }>(packagePath);
      const dependencyName = dependencyNames[key as keyof typeof dependencyNames];
      const declared = packageManifest.devDependencies[dependencyName];
      const expected = EXPECTED[key as keyof typeof dependencyNames];

      if (declared !== expected) {
        throw new Error(
          `${dependencyName} must be pinned to ${expected}; package.json declares ${declared}`,
        );
      }
      if (installed.version !== expected) {
        throw new Error(
          `${dependencyName} ${installed.version} is installed; ${expected} is required`,
        );
      }
      return [key, installed.version];
    }),
  ),
) as Record<keyof typeof dependencyNames, string>;

const run = async (command: string[], environment: Record<string, string> = {}) => {
  const child = Bun.spawn(command, {
    cwd: projectRoot,
    env: { ...process.env, ...environment },
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `Command failed (${command.join(" ")}):\n${stderr || stdout}`.trimEnd(),
    );
  }
  return { stderr, stdout };
};

const uvResult = await run(["uv", "--version"]);
const uvVersion = uvResult.stdout.trim().split(/\s+/)[1];
if (uvVersion !== EXPECTED.uv) {
  throw new Error(`uv ${EXPECTED.uv} is required; found ${uvVersion ?? "unknown"}`);
}

const parseIcon = async (
  kind: SemanticIconKind,
  path: string,
): Promise<IconDefinition> => {
  const source = await readFile(path, "utf8");
  let doctypeCount = 0;
  let rootCount = 0;
  let attributionCount = 0;
  let viewBox: IconDefinition["viewBox"] | undefined;
  const paths: string[] = [];
  const violations: string[] = [];

  const rewriter = new HTMLRewriter()
    .on("*", {
      element(element) {
        const tag = element.tagName.toLowerCase();
        const attributes = [...element.attributes];

        if (tag === "svg") {
          rootCount += 1;
          const allowed = new Set(["xmlns", "viewbox"]);
          for (const [name, value] of attributes) {
            if (!allowed.has(name)) {
              violations.push(`<svg> has disallowed attribute ${name}`);
            }
            if (name === "xmlns" && value !== "http://www.w3.org/2000/svg") {
              violations.push(`<svg> has unexpected xmlns ${value}`);
            }
          }
          const rawViewBox = element.getAttribute("viewbox");
          const values = rawViewBox?.trim().split(/\s+/).map(Number);
          if (
            !values ||
            values.length !== 4 ||
            values.some((value) => !Number.isFinite(value)) ||
            values[0] !== 0 ||
            values[1] !== 0 ||
            values[2] !== 640 ||
            values[3] !== 640
          ) {
            violations.push(`<svg> has invalid viewBox ${rawViewBox ?? "missing"}`);
          } else {
            viewBox = values as IconDefinition["viewBox"];
          }
          return;
        }

        if (tag === "path") {
          const allowed = new Set(["d", "fill"]);
          for (const [name, value] of attributes) {
            if (!allowed.has(name)) {
              violations.push(`<path> has disallowed attribute ${name}`);
            }
            if (name === "fill" && value !== "currentColor") {
              violations.push(`<path> has disallowed fill ${value}`);
            }
          }
          const pathData = element.getAttribute("d")?.trim();
          if (
            !pathData ||
            !/^[0-9+\-.,\sAaCcHhLlMmQqSsTtVvZzEe]+$/.test(pathData)
          ) {
            violations.push("<path> has missing or invalid path data");
          } else {
            paths.push(pathData);
          }
          return;
        }

        violations.push(`disallowed <${tag}> element`);
      },
    })
    .onDocument({
      comments(comment) {
        const text = comment.text.trim();
        if (
          !text.includes(`Font Awesome Free ${EXPECTED.fontawesome}`) ||
          !text.includes("Copyright 2026 Fonticons, Inc.")
        ) {
          violations.push("unexpected SVG comment");
        }
        attributionCount += 1;
      },
      doctype() {
        doctypeCount += 1;
      },
      text(text) {
        if (text.text.trim() !== "") {
          violations.push("text content outside SVG paths");
        }
      },
    });

  await rewriter.transform(new Response(source)).text();

  if (doctypeCount !== 0) violations.push("DOCTYPE is not allowed");
  if (rootCount !== 1) violations.push(`expected one <svg>, found ${rootCount}`);
  if (attributionCount !== 1) {
    violations.push(`expected one attribution comment, found ${attributionCount}`);
  }
  if (paths.length === 0) violations.push("expected at least one <path>");
  if (!viewBox) violations.push("validated viewBox is missing");
  if (violations.length > 0 || !viewBox) {
    throw new Error(
      `Rejected Font Awesome source for ${kind} (${relative(projectRoot, path)}):\n${violations
        .map((violation) => `- ${violation}`)
        .join("\n")}`,
    );
  }

  return { viewBox, paths };
};

const walkFiles = async (root: string): Promise<string[]> => {
  if (!(await exists(root))) return [];
  const files: string[] = [];
  const visit = async (directory: string) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Generated roots must not contain symlinks: ${path}`);
      }
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        files.push(relative(root, path).split(sep).join("/"));
      } else {
        throw new Error(`Unexpected generated filesystem entry: ${path}`);
      }
    }
  };
  await visit(root);
  return files;
};

const compareTrees = async (expectedRoot: string, actualRoot: string) => {
  const expectedFiles = await walkFiles(expectedRoot);
  const actualFiles = await walkFiles(actualRoot);
  const expectedSet = new Set(expectedFiles);
  const actualSet = new Set(actualFiles);
  const failures: string[] = [];

  for (const path of expectedFiles) {
    if (!actualSet.has(path)) {
      failures.push(`missing: ${path}`);
      continue;
    }
    const [expected, actual] = await Promise.all([
      readFile(join(expectedRoot, path)),
      readFile(join(actualRoot, path)),
    ]);
    if (!actual.equals(expected)) failures.push(`stale: ${path}`);
  }
  for (const path of actualFiles) {
    if (!expectedSet.has(path)) failures.push(`unexpected: ${path}`);
  }
  return failures;
};

const replaceGeneratedRoots = async (
  replacements: { staged: string; target: string }[],
) => {
  const completed: {
    backup: string;
    hadTarget: boolean;
    target: string;
  }[] = [];
  try {
    for (const replacement of replacements) {
      const backup = `${replacement.target}.backup-${process.pid}`;
      await rm(backup, { force: true, recursive: true });
      const hadTarget = await exists(replacement.target);
      if (hadTarget) await rename(replacement.target, backup);
      try {
        await mkdir(dirname(replacement.target), { recursive: true });
        await rename(replacement.staged, replacement.target);
      } catch (error) {
        if (hadTarget) await rename(backup, replacement.target);
        throw error;
      }
      completed.push({ backup, hadTarget, target: replacement.target });
    }
  } catch (error) {
    for (const item of completed.reverse()) {
      await rm(item.target, { force: true, recursive: true });
      if (item.hadTarget && (await exists(item.backup))) {
        await rename(item.backup, item.target);
      }
    }
    throw error;
  }

  // The complete new output set is committed at this point. Backup cleanup is
  // deliberately outside the rollback block: a cleanup failure must never
  // discard valid new targets after earlier backups have already been removed.
  const cleanupFailures: string[] = [];
  for (const item of completed) {
    if (!item.hadTarget) continue;
    try {
      await rm(item.backup, { recursive: true });
    } catch (error) {
      cleanupFailures.push(
        `${item.backup}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (cleanupFailures.length > 0) {
    throw new Error(
      `Generated outputs were replaced, but backup cleanup failed:\n${cleanupFailures
        .map((failure) => `- ${failure}`)
        .join("\n")}`,
    );
  }
};

const stagingRoot = await mkdtemp(join(tmpdir(), "cvnewtheme-assets-"));
const stagedAssets = join(stagingRoot, "assets-generated");
const stagedStatic = join(stagingRoot, "static-generated");
const stagedFonts = join(stagedStatic, "fonts");
const fontManifestPath = join(stagingRoot, "font-build.json");

try {
  await Promise.all([
    mkdir(stagedAssets, { recursive: true }),
    mkdir(stagedFonts, { recursive: true }),
  ]);

  const uvCache = join(tmpdir(), "cvnewtheme-uv-cache");
  await run(
    [
      "uv",
      "run",
      "--frozen",
      "--offline",
      "--no-sync",
      "--python",
      EXPECTED.python,
      "python",
      "scripts/build-fonts.py",
      "--vendor-dir",
      "assets/vendor/mona-sans-v2.0.27",
      "--output-dir",
      stagedFonts,
      "--manifest",
      fontManifestPath,
    ],
    { UV_CACHE_DIR: uvCache, UV_OFFLINE: "1" },
  );

  const fontManifest = await readJson<FontBuildManifest>(fontManifestPath);
  if (
    fontManifest.pythonVersion !== EXPECTED.python ||
    fontManifest.fontToolsVersion !== EXPECTED.fontTools ||
    fontManifest.brotliVersion !== EXPECTED.brotli ||
    fontManifest.zopfliVersion !== EXPECTED.zopfli
  ) {
    throw new Error(
      `Unexpected font environment: Python ${fontManifest.pythonVersion}, ` +
        `FontTools ${fontManifest.fontToolsVersion}, Brotli ${fontManifest.brotliVersion}, ` +
        `Zopfli ${fontManifest.zopfliVersion}`,
    );
  }

  const fontFaces = Object.values(fontManifest.outputs)
    .sort((left, right) => {
      const styleOrder = { normal: 0, italic: 1 };
      const subsetOrder = { latin: 0, "latin-ext": 1 };
      return (
        styleOrder[left.style] - styleOrder[right.style] ||
        subsetOrder[left.subset] - subsetOrder[right.subset]
      );
    })
    .map(
      (font) =>
        `@font-face{font-family:"CV Resume Sans";src:url("fonts/${font.filename}") format("woff2");font-style:${font.style};font-weight:400 800;font-stretch:95% 100%;font-display:swap;unicode-range:${font.unicodeRange}}`,
    )
    .join("");

  const cssResult = sass.compile(
    join(projectRoot, "assets/scss/devresume.scss"),
    {
      loadPaths: [join(projectRoot, "node_modules")],
      quietDeps: true,
      sourceMap: false,
      style: "compressed",
    },
  );
  const css = Buffer.from(
    `${fontFaces}${cssResult.css.replace(/^\uFEFF/, "").trimEnd()}\n`,
  );

  const registry = {} as Record<SemanticIconKind, IconDefinition>;
  const iconProvenance = [] as {
    kind: SemanticIconKind;
    path: string;
    sha256: string;
  }[];
  const fontAwesomeRoot = join(
    projectRoot,
    "node_modules/@fortawesome/fontawesome-free",
  );
  for (const iconSource of iconSources) {
    const absolutePath = join(fontAwesomeRoot, iconSource.source);
    const source = await readFile(absolutePath);
    const actualSourceHash = digest(source);
    if (actualSourceHash !== iconSource.sha256) {
      throw new Error(
        `Font Awesome source hash mismatch for ${iconSource.source}: ${actualSourceHash}`,
      );
    }
    registry[iconSource.kind] = await parseIcon(iconSource.kind, absolutePath);
    iconProvenance.push({
      kind: iconSource.kind,
      path: iconSource.source,
      sha256: actualSourceHash,
    });
  }

  const iconJson = Buffer.from(`${JSON.stringify(registry, null, 2)}\n`);
  if (Object.keys(registry).length !== 8) {
    throw new Error(`Expected exactly 8 icons; generated ${Object.keys(registry).length}`);
  }
  if (iconJson.byteLength > 20_480) {
    throw new Error(
      `Generated icon registry is ${iconJson.byteLength} bytes; budget is 20480`,
    );
  }

  const monaLicense = await readFile(
    join(projectRoot, "assets/vendor/mona-sans-v2.0.27/OFL.txt"),
  );
  const fontAwesomeLicense = await readFile(
    join(fontAwesomeRoot, "LICENSE.txt"),
  );
  const bootstrapLicense = await readFile(
    join(projectRoot, "node_modules/bootstrap/LICENSE"),
  );
  const licenseOutputs = [
    {
      bytes: monaLicense.byteLength,
      filename: "MonaSans-OFL.txt",
      sha256: digest(monaLicense),
      source: "assets/vendor/mona-sans-v2.0.27/OFL.txt",
    },
    {
      bytes: fontAwesomeLicense.byteLength,
      filename: "FontAwesome-LICENSE.txt",
      sha256: digest(fontAwesomeLicense),
      source: "node_modules/@fortawesome/fontawesome-free/LICENSE.txt",
    },
  ];

  const thirdPartyNotices = Buffer.from(`# Third-Party Notices

This project contains redistributed and modified third-party assets. The
notices below supplement, but do not replace, the corresponding license files
published under \`static/generated/licenses/\`.

## CV Resume Sans

\`CV Resume Sans\` is a modified and subsetted derivative of Mona Sans ${fontManifest.sourceVersion},
copyright GitHub. It is generated from the official variable-font release by
freezing the optical-size axis, constraining the width and weight axes,
splitting Latin and Latin Extended repertoires, converting to WOFF2, and
renaming the family to comply with the Reserved Font Name requirement.

Mona Sans is licensed under the SIL Open Font License, Version 1.1. The full
license is published as \`static/generated/licenses/MonaSans-OFL.txt\`.

Source: https://github.com/github/mona-sans/releases/tag/v${fontManifest.sourceVersion}

## Font Awesome Free

The inline SVG path geometry for the eight resume-link icons is derived from
Font Awesome Free ${installedVersions.fontawesome}, copyright Fonticons, Inc. Font Awesome Free distributes
its icons under CC BY 4.0, its fonts under SIL OFL 1.1, and its code under the
MIT License.

The full package license is published as
\`static/generated/licenses/FontAwesome-LICENSE.txt\`.

Source: https://fontawesome.com
`);

  await Promise.all([
    writeFile(join(stagedAssets, "devresume.min.css"), css),
    writeFile(join(stagedAssets, "icons.json"), iconJson),
    writeFile(join(stagingRoot, "THIRD_PARTY_NOTICES.md"), thirdPartyNotices),
    mkdir(join(stagedStatic, "licenses"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(stagedStatic, "licenses/MonaSans-OFL.txt"), monaLicense),
    writeFile(
      join(stagedStatic, "licenses/FontAwesome-LICENSE.txt"),
      fontAwesomeLicense,
    ),
  ]);

  const fontOutputs = Object.values(fontManifest.outputs).map((font) => ({
    axes: font.axes,
    bytes: font.bytes,
    codepoints: font.codepoints,
    glyphs: font.glyphs,
    layoutFeatures: font.layoutFeatures,
    path: `static/generated/fonts/${font.filename}`,
    sha256: font.sha256,
    style: font.style,
    subset: font.subset,
    unicodeRange: font.unicodeRange,
  }));
  fontOutputs.sort((left, right) => left.path.localeCompare(right.path));

  const dependencyManifest = Buffer.from(
    `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedBy: {
          bun: process.versions.bun,
          brotli: fontManifest.brotliVersion,
          fontTools: fontManifest.fontToolsVersion,
          python: fontManifest.pythonVersion,
          sass: installedVersions.sass,
          uv: uvVersion,
          zopfli: fontManifest.zopfliVersion,
        },
        sources: {
          bootstrap: {
            license: "MIT",
            licenseSha256: digest(bootstrapLicense),
            package: "bootstrap",
            upstreamUrl: `https://github.com/twbs/bootstrap/releases/tag/v${installedVersions.bootstrap}`,
            version: installedVersions.bootstrap,
          },
          fontAwesome: {
            icons: iconProvenance,
            license: "(CC-BY-4.0 AND OFL-1.1 AND MIT)",
            licenseSha256: digest(fontAwesomeLicense),
            package: "@fortawesome/fontawesome-free",
            upstreamUrl: `https://github.com/FortAwesome/Font-Awesome/releases/tag/${installedVersions.fontawesome}`,
            version: installedVersions.fontawesome,
          },
          monaSans: {
            archiveUrl: `https://github.com/github/mona-sans/releases/download/v${fontManifest.sourceVersion}/mona-sans-variable-v${fontManifest.sourceVersion}.zip`,
            archiveSha256: fontManifest.sourceArchiveSha256,
            family: "Mona Sans",
            italicSource: {
              path: "assets/vendor/mona-sans-v2.0.27/MonaSansVF-Italic[wdth,opsz,wght].ttf",
              sha256:
                "a22a930591bff52f624a86e24f3172c51bb4c4b7fd252b07d170cdb163c4dea8",
            },
            license: "SIL Open Font License 1.1",
            licenseSha256: digest(monaLicense),
            normalSource: {
              path: "assets/vendor/mona-sans-v2.0.27/MonaSansVF[wdth,opsz,wght].ttf",
              sha256:
                "9d96bf1303b964cc9101ea2419de780204cb6ace16375b017b66d1fe98a3a435",
            },
            releaseUrl:
              "https://github.com/github/mona-sans/releases/tag/v2.0.27",
            version: fontManifest.sourceVersion,
          },
        },
        operations: {
          font: {
            familyRename: {
              family: "CV Resume Sans",
              postscriptPrefix: "CVResumeSans",
            },
            opticalSize: { frozen: 20 },
            declaredSubsets: fontManifest.declaredUnicodeRanges,
            overlapAssignment: fontManifest.overlapAssignment,
            subsets: {
              latin:
                fontManifest.outputs["cv-resume-sans-latin-normal.woff2"]
                  .unicodeRange,
              latinExt:
                fontManifest.outputs[
                  "cv-resume-sans-latin-ext-normal.woff2"
                ].unicodeRange,
            },
            weight: { default: 400, maximum: 800, minimum: 400 },
            width: { default: 100, maximum: 100, minimum: 95 },
          },
          icons: {
            count: Object.keys(registry).length,
            parser: "Bun.HTMLRewriter",
            policy: "svg[viewBox] plus path[d] geometry only",
          },
        },
        outputs: {
          css: {
            bytes: css.byteLength,
            path: "assets/generated/devresume.min.css",
            sha256: digest(css),
          },
          fonts: fontOutputs,
          icons: {
            budgetBytes: 20_480,
            bytes: iconJson.byteLength,
            count: Object.keys(registry).length,
            path: "assets/generated/icons.json",
            sha256: digest(iconJson),
          },
          licenses: licenseOutputs.map((license) => ({
            bytes: license.bytes,
            path: `static/generated/licenses/${license.filename}`,
            sha256: license.sha256,
            source: license.source,
          })),
          notices: {
            bytes: thirdPartyNotices.byteLength,
            path: "THIRD_PARTY_NOTICES.md",
            sha256: digest(thirdPartyNotices),
          },
        },
        budgets: fontManifest.totals,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(stagedAssets, "dependencies.json"),
    dependencyManifest,
  );

  const targets = [
    {
      kind: "tree" as const,
      label: "assets/generated",
      staged: stagedAssets,
      target: join(projectRoot, "assets/generated"),
    },
    {
      kind: "tree" as const,
      label: "static/generated",
      staged: stagedStatic,
      target: join(projectRoot, "static/generated"),
    },
    {
      kind: "file" as const,
      label: "THIRD_PARTY_NOTICES.md",
      staged: join(stagingRoot, "THIRD_PARTY_NOTICES.md"),
      target: join(projectRoot, "THIRD_PARTY_NOTICES.md"),
    },
  ];

  if (checkOnly) {
    const failures: string[] = [];
    for (const target of targets) {
      if (target.kind === "tree") {
        const differences = await compareTrees(target.staged, target.target);
        failures.push(...differences.map((value) => `${target.label}/${value}`));
      } else if (!(await exists(target.target))) {
        failures.push(`missing: ${target.label}`);
      } else {
        const [expected, actual] = await Promise.all([
          readFile(target.staged),
          readFile(target.target),
        ]);
        if (!actual.equals(expected)) failures.push(`stale: ${target.label}`);
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `Generated assets are missing, stale, or unexpected:\n${failures
          .map((failure) => `- ${failure}`)
          .join("\n")}\nRun \`bun run build:assets\` and commit the results.`,
      );
    }
    console.log(
      `Generated assets are current: ${fontManifest.totals.totalBytes} font bytes and ${iconJson.byteLength} icon-registry bytes.`,
    );
  } else {
    await replaceGeneratedRoots(targets);
    console.log(
      `Built CV Resume Sans ${fontManifest.sourceVersion} (${fontManifest.totals.totalBytes} bytes), ` +
        `${Object.keys(registry).length} Font Awesome ${installedVersions.fontawesome} icons (${iconJson.byteLength} bytes), ` +
        `and Bootstrap ${installedVersions.bootstrap} CSS with Sass ${installedVersions.sass}.`,
    );
  }
} finally {
  await rm(stagingRoot, { force: true, recursive: true });
}
