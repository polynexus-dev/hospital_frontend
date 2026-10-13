import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { StepConfigEditor } from "./StepConfigEditor"
import type { WorkflowStep } from "../../api/workflows"

vi.mock("../../api/communications", () => ({
  listTemplates: vi.fn().mockResolvedValue({ results: [{ id: 1, purpose: "camp_invite", channel: "whatsapp" }], count: 1 }),
}))

function show(step: WorkflowStep) {
  const onChange = vi.fn()
  render(<QueryClientProvider client={new QueryClient()}><StepConfigEditor step={step} onChange={onChange} /></QueryClientProvider>)
  return onChange
}

describe("StepConfigEditor", () => {
  it("edits a condition in plain words", async () => {
    const onChange = show({ order: 2, step_type: "condition", action_type: "create_task", title: "Only if", config: { field: "stage", op: "eq", value: "new" } })
    await userEvent.selectOptions(screen.getByLabelText("Value"), "contacted")
    expect(onChange).toHaveBeenLastCalledWith({ field: "stage", op: "eq", value: "contacted" })
    await userEvent.selectOptions(screen.getByLabelText("Field"), "score")
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ field: "score" }))
  })

  it("picks a message template, including the hospital's own", async () => {
    const onChange = show({ order: 3, step_type: "action", action_type: "send_whatsapp", title: "Send", config: {} })
    await userEvent.selectOptions(screen.getByLabelText("Message template"), await screen.findByRole("option", { name: "camp invite" }))
    expect(onChange).toHaveBeenLastCalledWith({ purpose: "camp_invite", template: undefined })
  })

  it("sets a real wait", async () => {
    const onChange = show({ order: 2, step_type: "action", action_type: "wait_delay", title: "Wait", config: { delay_minutes: 60 } })
    await userEvent.selectOptions(screen.getByLabelText("Wait"), "2880")
    expect(onChange).toHaveBeenLastCalledWith({ delay_minutes: 2880 })
  })
})
