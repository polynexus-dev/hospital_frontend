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
      name: "Missed Call Service Recovery Automation",
      description: "Auto-creates callback task and sends WhatsApp template when an inbound call is missed",
      trigger_type: "missed_call",
      is_active: true,
      steps: [
        {
          order: 1,
          step_type: "trigger",
          action_type: "create_task",
          title: "Inbound Call Missed / Unanswered",
          config: { trigger: "missed_call" },
        },
        {
          order: 2,
          step_type: "condition",
          action_type: "create_task",
          title: "Filter: If New Lead or Detractor",
          config: { condition: "score <= 6" },
        },
        {
          order: 3,
          step_type: "action",
          action_type: "create_task",
          title: "Create Priority Callback Task",
          config: { title: "Chase Missed Call & Book OPD Slot" },
        },
        {
          order: 4,
          step_type: "action",
          action_type: "send_whatsapp",
          title: "Send WhatsApp Pre-Visit Registration Link",
          config: { template: "registration_invite" },
        },
      ],
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
      config: actionType === "wait_delay" ? { delay_minutes: 15 } : {},
    }
    setEditingWorkflow({ ...editingWorkflow, steps: [...currentSteps, newStep] })
  }

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case "urgent":
      case "high":
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200">
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
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Workflows & Rules Engine</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
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
      <div className="flex border-b border-slate-200 gap-6">
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
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
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
            <div className="p-6 rounded-xl space-y-6 bg-white border-2 border-emerald-500 shadow-lg ring-1 ring-emerald-500/20">
              <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg shadow-xs">
                    ⚡
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {editingWorkflow.id ? "Edit Workflow Chain" : "Create Visual Node Workflow"}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Configure trigger events, conditions, and automated node actions</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingWorkflow(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  ✕ Close Editor
                </button>
              </div>

              {/* Workflow Configuration Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1.5">
                    Workflow Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm font-medium shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none placeholder:text-slate-400"
                    placeholder="e.g. Missed Call Recovery"
                    value={editingWorkflow.name || ""}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1.5">
                    Trigger Event <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm font-medium shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                    value={editingWorkflow.trigger_type || "missed_call"}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, trigger_type: e.target.value as any })}
                  >
                    <option value="missed_call">📞 Missed Call / Unanswered Call</option>
                    <option value="enquiry_stage_changed">📈 Enquiry Stage Changed</option>
                    <option value="appointment_no_show">⏰ Appointment No-Show</option>
                    <option value="nps_detractor">⭐ NPS Detractor Rating Received</option>
                    <option value="patient_recall_due">🔁 Patient Recall Due (scheduled)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1.5">
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditingWorkflow({ ...editingWorkflow, is_active: !editingWorkflow.is_active })}
                    className={`w-full py-2 px-3.5 border rounded-lg text-sm font-semibold flex justify-between items-center transition-all shadow-xs cursor-pointer ${
                      editingWorkflow.is_active
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100"
                        : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${editingWorkflow.is_active ? "bg-emerald-600 animate-pulse" : "bg-slate-400"}`} />
                      <span>{editingWorkflow.is_active ? "Workflow Active State" : "Workflow Paused"}</span>
                    </span>
                    {editingWorkflow.is_active ? (
                      <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-600 text-white shadow-xs">ACTIVE</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-300 text-slate-800">INACTIVE</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Node Chain Canvas */}
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Node Chain Canvas</h3>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      Trigger ➔ Condition ➔ Action
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
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
                              ? "border-l-blue-600 border-blue-200 bg-blue-50/60"
                              : isCondition
                              ? "border-l-amber-600 border-amber-200 bg-amber-50/60"
                              : "border-l-emerald-600 border-emerald-200 bg-emerald-50/60"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                    isTrigger
                                      ? "bg-blue-100 text-blue-800 border-blue-300"
                                      : isCondition
                                      ? "bg-amber-100 text-amber-800 border-amber-300"
                                      : "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  }`}
                                >
                                  {step.step_type}
                                </span>
                                <span className="text-xs font-bold text-slate-500">
                                  • {step.action_type.replace("_", " ").toUpperCase()}
                                </span>
                              </div>
                              <h4 className="font-bold text-sm text-slate-900">{step.title}</h4>
                            </div>

                            {step.step_type !== "trigger" && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newSteps = editingWorkflow.steps?.filter((_, i) => i !== idx) || []
                                  setEditingWorkflow({ ...editingWorkflow, steps: newSteps })
                                }}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-100 px-2.5 py-1 rounded-md border border-rose-200 transition-colors cursor-pointer"
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
                <div className="pt-4 border-t border-slate-200 flex gap-2.5 flex-wrap items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Add Node:</span>
                  <button
                    type="button"
                    onClick={() => handleAddStep("condition", "create_task", "Filter: Condition Score <= 6")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>➕</span> Condition Node
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddStep("action", "create_task", "Action: Create Priority Task")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>⚡</span> Create Task Action
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddStep("action", "send_whatsapp", "Action: Send WhatsApp Notification")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-900 border border-teal-300 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>💬</span> Send WhatsApp Action
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddStep("action", "wait_delay", "Action: Wait 15 Minutes")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-300 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>⏱️</span> Wait Delay Timer
                  </button>
                </div>
              </div>

              {/* Drawer Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingWorkflow(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saveWorkflowMutation.isPending}
                  onClick={() => saveWorkflowMutation.mutate(editingWorkflow)}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {saveWorkflowMutation.isPending ? "Saving..." : "✓ Save Workflow Chain"}
                </button>
              </div>
            </div>
          )}

          {/* Active Workflows Cards */}
          {isWorkflowsLoading ? (
            <LoadingState />
          ) : workflows.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <p className="text-sm text-slate-500 font-medium">No custom workflows created yet.</p>
              <Button variant="primary" onClick={handleAddDefaultWorkflow}>
                + Create Demo Workflow Chain
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {workflows.map((wf) => (
                <Card key={wf.id} className="p-6 space-y-4 border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-lg font-bold text-slate-900">{wf.name}</h3>
                        {wf.is_active ? <SuccessTag>ACTIVE</SuccessTag> : <NeutralTag>INACTIVE</NeutralTag>}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{wf.description}</p>
                      <span className="inline-block mt-2 text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-md">
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
                        <div className="px-3 py-1.5 rounded-lg border text-xs font-semibold bg-white text-slate-800 border-slate-200 shadow-2xs">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">{step.step_type}</span>
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
            <Card className="p-4 border-l-4 border-emerald-500 bg-emerald-50/50 space-y-2 shadow-xs">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-slate-900">
                  ✨ Test Run Execution Completed for Workflow #{testRunResult.workflow}
                </h4>
                <button onClick={() => setTestRunResult(null)} className="text-xs font-bold text-slate-400 hover:text-slate-700">
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-600 font-medium">Status: <SuccessTag>{testRunResult.status}</SuccessTag></p>
              <div className="bg-slate-900 text-emerald-400 p-3 rounded-lg text-xs font-mono max-h-48 overflow-y-auto">
                {JSON.stringify(testRunResult.log_output, null, 2)}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: EXECUTION HISTORY LOGS */}
      {activeTab === "history" && (
        <Card className="overflow-hidden border border-slate-200 shadow-xs">
          {isRunsLoading ? (
            <LoadingState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5 font-bold">Run ID</th>
                    <th className="px-6 py-3.5 font-bold">Workflow</th>
                    <th className="px-6 py-3.5 font-bold">Trigger Event</th>
                    <th className="px-6 py-3.5 font-bold">Status</th>
                    <th className="px-6 py-3.5 font-bold">Executed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">
                        No workflow execution history logged yet. Run a workflow test above!
                      </td>
                    </tr>
                  ) : (
                    runs.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">#{r.id}</td>
                        <td className="px-6 py-4 font-semibold text-slate-800">{r.workflow_name || `Workflow #${r.workflow}`}</td>
                        <td className="px-6 py-4 text-slate-600">{r.trigger_event}</td>
                        <td className="px-6 py-4">
                          {r.status === "success" ? <SuccessTag>SUCCESS</SuccessTag> : <NeutralTag>{r.status}</NeutralTag>}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">{new Date(r.executed_at).toLocaleString()}</td>
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
          <div className="flex border-b border-slate-200 gap-6">
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
                    ? "border-emerald-600 text-emerald-700 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isTasksLoading && <LoadingState />}
          {!isTasksLoading && (
            <Card className="overflow-hidden border border-slate-200 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5 font-bold">Priority</th>
                      <th className="px-6 py-3.5 font-bold">Title</th>
                      <th className="px-6 py-3.5 font-bold">Status</th>
                      <th className="px-6 py-3.5 font-bold">Due At</th>
                      <th className="px-6 py-3.5 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {tasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">
                          No tasks in this queue.
                        </td>
                      </tr>
                    ) : (
                      tasks.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">{getPriorityBadge(t.priority)}</td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-900 block">{t.title}</span>
                            {t.description && <span className="text-xs text-slate-500">{t.description}</span>}
                          </td>
                          <td className="px-6 py-4">
                            <NeutralTag>{t.status.toUpperCase()}</NeutralTag>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">
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

          <Card className="p-6 space-y-4 border border-slate-200 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900">Configured SLA Escalation Rules</h2>
            {rules.length === 0 ? (
              <p className="text-sm text-slate-500 font-medium">No active escalation rules defined.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rules.map((rule) => (
                  <Card key={rule.id} className="p-4 border border-slate-200 space-y-2 shadow-2xs">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-900">{rule.name}</h3>
                      {rule.is_active ? <SuccessTag>ACTIVE</SuccessTag> : <NeutralTag>INACTIVE</NeutralTag>}
                    </div>
                    <p className="text-xs text-slate-600">
                      Target Domain: <span className="font-bold text-slate-800">{rule.applies_to}</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      Escalate After: <span className="font-bold text-slate-800">{rule.escalate_after_minutes} mins</span>
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

