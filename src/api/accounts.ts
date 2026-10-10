import { api } from "./client"
import type { Paginated, PermissionMatrix, Role, User } from "../types/api"

export function listUsers() {
  return api.get<Paginated<User>>("/users/")
}

export function listRoles() {
  return api.get<Paginated<Role>>("/roles/")
}

export function updateUser(id: number, data: Partial<User> & { role?: number | null; is_active?: boolean }) {
  return api.patch<User>(`/users/${id}/`, data)
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
