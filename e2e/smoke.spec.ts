import { expect, test, type Page, type Route } from "@playwright/test"

// NABH DAC.1.c: run in Chrome, Edge, Firefox, Safari (WebKit) and on phone
// sizes by playwright.config.ts. The API is mocked here, so these check the
// browser side only: rendering, forms, fetch/CORS, Web Crypto, layout.

const API = "http://api.e2e.test/api/v1"
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
}

type Handler = (route: Route, body: unknown) => unknown

async function mockApi(page: Page, handlers: Record<string, Handler | unknown>) {
  await page.route(`${API}/**`, async (route) => {
    const req = route.request()
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors })
    const path = new URL(req.url()).pathname.replace("/api/v1", "")
    const key = Object.keys(handlers).find((k) => path === k || (k.endsWith("*") && path.startsWith(k.slice(0, -1))))
    if (!key) return route.fulfill({ status: 404, headers: cors, json: { detail: "Not found." } })
    const h = handlers[key]
    const body = req.postData() ? JSON.parse(req.postData() as string) : undefined
    const result = typeof h === "function" ? await (h as Handler)(route, body) : h
    return route.fulfill({ status: 200, headers: cors, json: result })
  })
}

async function noSideways(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test("staff sign-in page works", async ({ page }) => {
  await mockApi(page, {})
  await page.goto("/login")
  const email = page.locator("#login-email")
  await expect(email).toBeVisible()
  await email.fill("doctor@hospital.example")
  await page.locator("#login-password").fill("secret-pass")
  await page.getByRole("button", { name: "Show the password" }).click()
  await expect(page.locator("#login-password")).toHaveAttribute("type", "text")
  await noSideways(page)
})

test("browser supports the encryption the app uses (ECDH P-256, HKDF, AES-256-GCM)", async ({ page }) => {
  await mockApi(page, {})
  await page.goto("/login")
  const roundTrip = await page.evaluate(async () => {
    const s = crypto.subtle
    const ecdh = { name: "ECDH", namedCurve: "P-256" }
    const client = await s.generateKey(ecdh, true, ["deriveBits"])
    const server = await s.generateKey(ecdh, true, ["deriveBits"])
    const serverPub = await s.importKey("raw", await s.exportKey("raw", server.publicKey), ecdh, false, [])
    const bits = await s.deriveBits({ name: "ECDH", public: serverPub }, client.privateKey, 256)
    const hkdf = await s.importKey("raw", bits, "HKDF", false, ["deriveKey"])
    const key = await s.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(16), info: new TextEncoder().encode("e2e") },
      hkdf, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const sealed = await s.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("vitals 120/80"))
    return new TextDecoder().decode(await s.decrypt({ name: "AES-GCM", iv }, key, sealed))
  })
  expect(roundTrip).toBe("vitals 120/80")
})

test("patient signs in to the portal and pays a bill online", async ({ page }) => {
  let paidRequest: unknown = null
  await mockApi(page, {
    "/portal/auth/request-otp/": { sent: true },
    "/portal/auth/verify-otp/": { token: "portal-token", patients: [{ id: 7, name: "Asha Rao" }] },
    "/portal/me/": { hospital: "City Hospital", patients: [{ id: 7, name: "Asha Rao", uhid: "CH-000007" }] },
    "/portal/appointments/": [],
    "/portal/bills/": { outstanding: 1500, bills: [{ id: 31, date: "2026-10-12T10:00:00Z", net_amount: 1500, paid: 0, balance: 1500, status: "issued", items: [] }] },
    "/portal/bills/31/pay/": (_route: Route, body: unknown) => {
      paidRequest = body
      return { pay_url: "http://pay.e2e.test/checkout/plink_1", amount: 1500 }
    },
  })
  await page.route("http://pay.e2e.test/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Razorpay checkout</h1>" }))

  await page.goto("/portal")
  await page.getByPlaceholder("Hospital code").fill("city-hospital")
  await page.getByPlaceholder("Mobile number").fill("9811100051")
  await page.getByRole("button", { name: "Send OTP" }).click()
  await page.getByPlaceholder("6-digit OTP").fill("123456")
  await page.getByRole("button", { name: "Verify & sign in" }).click()
  await expect(page.getByText("City Hospital")).toBeVisible()
  await noSideways(page)

  await page.getByRole("button", { name: "Bills", exact: true }).click()
  await page.getByRole("button", { name: "Pay ₹1500 online" }).click()
  await expect(page.getByRole("heading", { name: "Razorpay checkout" })).toBeVisible()
  expect(paidRequest).toEqual({ patient: 7 })
})

test("patient uploads a missing document from the portal", async ({ page }) => {
  let uploaded = ""
  await mockApi(page, {
    "/portal/auth/request-otp/": { sent: true },
    "/portal/auth/verify-otp/": { token: "portal-token", patients: [{ id: 7, name: "Asha Rao" }] },
    "/portal/me/": { hospital: "City Hospital", patients: [{ id: 7, name: "Asha Rao", uhid: "CH-000007" }] },
    "/portal/appointments/": [],
  })
  // Registered after mockApi so it wins for this path (Playwright: last route first).
  await page.route("http://api.e2e.test/api/v1/portal/documents/**", async (route) => {
    const req = route.request()
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" }
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors })
    if (req.method() === "POST") {
      uploaded = req.headers()["content-type"] || ""
      return route.fulfill({ status: 201, headers: cors, json: { id: 1, requirement: 3 } })
    }
    return route.fulfill({ status: 200, headers: cors, json: { stages: [{ stage: "registration", stage_label: "Registration", items: [
      { requirement: 3, name: "Photo ID", required: true, satisfied: false },
    ] }] } })
  })
  await page.goto("/portal")
  await page.getByPlaceholder("Hospital code").fill("city-hospital")
  await page.getByPlaceholder("Mobile number").fill("9811100051")
  await page.getByRole("button", { name: "Send OTP" }).click()
  await page.getByPlaceholder("6-digit OTP").fill("123456")
  await page.getByRole("button", { name: "Verify & sign in" }).click()
  await page.getByRole("button", { name: "Documents", exact: true }).click()
  await expect(page.getByText("Documents for registration")).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles({ name: "aadhaar.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") })
  await expect(page.getByText('"Photo ID" uploaded')).toBeVisible()
  expect(uploaded).toContain("multipart/form-data")
})
