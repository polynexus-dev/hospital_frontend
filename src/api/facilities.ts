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

export interface ConfiguredBedType {
  id: string
  label: string
}

export interface BedPatientInfo {
  id: string
  name: string
  uhid: string
  admission_id?: string
}

export interface Bed {
  id: number
  room: number
  bed_number: string
  bed_type: string
  status: BedStatus
  patient?: BedPatientInfo | null
  created_at?: string
}

export interface CreateBedPayload {
  room: number
  bed_number: string
  bed_type: string
  status?: BedStatus
}

export interface UpdateBedPayload {
  room: number
  bed_number: string
  bed_type: string
  status: BedStatus
}

export interface PatchBedPayload {
  room?: number
  bed_number?: string
  bed_type?: string
  status?: BedStatus
}

export interface AssignBedPayload {
  patient: string | number
  admitting_doctor: string | number
  admission_type: "planned" | "emergency"
  admission_diagnosis?: string
}

// --- Ward APIs ---
export function listWards() {
  return api.get<Paginated<Ward>>("/facilities/wards/")
}

export function createWard(payload: Partial<Ward> & { name: string; ward_type: string }) {
  return api.post<Ward>("/facilities/wards/", payload)
}

// --- Room APIs ---
export function listRooms(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Room>>(`/facilities/rooms/${qs ? `?${qs}` : ""}`)
}

export function createRoom(payload: Partial<Room> & { ward: number; room_number: string; room_type: string }) {
  return api.post<Room>("/facilities/rooms/", payload)
}

// --- Bed APIs (Full CRUD) ---

/** GET: List Beds */
export function listBeds(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Bed>>(`/facilities/beds/${qs ? `?${qs}` : ""}`)
}

/** POST: Create Bed */
export function createBed(payload: CreateBedPayload) {
  return api.post<Bed>("/facilities/beds/", payload)
}

/** GET: Retrieve Bed by ID */
export function getBed(id: number) {
  return api.get<Bed>(`/facilities/beds/${id}/`)
}

/** PUT: Update (Full) Bed */
export function updateBed(id: number, payload: UpdateBedPayload) {
  return api.put<Bed>(`/facilities/beds/${id}/`, payload)
}

/** PATCH: Partial Update Bed */
export function patchBed(id: number, payload: PatchBedPayload) {
  return api.patch<Bed>(`/facilities/beds/${id}/`, payload)
}

/** DELETE: Delete Bed */
export function deleteBed(id: number) {
  return api.delete(`/facilities/beds/${id}/`)
}

/** POST: Assign Bed to Patient (/api/v1/facilities/beds/<bed_id>/assign/) */
export function assignBed(id: number | string, payload: AssignBedPayload) {
  return api.post(`/facilities/beds/${id}/assign/`, payload)
}

export interface UpdateBedStatusPayload {
  status: BedStatus | string
  patient?: string | number | null
}

/** POST: Update Bed Status (/api/v1/facilities/beds/<bed_id>/update_status/) */
export function updateBedStatus(
  id: number | string,
  payload: UpdateBedStatusPayload | BedStatus | string
) {
  const body = typeof payload === "string" ? { status: payload } : payload
  return api.post(`/facilities/beds/${id}/update_status/`, body)
}

/** GET: Fetch Configured Bed Types (/api/v1/facilities/beds/types/) */
export function getBedTypes() {
  return api.get<ConfiguredBedType[]>("/facilities/beds/types/")
}
