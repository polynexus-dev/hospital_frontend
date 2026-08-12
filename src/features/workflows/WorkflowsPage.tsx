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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Workflows & Rules Engine</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Visual Node-Chain Builder, event-driven automation triggers, & execution history logs
          </p>
        </div>
        {activeTab === "builder" && !editingWorkflow && (
          <Button variant="primary" onClick={handleAddDefaultWorkflow}>
            + Create New Workflow
          </Button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        {[
          { key: "builder", label: "Visual Workflow Canvas" },
          { key: "history", label: "Execution History Logs" },
          { key: "tasks", label: "Tasks & SLA Escalations" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: VISUAL WORKFLOW CANVAS */}
      {activeTab === "builder" && (
        <div className="space-y-6">
          {/* Workflow Editor Drawer / Form */}
          {editingWorkflow && (
            <Card className="p-6 space-y-6 border-2 border-emerald-500">
              <div className="flex justify-between items-center border-b pb-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {editingWorkflow.id ? "Edit Workflow Chain" : "Create Visual Node Workflow"}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setEditingWorkflow(null)}>
                  ✕ Close Editor
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Workflow Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 text-sm"
                    value={editingWorkflow.name || ""}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">Trigger Event</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 text-sm"
                    value={editingWorkflow.trigger_type || "missed_call"}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, trigger_type: e.target.value as any })}
                  >
                    <option value="missed_call">📞 Missed Call / Unanswered Call</option>
                    <option value="enquiry_stage_changed">📈 Enquiry Stage Changed</option>
                    <option value="appointment_no_show">⏰ Appointment No-Show</option>
                    <option value="nps_detractor">⭐ NPS Detractor Rating Received</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">Status</label>
                  <button
                    type="button"
                    onClick={() => setEditingWorkflow({ ...editingWorkflow, is_active: !editingWorkflow.is_active })}
                    className="w-full py-2 px-3 border rounded-lg text-sm font-semibold flex justify-between items-center"
                  >
                    <span>Workflow Active State</span>
                    {editingWorkflow.is_active ? <SuccessTag>ACTIVE</SuccessTag> : <NeutralTag>INACTIVE</NeutralTag>}
                  </button>
                </div>
              </div>

              {/* Node Chain Canvas */}
              <div className="space-y-3 pt-3">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Node Chain Canvas (Trigger ➔ Condition ➔ Action)</h3>

                <div className="flex flex-col gap-3">
                  {(editingWorkflow.steps || []).map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {step.order}
                      </div>

                      <Card
                        className={`flex-1 p-4 border-l-4 ${
                          step.step_type === "trigger"
                            ? "border-blue-500 bg-blue-50/30 dark:bg-blue-950/20"
                            : step.step_type === "condition"
                            ? "border-amber-500 bg-amber-50/30 dark:bg-amber-950/20"
                            : "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {step.step_type} • {step.action_type}
                            </span>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{step.title}</h4>
                          </div>
                          {step.step_type !== "trigger" && (
                            <button
                              onClick={() => {
                                const newSteps = editingWorkflow.steps?.filter((_, i) => i !== idx) || []
                                setEditingWorkflow({ ...editingWorkflow, steps: newSteps })
                              }}
                              className="text-xs text-rose-500 hover:underline"
                            >
                              Remove Step
                            </button>
                          )}
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>

                {/* Step Palette Buttons */}
                <div className="pt-3 border-t flex gap-2 flex-wrap items-center">
                  <span className="text-xs font-semibold text-slate-400">Add Node:</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAddStep("condition", "create_task", "Filter: Condition Score <= 6")}
                  >
                    + Condition Node
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAddStep("action", "create_task", "Action: Create Priority Task")}
                  >
                    + Create Task Action
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAddStep("action", "send_whatsapp", "Action: Send WhatsApp Notification")}
                  >
                    + Send WhatsApp Action
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAddStep("action", "wait_delay", "Action: Wait 15 Minutes")}
                  >
                    + Wait Delay Timer
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button variant="ghost" onClick={() => setEditingWorkflow(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={saveWorkflowMutation.isPending}
                  onClick={() => saveWorkflowMutation.mutate(editingWorkflow)}
                >
                  {saveWorkflowMutation.isPending ? "Saving..." : "Save Workflow Chain"}
                </Button>
              </div>
            </Card>
          )}

          {/* Active Workflows Cards */}
          {isWorkflowsLoading ? (
            <LoadingState />
          ) : workflows.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <p className="text-sm text-slate-400">No custom workflows created yet.</p>
              <Button variant="primary" onClick={handleAddDefaultWorkflow}>
                + Create Demo Workflow Chain
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {workflows.map((wf) => (
                <Card key={wf.id} className="p-6 space-y-4 border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{wf.name}</h3>
                        {wf.is_active ? <SuccessTag>ACTIVE</SuccessTag> : <NeutralTag>INACTIVE</NeutralTag>}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{wf.description}</p>
                      <span className="inline-block mt-2 text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
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
                        <div className="px-3 py-1.5 rounded-lg border text-xs font-semibold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase block">{step.step_type}</span>
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
            <Card className="p-4 border-l-4 border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  ✨ Test Run Execution Completed for Workflow #{testRunResult.workflow}
                </h4>
                <button onClick={() => setTestRunResult(null)} className="text-xs font-bold text-slate-400">
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-500">Status: <SuccessTag>{testRunResult.status}</SuccessTag></p>
              <div className="bg-slate-900 text-emerald-400 p-3 rounded text-xs font-mono max-h-48 overflow-y-auto">
                {JSON.stringify(testRunResult.log_output, null, 2)}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: EXECUTION HISTORY LOGS */}
      {activeTab === "history" && (
        <Card className="overflow-hidden">
          {isRunsLoading ? (
            <LoadingState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Run ID</th>
                    <th className="px-6 py-3 font-semibold">Workflow</th>
                    <th className="px-6 py-3 font-semibold">Trigger Event</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Executed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                        No workflow execution history logged yet. Run a workflow test above!
                      </td>
                    </tr>
                  ) : (
                    runs.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">#{r.id}</td>
                        <td className="px-6 py-4 font-semibold">{r.workflow_name || `Workflow #${r.workflow}`}</td>
                        <td className="px-6 py-4">{r.trigger_event}</td>
                        <td className="px-6 py-4">
                          {r.status === "success" ? <SuccessTag>SUCCESS</SuccessTag> : <NeutralTag>{r.status}</NeutralTag>}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">{new Date(r.executed_at).toLocaleString()}</td>
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
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
            {[
              { key: "pending", label: "Pending Tasks" },
              { key: "in_progress", label: "In Progress" },
              { key: "done", label: "Completed Tasks" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedStatus(tab.key)}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                  selectedStatus === tab.key
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isTasksLoading && <LoadingState />}
          {!isTasksLoading && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Priority</th>
                      <th className="px-6 py-3 font-semibold">Title</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold">Due At</th>
                      <th className="px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {tasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                          No tasks in this queue.
                        </td>
                      </tr>
                    ) : (
                      tasks.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                          <td className="px-6 py-4">{getPriorityBadge(t.priority)}</td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">{t.title}</span>
                            {t.description && <span className="text-xs text-slate-400">{t.description}</span>}
                          </td>
                          <td className="px-6 py-4">
                            <NeutralTag>{t.status.toUpperCase()}</NeutralTag>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">
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

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Configured SLA Escalation Rules</h2>
            {rules.length === 0 ? (
              <p className="text-sm text-slate-400">No active escalation rules defined.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rules.map((rule) => (
                  <Card key={rule.id} className="p-4 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">{rule.name}</h3>
                      {rule.is_active ? <SuccessTag>ACTIVE</SuccessTag> : <NeutralTag>INACTIVE</NeutralTag>}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Target Domain: <span className="font-semibold text-slate-700 dark:text-slate-200">{rule.applies_to}</span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Escalate After: <span className="font-semibold text-slate-700 dark:text-slate-200">{rule.escalate_after_minutes} mins</span>
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
