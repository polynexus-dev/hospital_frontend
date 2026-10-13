import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, extractApiError } from "../../api/client"
import { listThreads } from "../../api/communications"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"

interface ChatMessage {
  id: number
  from: "visitor" | "staff" | "auto"
  name: string
  body: string
  at: string
}

interface ChatDetail {
  messages: ChatMessage[]
  enquiry: { id: number | null; name: string; mobile: string }
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })

/** Inbox → Website chats: visitors chatting from the hospital's website
 *  (the website widget). Each chat is also a Website enquiry. Polls, so new
 *  messages show up without refreshing. */
export function WebChatPanel() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<number | null>(null)
  const [draft, setDraft] = useState("")
  const logRef = useRef<HTMLDivElement>(null)

  const threads = useQuery({
    queryKey: ["threads", "web_chat"],
    queryFn: () => listThreads({ channel: "web_chat", ordering: "-last_message_at", page_size: "100" }),
    refetchInterval: 10_000,
  })
  const chat = useQuery({
    queryKey: ["web-chat", selected],
    queryFn: () => api.get<ChatDetail>(`/threads/${selected}/chat-messages/`),
    enabled: selected !== null,
    refetchInterval: 4_000,
  })
  const reply = useMutation({
    mutationFn: () => api.post<ChatMessage>(`/threads/${selected}/reply/`, { body: draft.trim() }),
    onSuccess: () => {
      setDraft("")
      queryClient.invalidateQueries({ queryKey: ["web-chat", selected] })
      queryClient.invalidateQueries({ queryKey: ["threads", "web_chat"] })
    },
  })
  const close = useMutation({
    mutationFn: () => api.post(`/threads/${selected}/close/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["threads", "web_chat"] }),
  })

  const messages = chat.data?.messages ?? []
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages.length])

  const rows = threads.data?.results ?? []
  const current = rows.find((t) => t.id === selected)

  return (
    <div className="grid grid-cols-[280px_minmax(380px,1fr)] gap-3 flex-1 min-h-0">
      <Card className="h-full flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border text-[12px] font-semibold text-ink-3">Website chats</div>
        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 && (
            <p className="p-3 text-[12.5px] text-ink-4">
              No chats yet. Turn on chat in Enquiries → 🌐 Website form, and add the code to your website.
            </p>
          )}
          {rows.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-border-faint text-[13px] ${selected === t.id ? "bg-brand-soft" : "hover:bg-page"}`}
            >
              <div className="flex justify-between gap-2">
                <span className="font-semibold truncate">{t.enquiry_name || `Enquiry #${t.enquiry}`}</span>
                {t.unread_count > 0 && <span className="text-[11px] px-1.5 rounded-full bg-danger-text text-white">{t.unread_count}</span>}
              </div>
              <div className="text-[11.5px] text-ink-4">
                {t.status === "closed" ? "Closed" : t.sla_due_at && new Date(t.sla_due_at) < new Date() ? "⚠ Waiting for a reply" : "Open"}
                {t.last_message_at && ` · ${time(t.last_message_at)}`}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="h-full flex flex-col overflow-hidden">
        {selected === null ? (
          <div className="m-auto text-[13px] text-ink-4">Pick a chat on the left.</div>
        ) : (
          <>
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
              <div className="text-[13px]">
                <b>{chat.data?.enquiry.name || "Visitor"}</b> <span className="text-ink-4">{chat.data?.enquiry.mobile}</span>
                {chat.data?.enquiry.id && <span className="ml-2 text-ink-4 text-[12px]">Enquiry #{chat.data.enquiry.id}</span>}
              </div>
              {current?.status !== "closed" && (
                <Button size="sm" variant="secondary" disabled={close.isPending} onClick={() => close.mutate()}>Close chat</Button>
              )}
            </div>
            <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-page" role="log" aria-live="polite">
              {messages.map((m) => (
                <div key={m.id} className={`max-w-[75%] px-3 py-2 rounded-xl text-[13px] whitespace-pre-wrap ${m.from === "visitor" ? "bg-surface border border-border" : m.from === "staff" ? "ml-auto bg-brand text-white" : "ml-auto bg-chip-bg text-ink-3 italic"}`}>
                  <div className="text-[10.5px] opacity-75 mb-0.5">{m.from === "visitor" ? "Visitor" : m.from === "staff" ? m.name || "Staff" : "Automatic"} · {time(m.at)}</div>
                  {m.body}
                </div>
              ))}
            </div>
            <form
              className="p-2.5 border-t border-border flex gap-2"
              onSubmit={(e) => { e.preventDefault(); if (draft.trim()) reply.mutate() }}
            >
              <textarea
                aria-label="Reply"
                rows={2}
                className="flex-1 border border-border-strong rounded-control p-2 text-[13px] resize-none"
                placeholder="Type a reply. Enter to send, Shift+Enter for a new line"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (draft.trim()) reply.mutate() } }}
              />
              <Button type="submit" disabled={reply.isPending || !draft.trim()}>Send</Button>
            </form>
            {reply.isError && <div className="px-3 pb-2 text-[12px] text-danger-text">{extractApiError(reply.error)}</div>}
          </>
        )}
      </Card>
    </div>
  )
}
