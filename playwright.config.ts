import { defineConfig, devices } from "@playwright/test"

/** NABH DAC.1.c: the same smoke suite in Chromium (Chrome), Edge, Firefox and
 *  WebKit (Safari's engine), on desktop and phone sizes. The API is mocked in
 *  each spec, so no backend is needed: `npm run test:browsers`. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npx vite build --mode e2e && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { VITE_API_BASE_URL: "http://api.e2e.test/api/v1" },
  },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "safari", use: { ...devices["Desktop Safari"] } },
    { name: "android-phone", use: { ...devices["Pixel 7"] } },
    { name: "iphone", use: { ...devices["iPhone 14"] } },
  ],
})
