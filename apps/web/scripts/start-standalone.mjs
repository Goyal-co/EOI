import { readFileSync, existsSync, cpSync } from "fs";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(file) {
  const path = join(root, file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

// Load env: .env.production overrides .env.local for prod-like runs
loadEnvFile(".env.local");
loadEnvFile(".env.production");

process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.PORT = process.env.PORT || "3000";
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";

const standaloneRoot = join(root, ".next/standalone");
const serverPath = join(standaloneRoot, "apps/web/server.js");

if (!existsSync(serverPath)) {
  console.error("Standalone build not found. Run: npm run build");
  process.exit(1);
}

// Next.js standalone does not bundle public/ or .next/static — copy them in
const copies = [
  [join(root, "public"), join(standaloneRoot, "apps/web/public")],
  [join(root, ".next/static"), join(standaloneRoot, "apps/web/.next/static")],
];

for (const [src, dest] of copies) {
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
  }
}

console.log(`Starting standalone server on http://${process.env.HOSTNAME}:${process.env.PORT}`);
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? "set" : "MISSING"}`);
console.log(`BREVO_API_KEY: ${process.env.BREVO_API_KEY ? "set" : "MISSING"}`);
console.log(`EMAIL_FROM: ${process.env.EMAIL_FROM || "MISSING"}`);

const child = spawn(process.execPath, ["apps/web/server.js"], {
  cwd: standaloneRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
