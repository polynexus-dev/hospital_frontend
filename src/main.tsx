import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import "./index.css"
import "./i18n"
import { queryClient } from "./app/queryClient"
import { ErrorBoundary } from "./components/ui/ErrorBoundary"
import App from "./App.tsx"
import { initSession } from "./api/payloadCrypto"
import { endSessionIfNotKept } from "./store/auth"

endSessionIfNotKept()

// Attempt ECDH key exchange with the server before rendering.
// - If PAYLOAD_ENCRYPTION_ENABLED=True (production): handshake succeeds and all
//   API payloads will be AES-256-GCM encrypted at the application layer.
// - If PAYLOAD_ENCRYPTION_ENABLED=False (dev / Postman): server returns 404,
//   we catch silently and the app runs in plain-JSON mode with no UX impact.
initSession().catch((err) => {
  if (!String(err).includes("404")) {
    console.warn("[PayloadEncryption] Session init failed:", err)
  }
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)

