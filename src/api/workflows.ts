import { api } from "./client"
import type { Paginated } from "../types/api"

export interface WorkflowStep {
  id?: number
  order: number
  step_type: "trigger" | "condition" | "action"
  action_type: "create_task" | "send_whatsapp" | "send_sms" | "escalate" | "wait_delay"
  title: string
  config: Record<string, any>
}

export interface Workflow {
  id: number
  name: string
  description: string
  trigger_type: "missed_call" | "enquiry_stage_changed" | "appointment_no_show" | "nps_detractor"
  is_active: boolean
  steps: WorkflowStep[]
  created_at: string
  updated_at: string
}

export interface WorkflowRun {
  id: number
  workflow: number
  workflow_name: string
  trigger_event: string
  status: "success" | "failed" | "running"
  context: Record<string, any>
  log_output: Array<{
    step_order: number
    step_type: string
    action_type: string
    title: string
    status: string
    details: string
  }>
  executed_at: string
}

export function listWorkflows() {
  return api.get<Paginated<Workflow>>("/workflows/")
}

export function createWorkflow(payload: Partial<Workflow>) {
  return api.post<Workflow>("/workflows/", payload)
}

export function updateWorkflow(id: number, payload: Partial<Workflow>) {
  return api.put<Workflow>(`/workflows/${id}/`, payload)
}

export function deleteWorkflow(id: number) {
  return api.delete(`/workflows/${id}/`)
}

export function testRunWorkflow(id: number, sampleEvent?: Record<string, any>) {
  return api.post<WorkflowRun>(`/workflows/${id}/test_run/`, { sample_event: sampleEvent })
}

export function listWorkflowRuns() {
  return api.get<Paginated<WorkflowRun>>("/workflow-runs/?ordering=-executed_at")
}
