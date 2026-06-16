import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: [
      "src/**/*.test.ts",
      "../../packages/types/src/**/*.test.ts",
    ],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@goyal/types": path.resolve(__dirname, "../../packages/types/src"),
    },
  },
});
