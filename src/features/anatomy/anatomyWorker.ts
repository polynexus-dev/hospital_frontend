import * as THREE from "three"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"

self.onmessage = async (e: MessageEvent) => {
  const { url } = e.data
  try {
    self.postMessage({ type: "status", stage: "downloading", message: "Connecting to 3D asset server..." })

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch 3D model (HTTP ${response.status})`)
    }

    const contentLengthHeader = response.headers.get("Content-Length")
    const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 115982100

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("Streaming not supported by browser environment")
    }

    const chunks: Uint8Array[] = []
    let receivedBytes = 0
    let lastReportTime = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      receivedBytes += value.length

      const now = performance.now()
      // Throttle progress updates to 60fps to prevent worker message flooding
      if (now - lastReportTime > 50) {
        lastReportTime = now
        const percent = Math.min(Math.round((receivedBytes / totalBytes) * 100), 99)
        self.postMessage({
          type: "progress",
          stage: "downloading",
          loaded: receivedBytes,
          total: totalBytes,
          percent,
          message: `Downloading 3D Skeleton scan (${(receivedBytes / (1024 * 1024)).toFixed(1)} MB / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB)`
        })
      }
    }

    // Merge chunks into a single Uint8Array
    self.postMessage({
      type: "progress",
      stage: "decoding",
      percent: 100,
      loaded: totalBytes,
      total: totalBytes,
      message: "Decoding text stream..."
    })

    const allChunks = new Uint8Array(receivedBytes)
    let position = 0
    for (const chunk of chunks) {
      allChunks.set(chunk, position)
      position += chunk.length
    }

    const text = new TextDecoder("utf-8").decode(allChunks)

    self.postMessage({
      type: "status",
      stage: "parsing",
      percent: 100,
      message: "Compiling 3D Anatomy (1.37M Vertices, 2.74M Polygons)..."
    })

    // Parse the OBJ string using Three.js OBJLoader
    const loader = new OBJLoader()
    const object = loader.parse(text)

    // Extract geometry buffers
    let mesh: THREE.Mesh | null = null
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !mesh) {
        mesh = child as THREE.Mesh
      }
    })

    if (!mesh) {
      throw new Error("No mesh geometry found in OBJ file")
    }

    const geom = (mesh as THREE.Mesh).geometry
    const posAttr = geom.attributes.position
    const normAttr = geom.attributes.normal

    if (!posAttr) {
      throw new Error("Missing vertex position attribute in geometry")
    }

    // Copy to new ArrayBuffers to transfer ownership cleanly
    const positions = new Float32Array(posAttr.array)
    let normals: Float32Array | null = null
    if (normAttr) {
      normals = new Float32Array(normAttr.array)
    }

    // Transfer buffers to main thread with 0-copy transferables
    const transferables: Transferable[] = [positions.buffer]
    if (normals) transferables.push(normals.buffer)

    ;(self as any).postMessage(
      {
        type: "complete",
        positions,
        normals,
      },
      transferables
    )
  } catch (err: any) {
    self.postMessage({
      type: "error",
      message: err.message || "Failed to load and compile 3D skeleton"
    })
  }
}
