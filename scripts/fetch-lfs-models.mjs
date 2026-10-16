// Replaces Git LFS pointer files under public/models with the real 3D models,
// so a Docker build works from a checkout without `git lfs pull` (the build
// context has no .git). Downloads through the repo's LFS batch API and checks
// size + sha256; any failure stops the build instead of shipping a pointer.
//
//   node scripts/fetch-lfs-models.mjs [dir]           (default: public/models)
//
// LFS_REPO   repo URL (default: the hospital_frontend GitHub repo)
// LFS_TOKEN  GitHub token, only needed if the repo is private; in Docker pass it
//            as a BuildKit secret (id=lfs_token) so it never lands in an image layer.
import { createHash } from "node:crypto"
import { createWriteStream, existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"

const dir = process.argv[2] ?? "public/models"
const repo = (process.env.LFS_REPO ?? "https://github.com/polynexus-dev/hospital_frontend.git").replace(/\/$/, "")
const secretFile = "/run/secrets/lfs_token"
const token = process.env.LFS_TOKEN || (existsSync(secretFile) ? readFileSync(secretFile, "utf8").trim() : "")

function readPointer(path) {
  if (statSync(path).size > 1024) return null // real file
  const text = readFileSync(path, "utf8")
  if (!text.startsWith("version https://git-lfs.github.com/spec/")) return null
  const oid = text.match(/^oid sha256:([0-9a-f]{64})$/m)?.[1]
  const size = Number(text.match(/^size (\d+)$/m)?.[1])
  if (!oid || !size) throw new Error(`${path}: malformed LFS pointer`)
  return { oid, size }
}

async function download(path, { oid, size }) {
  const auth = token ? { Authorization: `Bearer ${token}` } : {}
  const batch = await fetch(`${repo}/info/lfs/objects/batch`, {
    method: "POST",
    headers: { Accept: "application/vnd.git-lfs+json", "Content-Type": "application/vnd.git-lfs+json", ...auth },
    body: JSON.stringify({ operation: "download", transfers: ["basic"], objects: [{ oid, size }] }),
  })
  if (!batch.ok) throw new Error(`LFS batch request failed: HTTP ${batch.status}${batch.status === 401 || batch.status === 404 ? " (private repo? pass LFS_TOKEN)" : ""}`)
  const obj = (await batch.json()).objects?.[0]
  const action = obj?.actions?.download
  if (!action?.href) throw new Error(`LFS server has no download for ${oid}: ${JSON.stringify(obj?.error ?? obj)}`)

  const res = await fetch(action.href, { headers: action.header ?? {} })
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`)
  const tmp = `${path}.download`
  const hash = createHash("sha256")
  const body = Readable.fromWeb(res.body)
  body.on("data", (chunk) => hash.update(chunk))
  await pipeline(body, createWriteStream(tmp))

  const got = statSync(tmp).size
  const sha = hash.digest("hex")
  if (got !== size || sha !== oid) {
    rmSync(tmp, { force: true })
    throw new Error(`verification failed (size ${got}/${size}, sha256 ${sha})`)
  }
  renameSync(tmp, path)
}

if (!existsSync(dir)) {
  console.log(`[lfs] ${dir} not found, nothing to fetch`)
  process.exit(0)
}
let failed = false
for (const name of readdirSync(dir)) {
  if (!/\.(glb|gltf|obj|bin)$/i.test(name)) continue
  const path = join(dir, name)
  const pointer = readPointer(path)
  if (!pointer) {
    console.log(`[lfs] ${name}: already the real file (${statSync(path).size} bytes)`)
    continue
  }
  try {
    console.log(`[lfs] ${name}: downloading ${(pointer.size / 1048576).toFixed(1)} MB from Git LFS…`)
    await download(path, pointer)
    console.log(`[lfs] ${name}: ok, sha256 verified`)
  } catch (e) {
    console.error(`[lfs] ${name}: ${e.message}`)
    failed = true
  }
}
process.exit(failed ? 1 : 0)
