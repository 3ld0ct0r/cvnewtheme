import { defineConfig, type Project } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const host = "127.0.0.1";
const maxContentURL = `http://${host}:4173`;
const fontBasicURL = `http://${host}:4174`;
const overlongURL = `http://${host}:4175`;
const consumerURL = `http://${host}:4176`;
const exampleSiteURL = `http://${host}:4177`;

const viewportMatrix = [
  { name: "320x800", width: 320, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "991x1080", width: 991, height: 1080 },
  { name: "992x1080", width: 992, height: 1080 },
  { name: "1200x1200", width: 1200, height: 1200 },
  { name: "1440x1200", width: 1440, height: 1200 },
] as const;

const browserNames = ["chromium", "firefox", "webkit"] as const;

const browserProjects: Project[] = browserNames.flatMap((browserName) =>
  viewportMatrix.map(({ name, width, height }) => ({
    name: `${browserName}-${name}`,
    testMatch: /browser\.spec\.ts/,
    use: {
      baseURL: maxContentURL,
      browserName,
      viewport: { width, height },
    },
  })),
);

const consumerSource = process.env.CVNEW_THEME_CONSUMER_SOURCE;
const consumerMode = process.env.CVNEW_THEME_CONSUMER_MODE ?? "adjacent";

function quoteForShell(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

const fixtureServer = (source: string, port: number) => ({
  command: `bun scripts/preview-test.ts --source ${quoteForShell(source)} --port ${port}`,
  reuseExistingServer: !process.env.CI,
  stderr: "pipe" as const,
  stdout: "pipe" as const,
  timeout: 120_000,
  url: `http://${host}:${port}`,
});

const consumerServer = {
  command: [
    "bun scripts/preview-test.ts",
    `--source ${quoteForShell(consumerSource ?? "tests/fixtures/max-content")}`,
    "--port 4176",
    consumerMode === "configured" ? "--configured-theme" : "",
  ]
    .filter(Boolean)
    .join(" "),
  reuseExistingServer: !process.env.CI,
  stderr: "pipe" as const,
  stdout: "pipe" as const,
  timeout: 120_000,
  url: consumerURL,
};

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir: "test-results",
  projects: consumerSource
    ? [
        {
          name: "consumer-chromium",
          testMatch: /consumer\.spec\.ts/,
          use: {
            baseURL: consumerURL,
            browserName: "chromium",
            viewport: { height: 1200, width: 1440 },
          },
        },
      ]
    : [
        ...browserProjects,
        {
          name: "pdf-chromium",
          testMatch: /pdf\.spec\.ts/,
          use: {
            baseURL: maxContentURL,
            browserName: "chromium",
            viewport: { height: 1200, width: 1440 },
          },
        },
      ],
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  retries: process.env.CI ? 1 : 0,
  testDir: resolve(projectRoot, "tests/browser"),
  timeout: 45_000,
  use: {
    actionTimeout: 10_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: consumerSource
    ? consumerServer
    : [
        fixtureServer("tests/fixtures/max-content", 4173),
        fixtureServer("tests/fixtures/font-basic", 4174),
        fixtureServer("tests/fixtures/overlong", 4175),
        fixtureServer("exampleSite", 4177),
      ],
  workers: process.env.CI ? 2 : undefined,
});

export {
  consumerURL,
  exampleSiteURL,
  fontBasicURL,
  maxContentURL,
  overlongURL,
};
