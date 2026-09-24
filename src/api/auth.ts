import { api } from "./client"
import type { User } from "../types/api"

interface TokenPair {
  access: string
  refresh: string
  // Set when the account's role requires MFA (owner/admin/staff — see
  // apps.accounts.models.User.requires_mfa on the backend) but hasn't
  // enrolled yet. Not a hard block — real tokens are still returned — but
  // the caller should prompt enrollment (see TwoFactorAuthCard) rather
  // than silently ignore it.
  mfa_setup_required?: boolean
}

// The account has TOTP enabled (User.is_2fa_enabled) — no tokens are
// issued yet. mfa_token is a short-lived (5 min), single-purpose receipt
// for /auth/mfa/verify/, not a credential of its own.
interface MfaChallenge {
  mfa_required: true
  mfa_token: string
}

export type LoginResult = TokenPair | MfaChallenge

export function isMfaChallenge(result: LoginResult): result is MfaChallenge {
  return "mfa_required" in result && result.mfa_required === true
}

export function login(email: string, password: string) {
  return api.post<LoginResult>("/auth/login/", { email, password }, { skipAuth: true })
}

export function verifyMfa(mfaToken: string, otp: string) {
  return api.post<TokenPair>("/auth/mfa/verify/", { mfa_token: mfaToken, otp }, { skipAuth: true })
}

// Blacklists the refresh token server-side (rest_framework_simplejwt's
// TokenBlacklistView) so a token that's already been logged out of can't be
// replayed — without this, "logout" only ever cleared local state and the
// still-valid refresh token kept working until it naturally expired.
export function logoutRequest(refreshToken: string) {
  return api.post<void>("/auth/logout/", { refresh: refreshToken })
}

export function fetchMe() {
  return api.get<User>("/users/me/")
}

export function switchHospital(hospitalId: string, reason = "Hospital staff branch context") {
  return api.post<User>("/users/switch-hospital/", { hospital_id: hospitalId, reason })
}

// --- Two-factor authentication enrollment (apps.accounts.views.UserViewSet) ---

export interface TwoFactorSetup {
  secret: string
  provisioning_uri: string
}

export function setup2FA() {
  return api.post<TwoFactorSetup>("/users/2fa/setup/")
}

export function enable2FA(otp: string) {
  return api.post<{ is_2fa_enabled: boolean }>("/users/2fa/enable/", { otp })
}

export function disable2FA(password: string) {
  return api.post<{ is_2fa_enabled: boolean }>("/users/2fa/disable/", { password })
}
