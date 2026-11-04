// @vitest-environment node
// Node, not jsdom: jsdom's FormData can't be encoded by Response, a browser's can.
import { afterEach, expect, it, vi } from "vitest"

vi.mock("./payloadCrypto", () => ({
  ensureSession: async () => {},
  resetSession: async () => {},
  getSessionId: () => "sess-1",
  isSessionReady: () => true,
  encryptPayload: async (data: unknown) => ({ enc: JSON.stringify(data) }),
  encryptBytes: async (bytes: Uint8Array) => `gcm2$${Buffer.from(bytes).toString("base64")}`,
  decryptBytes: async () => new ArrayBuffer(0),
}))

afterEach(() => vi.unstubAllGlobals())

it("encrypts file uploads, and recognises a FormData without being told", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }))
  vi.stubGlobal("fetch", fetchMock)
  const form = new FormData()
  form.append("title", "Discharge summary")
  form.append("file", new Blob(["secret scan"], { type: "application/pdf" }), "scan.pdf")

  const { api } = await import("./client")
  await api.post("/documents/", form)

  const [, options] = fetchMock.mock.calls[0]
  expect(options.headers["Content-Type"]).toBe("application/json")
  expect(options.body).not.toContain("secret scan")
  const sent = JSON.parse(options.body)
  expect(sent.ct).toMatch(/^multipart\/form-data; boundary=/)
  expect(Buffer.from(sent.enc.slice(5), "base64").toString()).toContain("secret scan")
})
