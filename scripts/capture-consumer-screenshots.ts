import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { chromium } from "@playwright/test";

type Capture = {
  filename: string;
  height: number;
  width: number;
};

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
    "Usage: bun run capture:consumer-screenshots -- <site-source> [--configured-theme]",
  );
  process.exit(2);
}

const source = resolve(projectRoot, sourceArgument);
await access(source, constants.R_OK);
const consumerName = basename(source);

const captures: Capture[] = [
  {
    filename: `${consumerName}-mobile-390x844.png`,
    height: 844,
    width: 390,
  },
  {
    filename: `${consumerName}-desktop-1440x1200.png`,
    height: 1200,
    width: 1440,
  },
];
const outputDirectory = join(source, "docs", "screenshots");
await mkdir(outputDirectory, { recursive: true });

const port = 4178;
const baseURL = `http://127.0.0.1:${port}/`;
const serverArguments = [
  process.execPath,
  "scripts/preview-test.ts",
  "--source",
  source,
  "--port",
  String(port),
];
if (configuredTheme) serverArguments.push("--configured-theme");

const server = Bun.spawn(serverArguments, {
  cwd: projectRoot,
  env: process.env,
  stderr: "inherit",
  stdout: "inherit",
});
let serverExitCode: number | undefined;
void server.exited.then((code) => {
  serverExitCode = code;
});

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (serverExitCode !== undefined) {
      throw new Error(`Hugo preview exited early with code ${serverExitCode}.`);
    }
    try {
      const response = await fetch(baseURL, { redirect: "manual" });
      if (response.ok) return;
    } catch {
      // Hugo is still starting.
    }
    await Bun.sleep(100);
  }
  throw new Error(`Timed out waiting for ${baseURL}.`);
}

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await waitForServer();
  browser = await chromium.launch();
  for (const capture of captures) {
    const context = await browser.newContext({
      colorScheme: "light",
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
      viewport: { height: capture.height, width: capture.width },
    });
    try {
      const page = await context.newPage();
      await page.goto(baseURL, { waitUntil: "networkidle" });
      await page.evaluate(async () => document.fonts.ready);
      const output = join(outputDirectory, capture.filename);
      await page.screenshot({
        animations: "disabled",
        fullPage: false,
        path: output,
      });
      console.log(`Captured ${capture.width}x${capture.height}: ${output}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await server.exited;
}
