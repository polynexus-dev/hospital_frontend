/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_REQUIRE_PAYLOAD_ENCRYPTION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
