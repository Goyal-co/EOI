import { readFileSync, existsSync } from "fs";
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile(".env.local");

const { sendEmail, shouldUseMockEmail } = await import("@goyal/email");

const to = process.argv[2] || "partner@goyalprojects.com";
console.log("BREVO_API_KEY:", process.env.BREVO_API_KEY ? "set" : "MISSING");
console.log("EMAIL_FROM:", process.env.EMAIL_FROM);
console.log("Mock mode:", shouldUseMockEmail());

const result = await sendEmail({
  to,
  subject: "Goyal EOI — Brevo integration test",
  html: `<p>Test from app email service. <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}">Open portal</a></p>`,
});

console.log("Result:", JSON.stringify(result, null, 2));
