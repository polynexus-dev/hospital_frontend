import { api } from "./client"
import type { Paginated } from "../types/api"

export interface Ward {
  id: number
  name: string
  ward_type: string
  department: number | null
  floor: string
  is_active: boolean
  created_at: string
}

export interface Room {
  id: number
  ward: number
  room_number: string
  room_type: string
  is_active: boolean
  created_at: string
}

export type BedStatus = "available" | "occupied" | "maintenance" | "reserved"

export interface Bed {
  id: number
  room: number
  bed_number: string
  bed_type: string
  status: BedStatus
  created_at: string
}

export function listWards() {
  return api.get<Paginated<Ward>>("/facilities/wards/")
}

export function listRooms(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Room>>(`/facilities/rooms/${qs ? `?${qs}` : ""}`)
}

export function listBeds(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Bed>>(`/facilities/beds/${qs ? `?${qs}` : ""}`)
}
