import { existsSync, readFileSync } from "fs";
import { join } from "path";

const nextDir = join(process.cwd(), ".next");
const buildIdPath = join(nextDir, "BUILD_ID");
const standalonePath = join(nextDir, "standalone");

if (existsSync(buildIdPath) && existsSync(standalonePath)) {
  const buildId = readFileSync(buildIdPath, "utf8").trim();
  console.error(
    "\n[dev] Stale production build detected in .next (BUILD_ID: %s).\n"
    + "Run: npm run dev:clean\n"
    + "Never run `npm run build` while `npm run dev` is active.\n",
    buildId
  );
  process.exit(1);
}
