import { api } from "./client"
import type { Paginated, Role, User } from "../types/api"

export function listUsers() {
  return api.get<Paginated<User>>("/users/")
}

export function listRoles() {
  return api.get<Paginated<Role>>("/roles/")
}
