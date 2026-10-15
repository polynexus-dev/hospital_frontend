import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { postInteractiveChatAction } from "../../api/communications"
import { useAuthStore } from "../../store/auth"
import { useDraggable } from "../../hooks/useDraggable"

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
  const [freeText, setFreeText] = useState("")

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

  const submitFreeText = () => {
    const text = freeText.trim()
    if (!text) return
    setFreeText("")
    triggerAction("free_text", text, { message: text })
  }

  const { position, isDragging, hasMovedRef, onPointerDown, resetPosition } = useDraggable({
    storageKey: "hms_ai_assistant_fab_pos_v2",
  })

  // Compute adaptive window coordinates when in custom dragged position
  const getWindowStyle = () => {
    if (!position || typeof window === "undefined") return undefined
    const winW = typeof window !== "undefined" ? window.innerWidth : 1024
    const winH = typeof window !== "undefined" ? window.innerHeight : 768
    const drawerW = winW < 640 ? 320 : 384
    const drawerH = 520

    let left = position.x
    if (left + drawerW > winW - 16) {
      left = Math.max(16, winW - drawerW - 16)
    }

    let top = position.y - drawerH - 8
    if (top < 16) {
      top = Math.min(winH - drawerH - 16, position.y + 56)
    }

    return {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      right: "auto",
      bottom: "auto",
    }
  }

  return (
    <div
      style={position ? (isOpen ? getWindowStyle() : { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" }) : undefined}
      className={position ? "fixed z-50 touch-none select-none" : "fixed float-above-bar right-6 z-50 touch-none select-none"}
    >
      {/* Floating Round Icon Button - Draggable & Flexible */}
      {!isOpen && (
        <button
          onPointerDown={onPointerDown}
          onClick={(e) => {
            if (hasMovedRef.current) {
              e.preventDefault()
              e.stopPropagation()
              return
            }
            setIsOpen(true)
          }}
          aria-label="24x7 Hospital Assistant"
          title="24x7 Hospital Assistant (AI Chatbot) • Drag to move anywhere"
          className={`relative group w-12 h-12 rounded-full bg-gradient-to-tr from-brand-dark via-brand to-accent text-white shadow-xl hover:shadow-2xl hover:shadow-accent/30 flex items-center justify-center transition-transform duration-150 active:scale-95 border border-white/20 ${
            isDragging ? "cursor-grabbing scale-110 shadow-2xl ring-2 ring-accent" : "cursor-grab hover:scale-110"
          }`}
        >
          {/* Live pulsing indicator badge */}
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse pointer-events-none" />

          {/* AI / Chat Sparkle Icon */}
          <svg className="w-6 h-6 text-white group-hover:rotate-6 transition-transform pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>

          {/* Text for screen readers & test matchers */}
          <span className="sr-only">24x7 Hospital Assistant</span>

          {/* Hover Tooltip */}
          <span className="absolute right-full mr-3 px-2.5 py-1 bg-slate-900/95 text-white text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700/80 flex items-center gap-1.5">
            <span>24x7 AI Assistant</span>
            <span className="text-[10px] text-slate-400 font-normal">• Drag to move</span>
          </span>
        </button>
      )}

      {/* Floating Chat Drawer Window - Expands fluidly from icon position */}
      {isOpen && (
        <div className="w-80 sm:w-96 bg-surface border border-border rounded-2xl shadow-2xl flex flex-col h-[520px] max-h-[85vh] overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Header */}
          <div className="bg-brand text-white p-3.5 flex justify-between items-center shadow-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <div>
                <h3 className="font-semibold text-[13px]">24x7 Hospital Assistant</h3>
                <span className="text-[10.5px] opacity-80 block">Instant OPD booking & information</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {position && (
                <button
                  onClick={resetPosition}
                  title="Reset to default bottom-right position"
                  className="text-white/70 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Reset position"
                >
                  ↺ Reset
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-white hover:opacity-75 text-lg px-2 cursor-pointer" aria-label="Close Assistant">
                ✕
              </button>
            </div>
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

          {/* Free-text input — routed through the backend's intent
              classifier, so a patient isn't limited to the button menu. */}
          <div className="p-2.5 border-t border-border-soft bg-surface flex items-center gap-1.5">
            <input
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitFreeText()
              }}
              placeholder="Type your question..."
              disabled={actionMutation.isPending}
              className="flex-1 min-w-0 px-3 py-2 text-xs border border-border-strong rounded-control bg-page disabled:opacity-60"
            />
            <button
              onClick={submitFreeText}
              disabled={actionMutation.isPending || !freeText.trim()}
              className="shrink-0 px-3 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-semibold rounded-control transition-colors text-xs"
            >
              Send
            </button>
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
