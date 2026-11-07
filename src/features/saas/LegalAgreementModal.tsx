import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import { LoadingState, ErrorState } from "../../components/ui/QueryStates"
import { getHospitalLegalAgreement, downloadHospitalLegalAgreementHtml } from "../../api/saas"
import { triggerBlobDownload } from "../../api/client"
import type { SaaSHospital } from "../../types/api"

interface LegalAgreementModalProps {
  hospital: SaaSHospital | null
  onClose: () => void
}

export function LegalAgreementModal({ hospital, onClose }: LegalAgreementModalProps) {
  const [downloading, setDownloading] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["hospital-legal-agreement", hospital?.id],
    queryFn: () => (hospital ? getHospitalLegalAgreement(hospital.id) : null),
    enabled: !!hospital,
    staleTime: 60 * 1000,
  })

  if (!hospital) return null

  const handleDownloadHtml = async () => {
    try {
      setDownloading(true)
      const blob = await downloadHospitalLegalAgreementHtml(hospital.id)
      triggerBlobDownload(blob, data?.filename || `${hospital.slug}_Polynexus_Legal_Agreement.html`)
    } catch (err) {
      console.error("Failed to download legal agreement HTML", err)
      alert("Failed to download legal agreement. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  const handleOpenRawPrint = () => {
    if (data?.html) {
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.open()
        printWindow.document.write(data.html)
        printWindow.document.close()
      }
    } else {
      window.open(`/api/v1/saas-admin/hospitals/${hospital.id}/legal-agreement/?raw=1`, "_blank")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="flex flex-col w-full max-w-5xl h-[92vh] bg-card dark:bg-slate-900 border border-border dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-150">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-slate-800 bg-page/70 dark:bg-slate-950/40 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📜</span>
              <h2 className="text-base font-bold text-ink dark:text-white">
                Master Client Legal Agreement Suite
              </h2>
              <Pill tone="info">SaaS Owner Generator</Pill>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-ink-3 dark:text-slate-400">
              <span className="font-semibold text-ink dark:text-slate-200">{hospital.name}</span>
              <span>·</span>
              <span className="font-mono text-accent dark:text-teal-400">{hospital.slug}.hms.polynexus.in</span>
              <span>·</span>
              <span>{hospital.enabled_modules?.length ?? 35} Modules Active</span>
              <span>·</span>
              <span className="text-success dark:text-emerald-400 font-medium">DPDP Act 2023 · Indian Contract Act 1872</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleDownloadHtml}
              disabled={isLoading || downloading}
              title="Download standalone pre-populated HTML contract file"
            >
              <span>📥</span>
              <span>{downloading ? "Downloading..." : "Download HTML"}</span>
            </Button>

            <Button
              size="sm"
              variant="primary"
              onClick={handleOpenRawPrint}
              disabled={isLoading}
              title="Open standalone contract in full window with 1-click Print / Save as PDF"
              className="bg-brand hover:bg-brand-hover text-white shadow-sm flex items-center gap-1.5"
            >
              <span>🖨️</span>
              <span>Open & Print / Save as PDF ↗</span>
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 ml-2 text-ink-4 hover:text-ink dark:hover:text-white rounded-lg hover:bg-page transition-colors"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body: Document Preview */}
        <div className="relative flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <LoadingState />
            </div>
          )}

          {isError && (
            <div className="p-6">
              <ErrorState message={(error as any)?.message || "Failed to load dynamic legal agreement."} />
            </div>
          )}

          {data && (
            <iframe
              srcDoc={data.html}
              title={`Legal Agreement - ${hospital.name}`}
              className="w-full h-full border border-border dark:border-slate-800 rounded-xl bg-white shadow-inner"
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-2.5 border-t border-border dark:border-slate-800 bg-page/50 dark:bg-slate-950 text-xs text-ink-4 dark:text-slate-500 shrink-0">
          <div>
            Law-Firm-Grade Suite: <strong>Schedule A (Order Form)</strong> · <strong>Part I (MSA)</strong> · <strong>Part II (On-Prem)</strong> · <strong>Part III (DPA)</strong> · <strong>Part IV (SLA)</strong> · <strong>Part V (EULA)</strong>
          </div>
          <div>
            Tip: Inside the preview, click any shaded text to edit in real time before printing.
          </div>
        </div>

      </div>
    </div>
  )
}

