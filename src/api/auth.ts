import { api } from "./client"
import type { User } from "../types/api"

interface TokenPair {
  access: string
  refresh: string
}

export function login(email: string, password: string) {
  return api.post<TokenPair>("/auth/login/", { email, password }, { skipAuth: true })
}

export function fetchMe() {
  return api.get<User>("/users/me/")
}

export function switchHospital(hospitalId: string) {
  return api.post<User>("/users/switch-hospital/", { hospital_id: hospitalId })
}

