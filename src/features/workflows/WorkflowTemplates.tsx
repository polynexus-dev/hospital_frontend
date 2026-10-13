import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, extractApiError } from "../../api/client"
import type { Workflow } from "../../api/workflows"

interface WorkflowTemplate {
  key: string
  name: string
  description: string
  trigger_type: string
  steps: string[]
  installed: boolean
}

/** Ready-made workflows. Installing adds a switched-off copy to edit and turn on. */
export function WorkflowTemplates({ onInstalled }: { onInstalled: (wf: Workflow) => void }) {
  const queryClient = useQueryClient()
  const templates = useQuery({ queryKey: ["workflow-templates"], queryFn: () => api.get<WorkflowTemplate[]>("/workflows/templates/") })
  const install = useMutation({
    mutationFn: (key: string) => api.post<Workflow>("/workflows/install-template/", { key }),
    onSuccess: (wf) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] })
      queryClient.invalidateQueries({ queryKey: ["workflow-templates"] })
      onInstalled(wf)
    },
  })

  if (!templates.data?.length) return null
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-bold text-ink">Ready-made workflows</h3>
        <p className="text-xs text-ink-4">Install one, check its steps and message, then switch it on. Installed copies start switched off.</p>
      </div>
      {install.isError && <div className="text-xs text-danger-text">{extractApiError(install.error)}</div>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {templates.data.map((t) => (
          <div key={t.key} className="border border-border rounded-xl p-3.5 bg-white space-y-2">
            <div className="font-semibold text-[13.5px]">{t.name}</div>
            <p className="text-[12.5px] text-ink-3">{t.description}</p>
            <ol className="text-[12px] text-ink-4 list-decimal pl-5">{t.steps.slice(1).map((s) => <li key={s}>{s}</li>)}</ol>
            <button
              type="button"
              disabled={install.isPending}
              onClick={() => install.mutate(t.key)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-success/40 text-success-text hover:bg-success-bg disabled:opacity-50"
            >
              {t.installed ? "Install another copy" : "Install"}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
