import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { WebChatAlerts } from "./WebChatAlerts"
import { useAuthStore } from "../store/auth"

vi.mock("../api/client", () => ({ api: { get: vi.fn() } }))

const chat = (id: number, msg: number) => ({ thread: id, name: "Rohit Pawar", unread: 1, last_message_id: msg, preview: "Cardiologist on Sunday?", at: "2026-10-13T10:00:00Z" })

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{loc.pathname + loc.search}</div>
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WebChatAlerts />
        <Routes><Route path="*" element={<Where />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

describe("WebChatAlerts", () => {
  let tones: number
  beforeEach(async () => {
    tones = 0
    class FakeAudio {
      currentTime = 0
      destination = {}
      createOscillator() { tones += 1; return { type: "", frequency: { value: 0 }, connect: (g: unknown) => g, start() {}, stop() {} } }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (d: unknown) => d } }
      close() { return Promise.resolve() }
    }
    vi.stubGlobal("AudioContext", FakeAudio)
    localStorage.clear()
    useAuthStore.setState({ user: { id: 1, email: "a@b.c", hospital: "h1", permissions: ["communications.view_thread"], hospital_enabled_modules: [] } as never })
    const { api } = await import("../api/client")
    vi.mocked(api.get).mockReset()
  })

  it("rings and offers to open a new chat, but not for chats already waiting at sign-in", async () => {
    const { api } = await import("../api/client")
    vi.mocked(api.get)
      .mockResolvedValueOnce({ unread_chats: 1, chats: [chat(5, 10)] })
      .mockResolvedValue({ unread_chats: 2, chats: [chat(9, 22), chat(5, 10)] })
    const client = setup()
    await waitFor(() => expect(document.title).toMatch(/^\(1\)/))  // first load handled
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(tones).toBe(0)

    await act(() => client.refetchQueries({ queryKey: ["web-chat-alerts"] }))
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("New website chat: Rohit Pawar"))
    expect(tones).toBe(2)
    expect(document.title).toMatch(/^\(2\)/)

    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByTestId("where")).toHaveTextContent("/inbox?tab=webchat&thread=9")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("can be muted", async () => {
    const { api } = await import("../api/client")
    vi.mocked(api.get).mockResolvedValueOnce({ unread_chats: 0, chats: [] }).mockResolvedValue({ unread_chats: 1, chats: [chat(3, 7)] })
    const client = setup()
    await waitFor(() => expect(client.getQueryData(["web-chat-alerts"])).toBeDefined())
    await act(() => new Promise((r) => setTimeout(r, 0)))
    await act(() => client.refetchQueries({ queryKey: ["web-chat-alerts"] }))
    await userEvent.click(await screen.findByRole("button", { name: "Mute sound" }))
    expect(localStorage.getItem("pnx_chat_sound")).toBe("off")
  })

  it("stays silent for staff without Inbox access", async () => {
    const { api } = await import("../api/client")
    useAuthStore.setState({ user: { id: 2, email: "lab@b.c", hospital: "h1", permissions: ["laboratory.view_laborder"], hospital_enabled_modules: [] } as never })
    setup()
    await new Promise((r) => setTimeout(r, 50))
    expect(api.get).not.toHaveBeenCalled()
  })
})
