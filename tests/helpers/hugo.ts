import { constants } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const projectRoot = resolve(import.meta.dir, "../..");

export type HugoBuildResult = {
  cleanup: () => Promise<void>;
  destination: string;
  exitCode: number;
  readOutput: (path?: string) => Promise<string>;
  root: string;
  stderr: string;
  stdout: string;
};

type TemporarySiteOptions = {
  config: string;
  directories?: string[];
  files?: Record<string, string | Uint8Array>;
};

export async function buildTemporarySite({
  config,
  directories = [],
  files = {},
}: TemporarySiteOptions): Promise<HugoBuildResult> {
  const root = await mkdtemp(join(tmpdir(), "cvnewtheme-contract-"));
  const source = join(root, "site");
  const destination = join(root, "public");
  const cache = join(root, "cache");

  await mkdir(source, { recursive: true });
  await writeFile(join(source, "config.toml"), config);

  for (const directory of directories) {
    await mkdir(join(source, directory), { recursive: true });
  }

  for (const [relativePath, contents] of Object.entries(files)) {
    const path = join(source, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }

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
      cache,
      "--gc",
      "--ignoreCache",
      "--panicOnWarning",
      "--noBuildLock",
    ],
    {
      cwd: root,
      stderr: "pipe",
      stdout: "pipe",
    },
  );

  const [exitCode, stdout, stderr] = await Promise.all([
    hugo.exited,
    new Response(hugo.stdout).text(),
    new Response(hugo.stderr).text(),
  ]);

  return {
    cleanup: () => rm(root, { force: true, recursive: true }),
    destination,
    exitCode,
    readOutput: async (path = "index.html") =>
      readFile(join(destination, path), "utf8"),
    root,
    stderr,
    stdout,
  };
}

export async function samplePdf(): Promise<Uint8Array> {
  const path = join(
    projectRoot,
    "tests/fixtures/max-content/static/resume.pdf",
  );
  await access(path, constants.R_OK);
  return readFile(path);
}

export function requireSuccessfulBuild(result: HugoBuildResult): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `Hugo build failed with exit code ${result.exitCode}.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
}
