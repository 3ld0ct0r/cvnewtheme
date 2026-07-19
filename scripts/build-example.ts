import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { assertExactHugoVersion } from "./hugo-version";

const projectRoot = resolve(import.meta.dir, "..");
const exampleSite = join(projectRoot, "exampleSite");
const cacheDirectory = join(projectRoot, ".cache/hugo");

await mkdir(cacheDirectory, { recursive: true });
await assertExactHugoVersion(projectRoot);

const hugo = Bun.spawn(
  [
    "hugo",
    "--source",
    exampleSite,
    "--themesDir",
    resolve(projectRoot, ".."),
    "--theme",
    "cvnewtheme",
    "--destination",
    join(exampleSite, "public"),
    "--cleanDestinationDir",
    "--cacheDir",
    cacheDirectory,
    "--gc",
    "--ignoreCache",
    "--minify",
    "--noBuildLock",
    "--panicOnWarning",
  ],
  {
    cwd: projectRoot,
    stderr: "inherit",
    stdout: "inherit",
  },
);

process.exit(await hugo.exited);
