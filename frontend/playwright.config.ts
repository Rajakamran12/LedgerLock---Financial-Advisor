import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Playwright runs as a standalone Node process (not through Next.js), so it
// doesn't get .env.local loaded automatically the way `next dev`/`next build`
// do. Parse it manually here rather than pulling in an extra dependency.
function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const contents = readFileSync(filePath, "utf-8");
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(__dirname, ".env.local"));

// Ensure the launched dev servers inherit this flag so server routes use stubs.
if (!process.env.PLAYWRIGHT_TEST) process.env.PLAYWRIGHT_TEST = "1";
if (!process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST) process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST = "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  globalSetup: require.resolve("./e2e/global-setup.ts"),
  globalTeardown: require.resolve("./e2e/global-teardown.ts"),
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      cwd: __dirname,
      url: "http://localhost:3000",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PLAYWRIGHT_TEST: "1",
        NEXT_PUBLIC_PLAYWRIGHT_TEST: "1",
      },
    },
    {
      command:
        (() => {
          if (process.platform === "win32") {
            const py = path.resolve(__dirname, "../agent/.venv/Scripts/python.exe");
            return `${py} -m uvicorn main:app --host 127.0.0.1 --port 8000`;
          }
          const py = path.resolve(__dirname, "../agent/.venv/bin/python");
          return `${py} -m uvicorn main:app --host 127.0.0.1 --port 8000`;
        })(),
      cwd: path.resolve(__dirname, "../agent"),
      url: "http://127.0.0.1:8000/health",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PLAYWRIGHT_TEST: "1",
        NEXT_PUBLIC_PLAYWRIGHT_TEST: "1",
      },
    },
  ],
});
