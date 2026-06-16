import { execSync } from "child_process";
import path from "path";

export default async function globalSetup() {
  const dbPath = path.resolve(__dirname, "../../../packages/db");
  const databaseUrl = process.env.DATABASE_URL || "postgresql://goyal:goyal_dev_password@localhost:5433/goyal_eoi?schema=public";

  try {
    execSync("npx tsx prisma/seed.ts", {
      cwd: dbPath,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });
  } catch {
    console.warn("Seed skipped — ensure PostgreSQL is running on port 5433");
  }
}
