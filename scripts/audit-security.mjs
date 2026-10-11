import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { relative, resolve } from "node:path";

// Read-only checks. Reports locations/rules, never credential values or source lines.
const root = resolve(new URL("..", import.meta.url).pathname);
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
const files = [
  ...new Set(
    git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean),
  ),
];
const tracked = new Set(git("ls-files", "-z").split("\0").filter(Boolean));
const findings = [];
const report = (path, rule, line) => findings.push({ path, rule, ...(line ? { line } : {}) });
const patterns = [
  ["supabase-secret", /\bsb_secret_[A-Za-z0-9_-]{16,}/g],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/g],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["stripe-secret", /\bsk_(?:live|test)_[A-Za-z0-9]{16,}/g],
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];
let sourceFiles = 0,
  bundleFiles = 0;
function scan(path, text) {
  for (const [rule, expression] of patterns) {
    expression.lastIndex = 0;
    for (const match of text.matchAll(expression))
      report(path, rule, text.slice(0, match.index).split("\n").length);
  }
  // Legacy Supabase service_role JWTs are secrets; anon/public JWTs are expected.
  for (const match of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      const payload = JSON.parse(Buffer.from(match[0].split(".")[1], "base64url").toString());
      if (payload.role === "service_role" || (payload.role === "authenticated" && payload.sub))
        report(path, "private-jwt", text.slice(0, match.index).split("\n").length);
    } catch {
      /* Other strings are not valid JWT payloads. */
    }
  }
}
for (const file of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith(".env.example"))
    report(file, "env-in-repository");
  if (
    !/\.(?:[cm]?[jt]sx?|json|md|sql|toml|ya?ml|txt|html|css)$/.test(file) &&
    !file.endsWith(".env.example")
  )
    continue;
  const path = resolve(root, file);
  if (!existsSync(path) || statSync(path).size > 5 * 1024 * 1024) continue;
  scan(file, readFileSync(path, "utf8"));
  sourceFiles++;
}
const historyEnvPaths = [
  ...new Set(
    git("log", "--all", "--format=", "--name-only", "--", ".env", ".env.*", "**/.env", "**/.env.*")
      .split("\n")
      .filter((p) => p && !p.endsWith(".env.example")),
  ),
];
for (const path of historyEnvPaths) report(path, "env-in-git-history");

const privateValues = [];
const environmentFiles = readdirSync(root).filter(
  (p) => p.startsWith(".env") && p !== ".env.example",
);
for (const file of environmentFiles) {
  if (tracked.has(file)) report(file, "tracked-private-environment");
  try {
    git("check-ignore", "-q", file);
  } catch {
    report(file, "environment-not-ignored");
  }
  const text = readFileSync(resolve(root, file), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, name, raw] = match;
    let value = raw.trim().replace(/^['"]|['"]$/g, "");
    try {
      if (raw.trim().startsWith('"')) value = JSON.parse(raw.trim());
    } catch {
      /* dotenv literal */
    }
    if (name.startsWith("VITE_") && /SECRET|TOKEN|PASSWORD|SERVICE_ROLE|PRIVATE/.test(name))
      report(file, "private-browser-variable");
    if (
      /SECRET|TOKEN|PASSWORD|PRIVATE/.test(name) &&
      !name.startsWith("VITE_") &&
      value.length >= 20
    )
      privateValues.push(value);
    if (name.startsWith("VITE_")) scan(file, value);
  }
}
const staticRoot = resolve(root, ".vercel/output/static");
function scanStatic(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name),
      label = relative(root, path);
    if (entry.isDirectory()) {
      scanStatic(path);
      continue;
    }
    if (entry.name.startsWith(".env")) report(label, "public-environment-file");
    if (!/\.(?:js|mjs|json|html|map|txt|css)$/.test(entry.name)) continue;
    const text = readFileSync(path, "utf8");
    scan(label, text);
    bundleFiles++;
    if (privateValues.some((value) => text.includes(value)))
      report(label, "private-env-value-in-browser-bundle");
  }
}
if (existsSync(staticRoot)) scanStatic(staticRoot);
console.log(
  JSON.stringify(
    {
      sourceFiles,
      bundleFiles,
      localEnvironmentFiles: environmentFiles.length,
      historyEnvPaths: historyEnvPaths.length,
      findings,
      limits:
        "Pattern checks and private local-value comparison; not a complete credential scanner or a hosted RLS audit.",
    },
    null,
    2,
  ),
);
if (!bundleFiles) {
  console.error("Build VERCEL=1 before checking the browser bundle.");
  process.exitCode = 1;
}
if (findings.length) process.exitCode = 1;
