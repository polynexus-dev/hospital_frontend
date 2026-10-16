import { api } from "./client"
import type { Paginated, PermissionMatrix, Role, User } from "../types/api"

export function listUsers() {
  return api.get<Paginated<User>>("/users/")
}

export function listRoles() {
  return api.get<Paginated<Role>>("/roles/")
}

export interface NewUserInput {
  email: string
  first_name: string
  last_name?: string
  phone?: string
  role: number
  department?: number | null
}

/** A login with no usable password yet — follow with issueTemporaryPassword. */
export function createUser(data: NewUserInput) {
  return api.post<User>("/users/", data)
}

export interface TemporaryPassword {
  user_id: number
  email: string
  temporary_password: string
  role?: string
}

/** One-time password for a new login or a reset; the user must change it at first sign-in. */
export function issueTemporaryPassword(id: number) {
  return api.post<TemporaryPassword>(`/users/${id}/temporary-password/`, {})
}

export function updateUser(id: number, data: Partial<User> & { role?: number | null; is_active?: boolean }) {
  return api.patch<User>(`/users/${id}/`, data)
}

export function updateRole(id: number, data: { data_scope?: "all" | "assigned_only"; name?: string; description?: string }) {
  return api.patch<Role>(`/roles/${id}/`, data)
}

export function createRole(data: { name: string; description?: string }) {
  return api.post<Role>("/roles/", data)
}

export function getRolePermissions(id: number) {
  return api.get<PermissionMatrix>(`/roles/${id}/permissions/`)
}

export function setRolePermissions(id: number, permissions: string[]) {
  return api.put<PermissionMatrix>(`/roles/${id}/permissions/`, { permissions })
}

export function getUserPermissions(id: number) {
  return api.get<PermissionMatrix>(`/users/${id}/permissions/`)
}

export function setUserPermissions(id: number, permissions: string[]) {
  return api.put<PermissionMatrix>(`/users/${id}/permissions/`, { permissions })
}
