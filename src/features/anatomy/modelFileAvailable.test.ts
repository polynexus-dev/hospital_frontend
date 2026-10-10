import { afterEach, describe, expect, it, vi } from "vitest"
import { modelFileAvailable } from "./AnatomyExplorerPage"

function respond(status: number, contentType: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status, headers: { "content-type": contentType } })))
}

describe("modelFileAvailable", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("is true for a real model file", async () => {
    respond(200, "model/gltf-binary")
    expect(await modelFileAvailable("/models/x.glb")).toBe(true)
  })

  it("is false when the server falls back to the app's index.html", async () => {
    respond(200, "text/html; charset=utf-8")
    expect(await modelFileAvailable("/models/x.glb")).toBe(false)
  })

  it("is false on 404 or a network error", async () => {
    respond(404, "text/plain")
    expect(await modelFileAvailable("/models/x.glb")).toBe(false)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
    expect(await modelFileAvailable("/models/x.glb")).toBe(false)
  })
})
