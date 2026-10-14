import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { LoadingState } from "../../components/ui/QueryStates"
import { showToast } from "../../components/ui/Toast"
import { extractApiError } from "../../api/client"
import { listDepartments } from "../../api/doctors"
import {
  createIVRMenu,
  createIVRNode,
  deleteIVRNode,
  listIVRMenus,
  rotateIVRMenuToken,
  simulateIVRMenu,
  updateIVRMenu,
  updateIVRNode,
  type IVRAction,
  type IVRMenu,
  type IVRNode,
  type IVRReply,
} from "../../api/telephony"

const ACTIONS: { value: IVRAction; label: string }[] = [
  { value: "menu", label: "Play a sub-menu" },
  { value: "language", label: "Choose language" },
  { value: "queue", label: "Connect to a queue" },
  { value: "info", label: "Read a message" },
  { value: "callback", label: "Book a callback" },
  { value: "booking_link", label: "Send booking link" },
]
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "mr", label: "Marathi" },
]
const input = "w-full h-8 px-2.5 border border-border-strong rounded-control text-[13px] bg-page outline-none focus:border-brand"

/** Settings for the phone menu callers hear: built here, served to the PBX
 *  through the dynamic IVR webhooks (backend apps.telephony.ivr). */
export function PhoneMenuPage() {
  const queryClient = useQueryClient()
  const menus = useQuery({ queryKey: ["ivr-menus"], queryFn: listIVRMenus })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const list = menus.data?.results ?? []
  const menu = list.find((m) => m.id === selectedId) ?? list[0]

  const create = useMutation({
    mutationFn: async () => {
      const m = await createIVRMenu({ name: "Main line" })
      await createIVRNode({ menu: m.id, label: "Welcome", action: "menu", prompt: "" })
      return m
    },
    onSuccess: (m) => {
      setSelectedId(m.id)
      queryClient.invalidateQueries({ queryKey: ["ivr-menus"] })
    },
    onError: (e) => showToast(extractApiError(e), "error"),
  })

  if (menus.isLoading) return <LoadingState />
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">Phone Menu</h1>
          <p className="text-[13px] text-ink-4 mt-0.5">What callers hear and press, their place in the queue, and what they can do while they wait.</p>
        </div>
        <div className="flex items-center gap-2">
          {list.length > 1 && (
            <select aria-label="Menu" className="h-8 px-2 border border-border-strong rounded-control text-[13px]" value={menu?.id} onChange={(e) => setSelectedId(Number(e.target.value))}>
              {list.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          <Button variant={list.length ? "secondary" : "primary"} onClick={() => create.mutate()} disabled={create.isPending}>+ New phone menu</Button>
        </div>
      </div>
      {menus.isError && <div className="text-[13px] text-danger-text">{extractApiError(menus.error)}</div>}
      {!menu && !menus.isError && (
        <Card padded>
          <div className="text-[13px] text-ink-3">No phone menu yet. Create one, add options, try it in the simulator, then give the webhook URLs to your phone system provider.</div>
        </Card>
      )}
      {menu && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-3.5 items-start">
          <div className="flex flex-col gap-3.5">
            <MenuTree menu={menu} />
            <HoldSettings key={menu.id} menu={menu} />
          </div>
          <div className="flex flex-col gap-3.5">
            <Simulator key={menu.id} menu={menu} />
            <Webhooks menu={menu} />
          </div>
        </div>
      )}
    </div>
  )
}

function MenuTree({ menu }: { menu: IVRMenu }) {
  const root = menu.nodes.find((n) => n.parent === null)
  return (
    <Card>
      <div className="px-3.5 py-3 border-b border-border flex items-center gap-2">
        <div className="text-[13px] font-semibold">Menu options</div>
        <div className="text-[12px] text-ink-4">the key callers press at each level</div>
      </div>
      <div className="p-3.5">{root ? <NodeEditor menu={menu} node={root} depth={0} /> : <div className="text-[13px] text-ink-4">This menu has no welcome message yet.</div>}</div>
    </Card>
  )
}

function NodeEditor({ menu, node, depth }: { menu: IVRMenu; node: IVRNode; depth: number }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const children = menu.nodes.filter((n) => n.parent === node.id).sort((a, b) => a.digit.localeCompare(b.digit))
  const usedDigits = new Set(children.map((c) => c.digit))
  const nextDigit = "123456789*#0".split("").find((d) => !usedDigits.has(d)) ?? ""
  const hasChildren = node.action === "menu" || node.action === "language"

  const add = useMutation({
    mutationFn: () => createIVRNode({ menu: menu.id, parent: node.id, digit: nextDigit, label: "New option", action: "info", prompt: "Please edit this message." }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ivr-menus"] }),
    onError: (e) => showToast(extractApiError(e), "error"),
  })
  const remove = useMutation({
    mutationFn: () => deleteIVRNode(node.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ivr-menus"] }),
    onError: (e) => showToast(extractApiError(e), "error"),
  })

  return (
    <div className={depth ? "ml-5 border-l-2 border-border-soft pl-3 mt-2" : ""}>
      <div className="flex items-start gap-2.5">
        {node.parent !== null && (
          <div className="w-7 h-7 rounded-control bg-brand-tint text-brand font-semibold flex items-center justify-center flex-none font-mono">{node.digit}</div>
        )}
        <div className="flex-1 min-w-0">
          {editing ? (
            <NodeForm node={node} onDone={() => setEditing(false)} />
          ) : (
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">
                  {node.label}
                  <span className="ml-2 text-[11.5px] font-normal text-ink-4">{ACTIONS.find((a) => a.value === node.action)?.label}{node.action === "queue" && node.queue_target ? ` → ${node.queue_target}` : ""}{node.action === "language" ? ` (${node.language})` : ""}</span>
                </div>
                <div className="text-[12px] text-ink-3 leading-relaxed">{node.prompt || (hasChildren ? <i className="text-ink-4">Options are read out automatically: "For {children[0]?.label ?? "…"}, press {children[0]?.digit ?? "1"}."</i> : "")}</div>
              </div>
              <button onClick={() => setEditing(true)} className="text-[12px] font-semibold text-brand">Edit</button>
              {node.parent !== null && (
                <button onClick={() => window.confirm(`Delete "${node.label}" and everything under it?`) && remove.mutate()} className="text-[12px] font-semibold text-danger-text">Delete</button>
              )}
            </div>
          )}
        </div>
      </div>
      {hasChildren && (
        <>
          {children.map((c) => <NodeEditor key={c.id} menu={menu} node={c} depth={depth + 1} />)}
          {nextDigit && (
            <button onClick={() => add.mutate()} disabled={add.isPending} className="ml-5 mt-2 text-[12px] font-semibold text-brand">
              + Add option (key {nextDigit})
            </button>
          )}
        </>
      )}
    </div>
  )
}

function NodeForm({ node, onDone }: { node: IVRNode; onDone: () => void }) {
  const queryClient = useQueryClient()
  const departments = useQuery({ queryKey: ["departments"], queryFn: listDepartments })
  const [draft, setDraft] = useState<IVRNode>(node)
  const set = (patch: Partial<IVRNode>) => setDraft((d) => ({ ...d, ...patch }))
  const save = useMutation({
    mutationFn: () => updateIVRNode(node.id, {
      digit: draft.digit, label: draft.label, action: draft.action, prompt: draft.prompt, language: draft.language,
      department: draft.department, queue_target: draft.queue_target, queue_agents: draft.queue_agents,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ivr-menus"] })
      onDone()
    },
    onError: (e) => showToast(extractApiError(e), "error"),
  })
  const isRoot = node.parent === null
  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-surface">
      <div className="grid grid-cols-[70px_1fr_1fr] gap-2">
        <label className="text-[11px] text-ink-4">Key
          <input className={input} value={draft.digit} maxLength={1} disabled={isRoot} onChange={(e) => set({ digit: e.target.value })} />
        </label>
        <label className="text-[11px] text-ink-4">Name
          <input className={input} value={draft.label} onChange={(e) => set({ label: e.target.value })} />
        </label>
        <label className="text-[11px] text-ink-4">Does
          <select className={input} value={draft.action} onChange={(e) => set({ action: e.target.value as IVRAction })}>
            {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>
      </div>
      {draft.action === "language" && (
        <label className="text-[11px] text-ink-4 block">Language
          <select className={input} value={draft.language} onChange={(e) => set({ language: e.target.value })}>
            <option value="">Choose…</option>
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
      )}
      {(draft.action === "queue" || draft.action === "callback") && (
        <label className="text-[11px] text-ink-4 block">Department
          <select className={input} value={draft.department ?? ""} onChange={(e) => set({ department: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Any</option>
            {(departments.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      )}
      {draft.action === "queue" && (
        <div className="grid grid-cols-[1fr_140px] gap-2">
          <label className="text-[11px] text-ink-4">Phone system queue / ring group / extension
            <input className={input} value={draft.queue_target} onChange={(e) => set({ queue_target: e.target.value })} placeholder="e.g. 600" />
          </label>
          <label className="text-[11px] text-ink-4">Staff answering it
            <input className={input} type="number" min={1} value={draft.queue_agents} onChange={(e) => set({ queue_agents: Number(e.target.value) || 1 })} />
          </label>
        </div>
      )}
      <label className="text-[11px] text-ink-4 block">
        {draft.action === "info" ? "Message the caller hears" : draft.action === "menu" || draft.action === "language" ? "What the caller hears (leave empty to read the options out automatically)" : "Message (optional)"}
        <textarea rows={2} className="w-full border border-border-strong rounded-control p-2 text-[13px] bg-page outline-none focus:border-brand" value={draft.prompt} onChange={(e) => set({ prompt: e.target.value })} />
      </label>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button size="sm" variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  )
}

function HoldSettings({ menu }: { menu: IVRMenu }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(menu)
  const save = useMutation({
    mutationFn: () => updateIVRMenu(menu.id, {
      name: draft.name, dial_in_number: draft.dial_in_number, is_active: draft.is_active, fallback_target: draft.fallback_target,
      hold_announce_seconds: draft.hold_announce_seconds, hold_info_text: draft.hold_info_text, booking_url: draft.booking_url,
    }),
    onSuccess: () => {
      showToast("Phone menu saved.", "success")
      queryClient.invalidateQueries({ queryKey: ["ivr-menus"] })
    },
    onError: (e) => showToast(extractApiError(e), "error"),
  })
  const set = (patch: Partial<IVRMenu>) => setDraft((d) => ({ ...d, ...patch }))
  return (
    <Card padded>
      <Eyebrow>Menu settings and hold menu</Eyebrow>
      <div className="grid sm:grid-cols-2 gap-2.5">
        <label className="text-[11px] text-ink-4">Name<input className={input} value={draft.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="text-[11px] text-ink-4">Number callers dial<input className={input} value={draft.dial_in_number} onChange={(e) => set({ dial_in_number: e.target.value })} /></label>
        <label className="text-[11px] text-ink-4">After 3 wrong keys, connect to (empty: say goodbye)<input className={input} value={draft.fallback_target} onChange={(e) => set({ fallback_target: e.target.value })} placeholder="e.g. reception extension 100" /></label>
        <label className="text-[11px] text-ink-4">Repeat queue position every (seconds)<input className={input} type="number" min={15} value={draft.hold_announce_seconds} onChange={(e) => set({ hold_announce_seconds: Number(e.target.value) || 45 })} /></label>
        <label className="text-[11px] text-ink-4 sm:col-span-2">Press 2 while waiting: information read out (empty: key 2 is off)
          <textarea rows={2} className="w-full border border-border-strong rounded-control p-2 text-[13px] bg-page outline-none focus:border-brand" value={draft.hold_info_text} onChange={(e) => set({ hold_info_text: e.target.value })} placeholder="e.g. OPD is open 9 am to 5 pm, Monday to Saturday." />
        </label>
        <label className="text-[11px] text-ink-4 sm:col-span-2">Press 3 while waiting: booking link sent by WhatsApp / SMS (empty: key 3 is off)
          <input className={input} value={draft.booking_url} onChange={(e) => set({ booking_url: e.target.value })} placeholder="https://" />
        </label>
        <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={draft.is_active} onChange={(e) => set({ is_active: e.target.checked })} /> Active</label>
      </div>
      <div className="text-[11.5px] text-ink-4 mt-2">Callers waiting in a queue always hear their place in line and the expected wait, and can press 1 for a callback instead of waiting.</div>
      <div className="flex justify-end mt-2"><Button variant="primary" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Save settings</Button></div>
    </Card>
  )
}

function Simulator({ menu }: { menu: IVRMenu }) {
  const [callId, setCallId] = useState<string | undefined>()
  const [log, setLog] = useState<{ who: "caller" | "system"; text: string }[]>([])
  const [last, setLast] = useState<IVRReply | null>(null)
  const send = useMutation({
    mutationFn: ({ digits, fresh = false }: { digits: string; fresh?: boolean }) =>
      fresh ? simulateIVRMenu(menu.id, {}) : simulateIVRMenu(menu.id, { call_id: callId, digits, hold: last?.action === "queue" || last?.action === "hold" }),
    onSuccess: (r, { digits }) => {
      setCallId(r.call_id)
      setLast(r)
      const extra = r.action === "queue" ? ` [joins queue ${r.target}]` : r.action === "transfer" ? ` [transferred to ${r.target}]` : r.action === "hangup" ? " [call ends]" : ""
      setLog((l) => [...l, ...(digits ? [{ who: "caller" as const, text: `pressed ${digits}` }] : []), { who: "system", text: `${r.say}${extra}` }])
    },
    onError: (e) => showToast(extractApiError(e), "error"),
  })
  const ended = last?.action === "hangup" || last?.action === "transfer"
  const restart = () => { setCallId(undefined); setLog([]); setLast(null) }
  return (
    <Card padded>
      <Eyebrow>Try it</Eyebrow>
      <div className="text-[11.5px] text-ink-4 mb-2">Walk through the menu as a caller would. Test calls never enter the real queue or book a callback.</div>
      <div className="border border-border rounded-lg bg-page p-2.5 h-56 overflow-y-auto space-y-1.5 text-[12.5px]">
        {log.length === 0 && <div className="text-ink-4">Press "Call" to start.</div>}
        {log.map((l, i) => (
          <div key={i} className={l.who === "caller" ? "text-right text-brand font-semibold" : "text-ink-2"}>{l.text}</div>
        ))}
      </div>
      {last?.position !== undefined && !ended && <div className="text-[11.5px] text-ink-4 mt-1">Place in line: {last.position}</div>}
      <div className="grid grid-cols-6 gap-1.5 mt-2">
        {"123456789*0#".split("").map((d) => (
          <button key={d} disabled={!callId || ended || send.isPending} onClick={() => send.mutate({ digits: d })} className="h-8 rounded-control border border-border-strong font-mono font-semibold disabled:opacity-40 hover:bg-brand-tint">{d}</button>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        {!callId || ended ? (
          <Button variant="primary" size="sm" className="flex-1" onClick={() => { restart(); send.mutate({ digits: "", fresh: true }) }} disabled={send.isPending}>Call</Button>
        ) : (
          <>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => send.mutate({ digits: "" })} disabled={send.isPending}>No key (timeout)</Button>
            <Button variant="secondary" size="sm" onClick={restart}>Hang up</Button>
          </>
        )}
      </div>
    </Card>
  )
}

function Webhooks({ menu }: { menu: IVRMenu }) {
  const queryClient = useQueryClient()
  const rotate = useMutation({
    mutationFn: () => rotateIVRMenuToken(menu.id),
    onSuccess: () => {
      showToast("New URLs made. Update them in the phone system now; the old ones have stopped working.", "success")
      queryClient.invalidateQueries({ queryKey: ["ivr-menus"] })
    },
    onError: (e) => showToast(extractApiError(e), "error"),
  })
  const rows: [string, string, string][] = [
    ["Each menu step", menu.webhooks.step, '{"call_id", "caller", "digits"}'],
    ["While waiting in queue", menu.webhooks.hold, '{"call_id", "digits"}'],
    ["Answered / hung up", menu.webhooks.event, '{"call_id", "event": "answered" | "hangup"}'],
  ]
  return (
    <Card padded>
      <Eyebrow>Connect your phone system</Eyebrow>
      <div className="text-[11.5px] text-ink-4 mb-2">
        Give these to your phone system provider (HoduPBX or any PBX with an HTTP / dynamic IVR step). It sends the call id and the
        key pressed; we reply with what to say and do next. Keep them private: anyone with a URL can drive this menu.
      </div>
      <div className="space-y-2">
        {rows.map(([label, url, body]) => (
          <div key={label}>
            <div className="text-[11px] font-semibold text-ink-3">{label} <span className="font-normal text-ink-4">POST {body}</span></div>
            <div className="flex gap-1.5">
              <input readOnly value={url} className={`${input} font-mono text-[11.5px]`} onFocus={(e) => e.target.select()} />
              <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(url).then(() => showToast("Copied.", "success"))}>Copy</Button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => window.confirm("Make new URLs? The phone system stops working with this menu until you update it.") && rotate.mutate()} className="mt-2 text-[12px] font-semibold text-danger-text">
        Make new URLs
      </button>
    </Card>
  )
}
