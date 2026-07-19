export const EXPECTED_HUGO_VERSION = "0.164.0";

export type HugoVersion = {
  output: string;
  version: string;
};

export type ParsedHugoVersion = {
  capabilities: string[];
  revision?: string;
  version: string;
};

export function parseHugoVersion(output: string): ParsedHugoVersion | null {
  const match = output.match(
    /\bhugo v(\d+\.\d+\.\d+)(?:-([0-9a-f]{40}))?((?:\+[A-Za-z0-9.-]+)*)(?=\s|$)/,
  );
  if (!match) return null;

  return {
    capabilities: match[3].split("+").filter(Boolean),
    ...(match[2] ? { revision: match[2] } : {}),
    version: match[1],
  };
}

export async function assertExactHugoVersion(cwd: string): Promise<HugoVersion> {
  const process = Bun.spawn(["hugo", "version"], {
    cwd,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  const output = `${stdout}${stderr}`.trim();

  if (exitCode !== 0) {
    throw new Error(
      `Hugo ${EXPECTED_HUGO_VERSION} Extended is required; \`hugo version\` exited ${exitCode}${
        output ? `:\n${output}` : "."
      }`,
    );
  }

  const parsed = parseHugoVersion(output);

  if (
    !parsed ||
    parsed.version !== EXPECTED_HUGO_VERSION ||
    !parsed.capabilities.includes("extended")
  ) {
    throw new Error(
      `Hugo ${EXPECTED_HUGO_VERSION} Extended is required; found ${output || "unparseable output"}.`,
    );
  }

  return { output, version: parsed.version };
}
