import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { NeutralTag, SuccessTag } from "../../components/ui/Pill"
import { LoadingState } from "../../components/ui/QueryStates"

import { claimTask, completeTask, listEscalationRules, listTasks } from "../../api/automation"
import {
  createWorkflow,
  listWorkflowRuns,
  listWorkflows,
  testRunWorkflow,
  updateWorkflow,
  type Workflow,
  type WorkflowStep,
} from "../../api/workflows"
import type { TaskPriority } from "../../types/api"

import { StepConfigEditor } from "./StepConfigEditor"
import { WorkflowTemplates } from "./WorkflowTemplates"
import { extractApiError } from "../../api/client"
import { viewRecord } from "../../store/recordViewer"
export function WorkflowsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"builder" | "history" | "tasks">("builder")
  const [selectedStatus, setSelectedStatus] = useState<string>("pending")
  const [editingWorkflow, setEditingWorkflow] = useState<Partial<Workflow> | null>(null)
  const [testRunResult, setTestRunResult] = useState<any>(null)

  // Fetch Workflows
  const { data: workflowsData, isLoading: isWorkflowsLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: listWorkflows,
    enabled: activeTab === "builder",
  })

  // Fetch Workflow Runs History
  const { data: runsData, isLoading: isRunsLoading } = useQuery({
    queryKey: ["workflow-runs"],
    queryFn: listWorkflowRuns,
    enabled: activeTab === "history",
  })

  // Fetch Tasks
  const { data: tasksData, isLoading: isTasksLoading } = useQuery({
    queryKey: ["automation-tasks", selectedStatus],
    queryFn: () => listTasks(selectedStatus ? { status: selectedStatus } : {}),
    enabled: activeTab === "tasks",
  })

  // Fetch Escalation Rules
  const { data: rulesData } = useQuery({
    queryKey: ["escalation-rules"],
    queryFn: listEscalationRules,
    enabled: activeTab === "tasks",
  })

  const saveWorkflowMutation = useMutation({
    mutationFn: (wf: Partial<Workflow>) =>
      wf.id ? updateWorkflow(wf.id, wf) : createWorkflow(wf),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] })
      setEditingWorkflow(null)
    },
  })

  const testRunMutation = useMutation({
    mutationFn: (id: number) => testRunWorkflow(id),
    onSuccess: (data) => {
      setTestRunResult(data)
      queryClient.invalidateQueries({ queryKey: ["workflow-runs"] })
    },
  })

  const claimMutation = useMutation({
    mutationFn: claimTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-tasks"] }),
  })

  const completeMutation = useMutation({
    mutationFn: completeTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-tasks"] }),
  })

  const workflows = workflowsData?.results ?? []
  const runs = runsData?.results ?? []
  const tasks = tasksData?.results ?? []
  const rules = rulesData?.results ?? []

  const handleAddDefaultWorkflow = () => {
    setEditingWorkflow({
      name: "",
      description: "",
      trigger_type: "enquiry_created",
      is_active: false,
      steps: [{ order: 1, step_type: "trigger", action_type: "create_task", title: "When it happens", config: {} }],
    })
  }

  const handleAddStep = (stepType: "condition" | "action", actionType: WorkflowStep["action_type"], title: string) => {
    if (!editingWorkflow) return
    const currentSteps = editingWorkflow.steps || []
    const newStep: WorkflowStep = {
      order: currentSteps.length + 1,
      step_type: stepType,
      action_type: actionType,
      title,
      config:
        stepType === "condition" ? { field: "stage", op: "eq", value: "new" }
        : actionType === "wait_delay" ? { delay_minutes: 1440 }
        : actionType === "send_whatsapp" || actionType === "send_sms" ? { purpose: "enquiry_follow_up", fallback_sms: true }
        : actionType === "send_email" ? { purpose: "enquiry_follow_up_email" }
        : actionType === "create_task" ? { title: "Follow up enquiry #{enquiry_id}", assign_to: "owner", priority: "normal", due_in_minutes: 60 }
        : {},
    }
    setEditingWorkflow({ ...editingWorkflow, steps: [...currentSteps, newStep] })
  }

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case "urgent":
      case "high":
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-danger-bg dark:bg-rose-900/40 text-danger-text dark:text-rose-200">
            {priority.toUpperCase()}
          </span>
        )
      default:
        return <NeutralTag>{priority.toUpperCase()}</NeutralTag>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
            <h1 className="text-2xl font-bold text-ink tracking-tight">Workflows & Rules Engine</h1>
          </div>
          <p className="text-sm text-ink-3 mt-1">
            Visual Node-Chain Builder, event-driven automation triggers, & execution history logs
          </p>
        </div>
        {activeTab === "builder" && !editingWorkflow && (
          <Button variant="primary" onClick={handleAddDefaultWorkflow} className="shadow-sm">
            + Create New Workflow
          </Button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-6">
        {[
          { key: "builder", label: "Visual Workflow Canvas", icon: "⚡" },
          { key: "history", label: "Execution History Logs", icon: "📋" },
          { key: "tasks", label: "Tasks & SLA Escalations", icon: "⏱️" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === tab.key
                ? "border-success text-success-text font-bold"
                : "border-transparent text-ink-4 hover:text-ink"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: VISUAL WORKFLOW CANVAS */}
      {activeTab === "builder" && (
        <div className="space-y-6">
          {/* Workflow Editor Card */}
          {editingWorkflow && (
            <div className="p-6 rounded-xl space-y-6 bg-white border-2 border-success shadow-lg ring-1 ring-success/20">
              <div className="flex justify-between items-center border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success-bg text-success-text flex items-center justify-center font-bold text-lg shadow-xs">
                    ⚡
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-ink">
                      {editingWorkflow.id ? "Edit Workflow Chain" : "Create Visual Node Workflow"}
                    </h2>
                    <p className="text-xs text-ink-4 font-medium">Configure trigger events, conditions, and automated node actions</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingWorkflow(null)}
                  className="px-3 py-1.5 rounded-lg border border-border-strong text-ink-2 hover:bg-chip-bg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  ✕ Close Editor
                </button>
              </div>

              {/* Workflow Configuration Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-page p-4 rounded-xl border border-border">
                <div>
                  <label className="text-xs font-bold text-ink-2 uppercase tracking-wide block mb-1.5">
                    Workflow Name <span className="text-danger-text">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2 bg-white text-ink border border-border-strong rounded-lg text-sm font-medium shadow-xs focus:ring-2 focus:ring-success focus:border-success focus:outline-none placeholder:text-slate-400"
                    placeholder="e.g. Missed Call Recovery"
                    value={editingWorkflow.name || ""}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-ink-2 uppercase tracking-wide block mb-1.5">
                    Trigger Event <span className="text-danger-text">*</span>
                  </label>
                  <select
                    className="w-full px-3.5 py-2 bg-white text-ink border border-border-strong rounded-lg text-sm font-medium shadow-xs focus:ring-2 focus:ring-success focus:border-success focus:outline-none"
                    value={editingWorkflow.trigger_type || "missed_call"}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, trigger_type: e.target.value as any })}
                  >
                    <option value="enquiry_created">🆕 New enquiry</option>
                    <option value="missed_call">📞 Missed Call / Unanswered Call</option>
                    <option value="enquiry_stage_changed">📈 Enquiry Stage Changed</option>
                    <option value="appointment_no_show">⏰ Appointment No-Show</option>
                    <option value="nps_detractor">⭐ NPS Detractor Rating Received</option>
                    <option value="patient_recall_due">🔁 Patient Recall Due (scheduled)</option>
                    <option value="enquiry_went_quiet">🤫 Lead Went Quiet (no reply for 2 days)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-ink-2 uppercase tracking-wide block mb-1.5">
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditingWorkflow({ ...editingWorkflow, is_active: !editingWorkflow.is_active })}
                    className={`w-full py-2 px-3.5 border rounded-lg text-sm font-semibold flex justify-between items-center transition-all shadow-xs cursor-pointer ${
                      editingWorkflow.is_active
                        ? "bg-success-bg border-success/25 text-success-text hover:bg-success-bg"
                        : "bg-chip-bg border-border-strong text-ink-2 hover:bg-border-soft"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${editingWorkflow.is_active ? "bg-success animate-pulse" : "bg-slate-400"}`} />
                      <span>{editingWorkflow.is_active ? "Workflow Active State" : "Workflow Paused"}</span>
                    </span>
                    {editingWorkflow.is_active ? (
                      <span className="px-2 py-0.5 text-xs font-bold rounded bg-success text-white shadow-xs">ACTIVE</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-bold rounded bg-border-strong text-ink">INACTIVE</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Node Chain Canvas */}
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-ink">Node Chain Canvas</h3>
                    <span className="text-[11px] font-semibold text-ink-4 bg-chip-bg px-2.5 py-0.5 rounded-full border border-border">
                      Trigger ➔ Condition ➔ Action
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-ink-4">
                    {editingWorkflow.steps?.length || 0} Step{(editingWorkflow.steps?.length || 0) === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {(editingWorkflow.steps || []).map((step, idx) => {
                    const isTrigger = step.step_type === "trigger"
                    const isCondition = step.step_type === "condition"

                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          {step.order}
                        </div>

                        <div
                          className={`flex-1 p-4 rounded-xl border-l-4 border transition-all shadow-xs ${
                            isTrigger
                              ? "border-l-brand border-brand-border bg-brand-tint/60"
                              : isCondition
                              ? "border-l-warning border-warning/30 bg-warning-bg/60"
                              : "border-l-success border-success/25 bg-success-bg/60"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                    isTrigger
                                      ? "bg-brand-tint text-brand-dark border-brand-border"
                                      : isCondition
                                      ? "bg-warning-bg text-warning-text border-warning/30"
                                      : "bg-success-bg text-success-text border-success/25"
                                  }`}
                                >
                                  {step.step_type}
                                </span>
                                <span className="text-xs font-bold text-ink-4">
                                  • {step.action_type.replace("_", " ").toUpperCase()}
                                </span>
                              </div>
                              <input
                                aria-label="Step name"
                                className="font-bold text-sm text-ink bg-transparent border-b border-transparent hover:border-border-strong focus:border-success focus:outline-none"
                                value={step.title}
                                onChange={(e) => {
                                  const steps = [...(editingWorkflow.steps || [])]
                                  steps[idx] = { ...step, title: e.target.value }
                                  setEditingWorkflow({ ...editingWorkflow, steps })
                                }}
                              />
                              <StepConfigEditor
                                step={step}
                                onChange={(config) => {
                                  const steps = [...(editingWorkflow.steps || [])]
                                  steps[idx] = { ...step, config }
                                  setEditingWorkflow({ ...editingWorkflow, steps })
                                }}
                              />
                            </div>

                            {step.step_type !== "trigger" && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newSteps = editingWorkflow.steps?.filter((_, i) => i !== idx) || []
                                  setEditingWorkflow({ ...editingWorkflow, steps: newSteps })
                                }}
                                className="text-xs font-semibold text-danger-text hover:text-danger-text hover:bg-danger-bg px-2.5 py-1 rounded-md border border-danger-border transition-colors cursor-pointer"
                              >
                                ✕ Remove Step
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Step Palette Buttons */}
                <div className="pt-4 border-t border-border flex gap-2.5 flex-wrap items-center bg-page p-3 rounded-xl border border-border">
                  <span className="text-xs font-bold text-ink-2 uppercase tracking-wide">Add Node:</span>
                  <button
                    type="button"
                    onClick={() => handleAddStep("condition", "create_task", "Only if…")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-warning-bg hover:bg-warning/30 text-warning-text border border-warning/30 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>➕</span> Condition Node
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddStep("action", "create_task", "Create a task")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-success-bg hover:bg-success/25 text-success-text border border-success/25 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>⚡</span> Create Task Action
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddStep("action", "send_whatsapp", "Send a WhatsApp message")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-accent-tint hover:bg-accent/25 text-accent-hover border border-accent/25 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>💬</span> Send WhatsApp Action
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddStep("action", "wait_delay", "Wait")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-tint hover:bg-brand-border text-brand-dark border border-brand-border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>⏱️</span> Wait Delay Timer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddStep("action", "send_sms", "Send an SMS")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-accent-tint hover:bg-accent/25 text-accent-hover border border-accent/25 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>✉️</span> Send SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddStep("action", "send_email", "Send an email")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-accent-tint hover:bg-accent/25 text-accent-hover border border-accent/25 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>📧</span> Send Email
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddStep("action", "escalate", "Escalate to a manager")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-danger-bg hover:bg-danger-bg text-danger-text border border-danger-border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>🚨</span> Escalate
                  </button>
                </div>
              </div>

              {saveWorkflowMutation.isError && (
                <div className="text-xs text-danger-text">{extractApiError(saveWorkflowMutation.error)}</div>
              )}
              {/* Drawer Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingWorkflow(null)}
                  className="px-4 py-2 text-xs font-semibold text-ink-3 hover:text-ink hover:bg-chip-bg rounded-lg border border-border-strong transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saveWorkflowMutation.isPending}
                  onClick={() => saveWorkflowMutation.mutate(editingWorkflow)}
                  className="px-5 py-2 text-xs font-bold text-white bg-success hover:bg-success-text disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {saveWorkflowMutation.isPending ? "Saving..." : "✓ Save Workflow Chain"}
                </button>
              </div>
            </div>
          )}

          {!editingWorkflow && <WorkflowTemplates onInstalled={(wf) => setEditingWorkflow(wf)} />}

          {/* Active Workflows Cards */}
          {isWorkflowsLoading ? (
            <LoadingState />
          ) : workflows.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <p className="text-sm text-ink-4 font-medium">No custom workflows created yet.</p>
              <Button variant="primary" onClick={handleAddDefaultWorkflow}>
                + Create a workflow
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {workflows.map((wf) => (
                <Card key={wf.id} className="p-6 space-y-4 border border-border shadow-xs hover:border-border-strong transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-lg font-bold text-ink">{wf.name}</h3>
                        {wf.is_active ? <SuccessTag>ACTIVE</SuccessTag> : <NeutralTag>INACTIVE</NeutralTag>}
                      </div>
                      <p className="text-xs text-ink-3 mt-1">{wf.description}</p>
                      <span className="inline-block mt-2 text-xs font-semibold px-2.5 py-1 bg-chip-bg text-ink-2 border border-border rounded-md">
                        Trigger: {wf.trigger_type}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={testRunMutation.isPending}
                        onClick={() => testRunMutation.mutate(wf.id)}
                      >
                        ⚡ Test Run
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingWorkflow(wf)}>
                        Edit Canvas
                      </Button>
                    </div>
                  </div>

                  {/* Node Chain Step Badges */}
                  <div className="flex items-center gap-2 overflow-x-auto py-2">
                    {(wf.steps || []).map((step, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-2 shrink-0">
                        <div className="px-3 py-1.5 rounded-lg border text-xs font-semibold bg-white text-ink border-border shadow-2xs">
                          <span className="text-[10px] text-ink-4 uppercase block font-bold">{step.step_type}</span>
                          {step.title || step.action_type}
                        </div>
                        {sIdx < (wf.steps?.length || 0) - 1 && <span className="text-slate-400 font-bold">➔</span>}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Test Run Result Modal Card */}
          {testRunResult && (
            <Card className="p-4 border-l-4 border-success bg-success-bg/50 space-y-2 shadow-xs">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-ink">
                  ✨ Test Run Execution Completed for Workflow #{testRunResult.workflow}
                </h4>
                <button onClick={() => setTestRunResult(null)} className="text-xs font-bold text-slate-400 hover:text-ink-2">
                  ✕
                </button>
              </div>
              <p className="text-xs text-ink-3 font-medium">Status: <SuccessTag>{testRunResult.status}</SuccessTag></p>
              <div className="bg-slate-900 text-emerald-400 p-3 rounded-lg text-xs font-mono max-h-48 overflow-y-auto">
                {JSON.stringify(testRunResult.log_output, null, 2)}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: EXECUTION HISTORY LOGS */}
      {activeTab === "history" && (
        <Card className="overflow-hidden border border-border shadow-xs">
          {isRunsLoading ? (
            <LoadingState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-ink-2">
                <thead className="bg-page text-ink-2 border-b border-border">
                  <tr>
                    <th className="px-6 py-3.5 font-bold">Run ID</th>
                    <th className="px-6 py-3.5 font-bold">Workflow</th>
                    <th className="px-6 py-3.5 font-bold">Trigger Event</th>
                    <th className="px-6 py-3.5 font-bold">Status</th>
                    <th className="px-6 py-3.5 font-bold">Executed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-ink-4 font-medium">
                        No workflow execution history logged yet. Run a workflow test above!
                      </td>
                    </tr>
                  ) : (
                    runs.map((r) => (
                      <tr key={r.id} onClick={(ev) => viewRecord(ev, r, { subtitle: "Workflow run" })} title="Click to view details" className="hover:bg-page/80 transition-colors cursor-pointer">
                        <td className="px-6 py-4 font-bold text-ink">#{r.id}</td>
                        <td className="px-6 py-4 font-semibold text-ink">{r.workflow_name || `Workflow #${r.workflow}`}</td>
                        <td className="px-6 py-4 text-ink-3">{r.trigger_event}</td>
                        <td className="px-6 py-4">
                          {r.status === "success" ? <SuccessTag>SUCCESS</SuccessTag> : <NeutralTag>{r.status === "waiting" && r.resume_at ? `waiting until ${new Date(r.resume_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : r.status === "stopped" ? "stopped by a condition" : r.status}</NeutralTag>}
                        </td>
                        <td className="px-6 py-4 text-xs text-ink-4">{new Date(r.executed_at).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: TASKS & SLA ESCALATIONS */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          <div className="flex border-b border-border gap-6">
            {[
              { key: "pending", label: "Pending Tasks" },
              { key: "in_progress", label: "In Progress" },
              { key: "done", label: "Completed Tasks" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedStatus(tab.key)}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  selectedStatus === tab.key
                    ? "border-success text-success-text font-bold"
                    : "border-transparent text-ink-4 hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isTasksLoading && <LoadingState />}
          {!isTasksLoading && (
            <Card className="overflow-hidden border border-border shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-ink-2">
                  <thead className="bg-page text-ink-2 border-b border-border">
                    <tr>
                      <th className="px-6 py-3.5 font-bold">Priority</th>
                      <th className="px-6 py-3.5 font-bold">Title</th>
                      <th className="px-6 py-3.5 font-bold">Status</th>
                      <th className="px-6 py-3.5 font-bold">Due At</th>
                      <th className="px-6 py-3.5 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-ink-4 font-medium">
                          No tasks in this queue.
                        </td>
                      </tr>
                    ) : (
                      tasks.map((t) => (
                        <tr key={t.id} onClick={(ev) => viewRecord(ev, t, { subtitle: "Task" })} title="Click to view details" className="hover:bg-page/80 transition-colors cursor-pointer">
                          <td className="px-6 py-4">{getPriorityBadge(t.priority)}</td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-ink block">{t.title}</span>
                            {t.description && <span className="text-xs text-ink-4">{t.description}</span>}
                          </td>
                          <td className="px-6 py-4">
                            <NeutralTag>{t.status.toUpperCase()}</NeutralTag>
                          </td>
                          <td className="px-6 py-4 text-xs text-ink-4">
                            {t.due_at ? new Date(t.due_at).toLocaleString() : "—"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {t.status === "pending" && (
                                <Button size="sm" variant="secondary" onClick={() => claimMutation.mutate(t.id)}>
                                  Claim Task
                                </Button>
                              )}
                              {t.status === "in_progress" && (
                                <Button size="sm" variant="primary" onClick={() => completeMutation.mutate(t.id)}>
                                  Complete
                                </Button>
                              )}
                              {t.status === "done" && <SuccessTag>DONE</SuccessTag>}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card className="p-6 space-y-4 border border-border shadow-xs">
            <h2 className="text-lg font-bold text-ink">Configured SLA Escalation Rules</h2>
            {rules.length === 0 ? (
              <p className="text-sm text-ink-4 font-medium">No active escalation rules defined.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rules.map((rule) => (
                  <Card key={rule.id} className="p-4 border border-border space-y-2 shadow-2xs">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-ink">{rule.name}</h3>
                      {rule.is_active ? <SuccessTag>ACTIVE</SuccessTag> : <NeutralTag>INACTIVE</NeutralTag>}
                    </div>
                    <p className="text-xs text-ink-3">
                      Target Domain: <span className="font-bold text-ink">{rule.applies_to}</span>
                    </p>
                    <p className="text-xs text-ink-3">
                      Escalate After: <span className="font-bold text-ink">{rule.escalate_after_minutes} mins</span>
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

