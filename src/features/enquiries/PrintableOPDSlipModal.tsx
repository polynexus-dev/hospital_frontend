import { useRef } from "react"
import type { Enquiry } from "../../types/api"
import { Button } from "../../components/ui/Button"

interface Props {
  enquiry: Enquiry
  onClose: () => void
}

export function PrintableOPDSlipModal({ enquiry, onClose }: Props) {
  const printAreaRef = useRef<HTMLDivElement>(null)

  const tokenNumber = `TK-${(enquiry.id * 17) % 90 + 10}`
  const uhid = `UHID-${new Date().getFullYear()}-${(enquiry.patient || enquiry.id).toString().padStart(6, "0")}`
  const doctorName = enquiry.consulting_doctor_name
    ? `Dr. ${enquiry.consulting_doctor_name.replace(/^Dr\.?\s*/i, "")}`
    : "On-Duty Consultant"
  const roomNumber = `OPD Room ${((enquiry.id % 8) + 101)}, Floor 1, Wing A`
  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const timeStr = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })

  const handlePrint = () => {
    window.print()
  }

  const handleShareWhatsApp = () => {
    const cleanPhone = enquiry.mobile.replace(/\D/g, "")
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    const text = `*HOSPITAL OPD CONSULTATION TOKEN SLIP*
🏥 *Hospital Patient Registration Desk*
---------------------------------------
*Token Number:* ${tokenNumber}
*Patient Name:* ${enquiry.name}
*UHID:* ${uhid}
*Doctor:* ${doctorName}
*Cabin/Room:* ${roomNumber}
*Date:* ${todayStr} | ${timeStr}
*Department:* ${enquiry.service_requested || "General Consultation"}

📍 *Instructions:* Please report 15 mins prior to the OPD Nursing Station with prior medical records and this digital token.
Emergency Helpline: 1800-419-7000`

    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`, "_blank")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar (Hidden during window.print) */}
        <div className="print:hidden bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🖨️</span>
            <div>
              <h3 className="font-bold text-sm">Printable OPD Token & Consultation Slip</h3>
              <p className="text-[11px] text-slate-300">A5 / Thermal format for Reception & Patient Record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white font-bold text-base px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>

        {/* Printable Slip Content */}
        <div className="overflow-y-auto p-6 flex-1 bg-slate-50">
          <div
            ref={printAreaRef}
            id="opd-slip-printable"
            className="bg-white border border-slate-300 rounded-lg p-6 shadow-xs max-w-md mx-auto text-slate-800 font-sans"
          >
            {/* Hospital Branding Header */}
            <div className="text-center pb-3 border-b-2 border-slate-800">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-2xl">🏥</span>
                <h1 className="text-base font-black tracking-wide text-slate-900 uppercase">
                  Nexus Multi-Specialty Hospital
                </h1>
              </div>
              <p className="text-[11px] text-slate-600 font-medium">
                NABH Accredited Tertiary Healthcare & Research Center
              </p>
              <p className="text-[10px] text-slate-500">
                Plot 14, Health City, Ring Road • 24x7 Emergency: (020) 6700-1111
              </p>
            </div>

            {/* Token Banner */}
            <div className="my-3 py-2 px-3 bg-slate-900 text-white rounded flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-300 font-semibold block">
                  Out-Patient Consultation Token
                </span>
                <span className="text-2xl font-black tracking-wider text-amber-400">{tokenNumber}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold block">{todayStr}</span>
                <span className="text-[11px] text-slate-300">{timeStr}</span>
              </div>
            </div>

            {/* Patient & Doctor Demographics */}
            <div className="space-y-2 py-2 border-b border-dashed border-slate-300 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Patient Name</span>
                  <span className="font-bold text-slate-900 text-sm">{enquiry.name}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">UHID / Reg No.</span>
                  <span className="font-mono font-bold text-slate-800">{uhid}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Mobile No.</span>
                  <span className="font-mono text-slate-800">{enquiry.mobile}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Service / Dept</span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {enquiry.service_requested || "General Medicine"}
                  </span>
                </div>
              </div>

              <div className="bg-teal-50 border border-teal-200 p-2.5 rounded mt-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] uppercase text-teal-800 font-bold block">Consulting Doctor</span>
                    <span className="font-black text-teal-950 text-sm">{doctorName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-teal-800 font-bold block">Chamber / Cabin</span>
                    <span className="font-bold text-teal-900 text-xs">{roomNumber}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Patient Instructions & Barcode */}
            <div className="pt-3 text-[10.5px] text-slate-600 space-y-1 leading-relaxed">
              <p className="font-bold text-slate-700">Patient Instructions:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Please present this slip at the 1st Floor Nursing Station.</li>
                <li>Carry all previous investigation reports, imaging, & regular prescriptions.</li>
                <li>Token is non-transferable and valid for today's session only.</li>
              </ul>
            </div>

            {/* Barcode & Verification Tag */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-mono tracking-widest text-[11px] font-black text-slate-400">
                  ||||| | |||| |||||| || | |||||
                </div>
                <span className="text-[9px] text-slate-400 font-mono">{uhid}</span>
              </div>
              <div className="text-right text-[10px] text-slate-400">
                <span>Authorized Desk: Reception-02</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls (Hidden on Print) */}
        <div className="print:hidden bg-white px-5 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleShareWhatsApp}
              className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-semibold flex items-center gap-1.5"
            >
              <span>💬</span>
              <span>Send to WhatsApp</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5"
            >
              <span>🖨️</span>
              <span>Print Slip (Ctrl+P)</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
