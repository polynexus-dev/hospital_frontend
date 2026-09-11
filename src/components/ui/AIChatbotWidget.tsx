import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { postInteractiveChatAction } from "../../api/communications"
import { useAuthStore } from "../../store/auth"

interface ChatMessage {
  sender: "user" | "ai"
  text: string
  options?: Array<{ id: string; label: string }>
}

export function AIChatbotWidget() {
  const hospitalName = useAuthStore((state) => state.user?.hospital_name)
  const [isOpen, setIsOpen] = useState(false)
  const [language, setLanguage] = useState<"en" | "mr" | "hi">("en")
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [activeOptions, setActiveOptions] = useState<Array<{ id: string; label: string }>>([])
  const [requiresInput, setRequiresInput] = useState<string[] | null>(null)
  const [pendingSlotId, setPendingSlotId] = useState<number | null>(null)
  const [formValues, setFormValues] = useState<{ name: string; mobile: string }>({ name: "", mobile: "" })

  const actionMutation = useMutation({
    mutationFn: postInteractiveChatAction,
    onSuccess: (data) => {
      setChatHistory((prev) => [...prev, { sender: "ai", text: data.text, options: data.options }])
      setActiveOptions(data.options || [])
      setRequiresInput(data.requires_input || null)
      setPendingSlotId(data.pending_slot_id ?? null)
      if (data.requires_input) setFormValues({ name: "", mobile: "" })
    },
  })

  // Initialize main menu on open or language change
  useEffect(() => {
    if (isOpen && chatHistory.length === 0) {
      triggerAction("main_menu")
    }
  }, [isOpen])

  const triggerAction = (actionId: string, labelText?: string, extraPayload?: Record<string, unknown>) => {
    if (labelText) {
      setChatHistory((prev) => [...prev, { sender: "user", text: labelText }])
    }
    setActiveOptions([])
    setRequiresInput(null)
    actionMutation.mutate({ action: actionId, language, payload: extraPayload })
  }

  const submitBookingDetails = () => {
    if (!formValues.mobile.trim()) return
    triggerAction(
      "submit_booking",
      `${formValues.name || "Patient"} · ${formValues.mobile}`,
      { slot_id: pendingSlotId, name: formValues.name, mobile: formValues.mobile },
    )
  }

  const handleLanguageChange = (newLang: "en" | "mr" | "hi") => {
    setLanguage(newLang)
    setChatHistory([])
    setRequiresInput(null)
    actionMutation.mutate({ action: "main_menu", language: newLang })
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 bg-brand hover:bg-brand-hover text-white font-semibold px-4 py-3 rounded-full shadow-lg transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-white/80" />
          <span className="text-[13px]">24x7 Hospital Assistant</span>
        </button>
      )}

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div className="w-80 sm:w-96 bg-surface border border-border rounded-card shadow-lg flex flex-col h-[520px] overflow-hidden">
          {/* Header */}
          <div className="bg-brand text-white p-3.5 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-[13px]">24x7 Hospital Assistant</h3>
              <span className="text-[10.5px] opacity-80 block">Instant OPD booking & information</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white hover:opacity-75 text-lg px-2">
              ✕
            </button>
          </div>

          {/* Language Selector */}
          <div className="bg-page px-3 py-1.5 border-b border-border-soft flex justify-between items-center text-xs">
            <span className="text-ink-4 font-semibold">Language / भाषा:</span>
            <div className="flex gap-1">
              {[
                { code: "en", label: "English" },
                { code: "mr", label: "मराठी" },
                { code: "hi", label: "हिंदी" },
              ].map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code as any)}
                  className={`px-2 py-0.5 rounded-tag text-[11px] font-semibold transition-colors ${
                    language === lang.code ? "bg-brand text-white" : "text-ink-3 hover:bg-border-soft"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className="space-y-2">
                <div
                  className={`p-3 rounded-control max-w-[88%] whitespace-pre-wrap ${
                    msg.sender === "user"
                      ? "ml-auto bg-brand text-white font-medium"
                      : "mr-auto bg-page text-ink border border-border"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Booking details form (name + mobile) when the backend asks for them */}
            {requiresInput && !actionMutation.isPending && (
              <div className="space-y-2 pt-1 border-t border-border-soft mt-1 pt-2.5">
                <span className="text-[11px] font-semibold text-ink-5 uppercase tracking-[.06em] block px-1">
                  Confirm booking details:
                </span>
                {requiresInput.includes("name") && (
                  <input
                    type="text"
                    placeholder="Patient name"
                    value={formValues.name}
                    onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-border-strong rounded-control bg-surface"
                  />
                )}
                {requiresInput.includes("mobile") && (
                  <input
                    type="tel"
                    placeholder="Mobile number"
                    value={formValues.mobile}
                    onChange={(e) => setFormValues((v) => ({ ...v, mobile: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-border-strong rounded-control bg-surface"
                  />
                )}
                <button
                  onClick={submitBookingDetails}
                  disabled={!formValues.mobile.trim()}
                  className="w-full px-3 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-semibold rounded-control transition-colors text-xs"
                >
                  Confirm Booking
                </button>
              </div>
            )}

            {/* Active Action Option Buttons */}
            {activeOptions.length > 0 && !actionMutation.isPending && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-ink-5 uppercase tracking-[.06em] block px-1">
                  Select an option below:
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {activeOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => triggerAction(opt.id, opt.label)}
                      className="w-full text-left px-3 py-2 bg-surface hover:bg-brand-tint text-brand font-semibold border border-border-strong rounded-control transition-colors text-xs flex items-center justify-between"
                    >
                      <span>{opt.label}</span>
                      <span className="text-brand">→</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {actionMutation.isPending && (
              <div className="mr-auto bg-page p-2.5 rounded-control text-ink-5 italic text-[11px]">
                Updating options...
              </div>
            )}
          </div>

          {/* Footer Reset button */}
          <div className="p-2 border-t border-border-soft bg-page flex justify-between items-center text-xs">
            <span className="text-[11px] text-ink-5">{hospitalName || "Hospital Assistant"}</span>
            <button
              onClick={() => triggerAction("main_menu")}
              className="text-xs text-brand font-semibold hover:underline"
            >
              Reset to main menu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
