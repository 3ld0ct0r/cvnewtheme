export const EXPECTED_HUGO_VERSION = "0.164.0";

export type HugoVersion = {
  output: string;
  version: string;
};

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

  const match = output.match(/\bhugo v(\d+\.\d+\.\d+)((?:\+[A-Za-z0-9.-]+)*)\b/);
  const version = match?.[1];
  const capabilities = match?.[2]
    .split("+")
    .filter(Boolean);

  if (version !== EXPECTED_HUGO_VERSION || !capabilities?.includes("extended")) {
    throw new Error(
      `Hugo ${EXPECTED_HUGO_VERSION} Extended is required; found ${output || "unparseable output"}.`,
    );
  }

  return { output, version };
}
