import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { api, extractApiError, triggerBlobDownload } from "../../api/client"

const FILES: Record<string, { path: string; title: string; filename: string }> = {
  lab: { path: "/laboratory/report-link", title: "Your lab report", filename: "lab-report.pdf" },
  statement: { path: "/finance/payout-statement", title: "Your statement", filename: "statement.pdf" },
}

/** Where a signed link in a WhatsApp or SMS message lands. The file comes down
 *  encrypted like everything else, which a bare PDF link could not do. */
export function SharedFilePage() {
  const { kind = "", token = "" } = useParams()
  const file = FILES[kind]
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(file ? null : "This link isn't valid.")

  useEffect(() => {
    if (!file) return
    api.getBlob(`${file.path}/${encodeURIComponent(token)}/`, { skipAuth: true }).then(setBlob).catch((e) => setError(extractApiError(e, "This link has expired. Please ask the hospital for a new one.")))
  }, [file, token])

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-page text-ink">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-lg font-semibold mb-3">{file?.title ?? "Shared file"}</h1>
        {error && <p className="text-[14px] text-danger-text">{error}</p>}
        {!error && !blob && <p className="text-[14px] text-ink-4">Loading securely…</p>}
        {blob && (
          <button type="button" className="h-10 px-4 rounded-control bg-brand text-white font-semibold" onClick={() => triggerBlobDownload(blob, file.filename)}>
            Download PDF
          </button>
        )}
      </div>
    </div>
  )
}
