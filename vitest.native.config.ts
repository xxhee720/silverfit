import { defineConfig } from "vitest/config";
// Requires both root dependencies and `cd mobile && pnpm install`.
export default defineConfig({
  test: { include: ["native-tests/**/*.test.ts"], testTimeout: 30000 },
});
