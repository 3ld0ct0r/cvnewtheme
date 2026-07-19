import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const argumentsFromCli = process.argv.slice(2).filter((value) => value !== "--");
const configuredThemeIndex = argumentsFromCli.indexOf("--configured-theme");
const configuredTheme = configuredThemeIndex >= 0;

if (configuredTheme) {
  argumentsFromCli.splice(configuredThemeIndex, 1);
}

const sourceArgument = argumentsFromCli[0];
if (!sourceArgument || argumentsFromCli.length !== 1) {
  console.error(
    "Usage: bun run test:consumer -- <site-source> [--configured-theme]",
  );
  process.exit(2);
}

const source = resolve(projectRoot, sourceArgument);
await access(source, constants.R_OK);

const playwright = Bun.spawn(
  [
    "bunx",
    "playwright",
    "test",
    "--config",
    "playwright.config.ts",
    "--project",
    "consumer-chromium",
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      CVNEW_THEME_CONSUMER_MODE: configuredTheme ? "configured" : "adjacent",
      CVNEW_THEME_CONSUMER_SOURCE: source,
    },
    stderr: "inherit",
    stdout: "inherit",
  },
);

process.exit(await playwright.exited);
