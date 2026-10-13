import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const root = resolve(__dirname, "../..")

// NABH DAC.1.b, DAC.1.f: the app scales to phones and tablets and installs as an app.
describe("installable, responsive web app", () => {
  it("declares a standalone web-app manifest with an icon", () => {
    const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.webmanifest"), "utf-8"))
    expect(manifest.display).toBe("standalone")
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  it("links the manifest and sets a device-width viewport", () => {
    const html = readFileSync(resolve(root, "index.html"), "utf-8")
    expect(html).toMatch(/<link[^>]+rel="manifest"[^>]+manifest\.webmanifest/)
    expect(html).toMatch(/name="viewport"[^>]+width=device-width/)
  })
})
