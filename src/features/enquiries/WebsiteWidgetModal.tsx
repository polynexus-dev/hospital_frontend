import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, extractApiError } from "../../api/client"
import { Button } from "../../components/ui/Button"
import { showToast } from "../../components/ui/Toast"

export interface WebsiteWidget {
  site_key: string
  allowed_domains: string[]
  form_enabled: boolean
  chat_enabled: boolean
  title: string
  intro: string
  button_text: string
  accent_color: string
  services: string[]
  consent_text: string
  thank_you_message: string
  chat_welcome: string
  chat_auto_reply: string
  embed_code: string
  preview_url: string
}

const input = "w-full h-9 px-3 border border-border-strong rounded-control text-[13px] bg-surface"
const label = "block text-[11.5px] font-semibold text-ink-3 mb-1"

/** Enquiries → Website form: the script tag a hospital adds to its own
 *  website, and what the form looks like. Leads arrive as "Website" enquiries
 *  with their Google/Meta campaign tags. */
export function WebsiteWidgetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const widget = useQuery({
    queryKey: ["website-widget"],
    queryFn: () => api.get<WebsiteWidget>("/enquiries/website-widget/"),
    enabled: open,
    retry: false,
  })
  const [draft, setDraft] = useState<Partial<WebsiteWidget> & { domains?: string; servicesText?: string }>({})
  useEffect(() => {
    if (widget.data) {
      setDraft({ ...widget.data, domains: widget.data.allowed_domains.join("\n"), servicesText: widget.data.services.join("\n") })
    }
  }, [widget.data])

  const save = useMutation({
    mutationFn: () =>
      api.patch<WebsiteWidget>("/enquiries/website-widget/", {
        allowed_domains: (draft.domains ?? "").split(/[\s,]+/).filter(Boolean),
        services: (draft.servicesText ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
        form_enabled: draft.form_enabled, title: draft.title, intro: draft.intro, button_text: draft.button_text,
        accent_color: draft.accent_color, consent_text: draft.consent_text, thank_you_message: draft.thank_you_message,
        chat_enabled: draft.chat_enabled, chat_welcome: draft.chat_welcome, chat_auto_reply: draft.chat_auto_reply,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["website-widget"], data)
      showToast("Website form saved", "success")
    },
  })
  const rotate = useMutation({
    mutationFn: () => api.post<WebsiteWidget>("/enquiries/website-widget/"),
    onSuccess: (data) => {
      queryClient.setQueryData(["website-widget"], data)
      showToast("New key created. Update the code on your website.", "success")
    },
  })

  if (!open) return null
  const w = widget.data

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-border-strong w-full max-w-[720px] max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Website enquiry form</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-4 text-lg">✕</button>
        </div>

        {widget.isError && <div className="text-[13px] text-danger-text">{extractApiError(widget.error)}</div>}
        {!w && !widget.isError && <div className="text-[13px] text-ink-4">Loading…</div>}

        {w && (
          <>
            <section className="space-y-2">
              <p className="text-[13px] text-ink-3">
                Paste this on your website, where the form should appear (or anywhere, for a floating "{w.button_text}" button).
                Enquiries come straight into this list as <b>Website</b> leads, with their Google/Meta ad campaign.
              </p>
              <pre className="text-[12px] bg-page border border-border rounded-control p-3 whitespace-pre-wrap break-all">{w.embed_code}</pre>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => { void navigator.clipboard?.writeText(w.embed_code); showToast("Code copied", "success") }}>Copy code</Button>
                <a className="text-[13px] px-3 py-1.5 border border-border-strong rounded-control" href={w.preview_url} target="_blank" rel="noreferrer">Preview</a>
                <Button size="sm" variant="secondary" disabled={rotate.isPending} onClick={() => { if (confirm("Create a new key? The code already on your website will stop working until you replace it.")) rotate.mutate() }}>
                  New key
                </Button>
              </div>
            </section>

            <form className="grid sm:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
              <div className="sm:col-span-2">
                <label className={label} htmlFor="ww-domains">Your website domains (one per line)</label>
                <textarea id="ww-domains" rows={2} className={`${input} h-auto py-2`} placeholder="swasthyam.in" value={draft.domains ?? ""} onChange={(e) => setDraft({ ...draft, domains: e.target.value })} />
                {!(draft.domains ?? "").trim() && <div className="text-[12px] text-warning-text mt-1">⚠ With no domain listed, any website could use this form. Add yours before going live.</div>}
              </div>
              <div>
                <label className={label} htmlFor="ww-title">Heading</label>
                <input id="ww-title" className={input} value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="ww-button">Button text</label>
                <input id="ww-button" className={input} value={draft.button_text ?? ""} onChange={(e) => setDraft({ ...draft, button_text: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className={label} htmlFor="ww-intro">Short line under the heading</label>
                <input id="ww-intro" className={input} value={draft.intro ?? ""} onChange={(e) => setDraft({ ...draft, intro: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="ww-services">"What do you need?" options (one per line; empty = your departments)</label>
                <textarea id="ww-services" rows={4} className={`${input} h-auto py-2`} value={draft.servicesText ?? ""} onChange={(e) => setDraft({ ...draft, servicesText: e.target.value })} />
              </div>
              <div className="space-y-3">
                <div>
                  <label className={label} htmlFor="ww-colour">Colour</label>
                  <input id="ww-colour" type="color" className="h-9 w-16 border border-border-strong rounded-control" value={draft.accent_color ?? "#0f766e"} onChange={(e) => setDraft({ ...draft, accent_color: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={!!draft.form_enabled} onChange={(e) => setDraft({ ...draft, form_enabled: e.target.checked })} /> Form is live
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={!!draft.chat_enabled} onChange={(e) => setDraft({ ...draft, chat_enabled: e.target.checked })} /> Live chat is on (answer in Inbox → Website chats)
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className={label} htmlFor="ww-consent">Consent text (DPDP Act; patients must tick it)</label>
                <textarea id="ww-consent" rows={2} className={`${input} h-auto py-2`} value={draft.consent_text ?? ""} onChange={(e) => setDraft({ ...draft, consent_text: e.target.value })} />
              </div>
              {draft.chat_enabled && (
                <>
                  <div className="sm:col-span-2">
                    <label className={label} htmlFor="ww-chat-welcome">Chat greeting</label>
                    <input id="ww-chat-welcome" className={input} value={draft.chat_welcome ?? ""} onChange={(e) => setDraft({ ...draft, chat_welcome: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={label} htmlFor="ww-chat-auto">Automatic reply to a new chat</label>
                    <input id="ww-chat-auto" className={input} value={draft.chat_auto_reply ?? ""} onChange={(e) => setDraft({ ...draft, chat_auto_reply: e.target.value })} />
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <label className={label} htmlFor="ww-thanks">Message after sending</label>
                <input id="ww-thanks" className={input} value={draft.thank_you_message ?? ""} onChange={(e) => setDraft({ ...draft, thank_you_message: e.target.value })} />
              </div>
              {save.isError && <div className="sm:col-span-2 text-[12.5px] text-danger-text">{extractApiError(save.error)}</div>}
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
                <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
