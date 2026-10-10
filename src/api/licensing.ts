import { api } from "./client"
import type { LicenseStatus } from "../types/api"

// apps.licensing — on-premise installations only; SaaS mode answers {mode: "saas"}.

export function getLicenseStatus() {
  return api.get<LicenseStatus>("/licensing/status/")
}

/** `license` is the .lic file's text contents. */
export function uploadLicense(license: string) {
  return api.post<LicenseStatus>("/licensing/upload/", { license })
}
