import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

import { assertExactHugoVersion } from "./hugo-version";

type Options = {
  configuredTheme: boolean;
  port: number;
  source: string;
};

const projectRoot = resolve(import.meta.dir, "..");

function usage(message?: string): never {
  if (message) {
    console.error(message);
  }
  console.error(
    "Usage: bun scripts/preview-test.ts --source <site> [--port <port>] [--configured-theme]",
  );
  process.exit(2);
}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    configuredTheme: false,
    port: 4173,
    source: "tests/fixtures/max-content",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") {
      continue;
    }
    if (argument === "--configured-theme") {
      options.configuredTheme = true;
      continue;
    }
    if (argument === "--source") {
      const value = argv[index + 1];
      if (!value) usage("--source requires a path.");
      options.source = value;
      index += 1;
      continue;
    }
    if (argument === "--port") {
      const value = argv[index + 1];
      if (!value) usage("--port requires a value.");
      options.port = Number.parseInt(value, 10);
      index += 1;
      continue;
    }
    usage(`Unknown argument: ${argument}`);
  }

  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) {
    usage("--port must be an integer between 1024 and 65535.");
  }

  options.source = resolve(projectRoot, options.source);
  return options;
}

const options = parseOptions(process.argv.slice(2));
await assertExactHugoVersion(projectRoot);
await access(options.source, constants.R_OK);

const argumentsForHugo = [
  "hugo",
  "server",
  "--source",
  options.source,
  "--bind",
  "127.0.0.1",
  "--port",
  String(options.port),
  "--baseURL",
  `http://127.0.0.1:${options.port}/`,
  "--disableFastRender",
  "--renderToMemory",
  "--gc",
  "--ignoreCache",
  "--noBuildLock",
  "--noHTTPCache",
  "--panicOnWarning",
];

if (!options.configuredTheme) {
  argumentsForHugo.push(
    "--themesDir",
    resolve(projectRoot, ".."),
    "--theme",
    "cvnewtheme",
  );
}

const hugo = Bun.spawn(argumentsForHugo, {
  cwd: projectRoot,
  env: process.env,
  stderr: "inherit",
  stdout: "inherit",
});

let stopping = false;
const stop = (signal: NodeJS.Signals) => {
  if (stopping) return;
  stopping = true;
  hugo.kill(signal);
};

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));

process.exit(await hugo.exited);
