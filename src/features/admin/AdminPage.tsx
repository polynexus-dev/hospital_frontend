import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardHeader, Eyebrow } from "../../components/ui/Card"
import { StatTile } from "../../components/ui/StatTile"
import { Button } from "../../components/ui/Button"
import { NeutralTag, Pill, SuccessTag } from "../../components/ui/Pill"
import { ErrorState, EmptyState, LoadingState } from "../../components/ui/QueryStates"
import { listRoles, listUsers } from "../../api/accounts"
import { listAuditLogs } from "../../api/core"
import { integrationHealth } from "../../api/integrations"
import { API_BASE_URL } from "../../api/client"
import type { AuditLog } from "../../types/api"
import type { Tone } from "../../components/ui/tone"

type TabKey = "users" | "roles" | "export" | "audit" | "integrations"

const TABS: { key: TabKey; label: string }[] = [
  { key: "users", label: "User Directory" },
  { key: "roles", label: "Roles & RBAC" },
  { key: "export", label: "CSV & FHIR Exporter" },
  { key: "audit", label: "Audit Trail" },
  { key: "integrations", label: "Integration Health" },
]

const FHIR_EXPORTS = [
  { id: "patients", name: "FHIR Patient Bundle", desc: "HL7 FHIR R4 Patient JSON resources", label: "Download FHIR Patient JSON ↓" },
  { id: "appointments", name: "FHIR Appointment Bundle", desc: "HL7 FHIR R4 Appointment JSON resources", label: "Download FHIR Appointment JSON ↓" },
  { id: "all", name: "Complete FHIR Bundle", desc: "All hospital patient & visit resources", label: "Download Complete FHIR JSON ↓" },
]

const CSV_EXPORTS = [
  { id: "patients", name: "Patients Directory", desc: "All patient 360 demographics & insurance" },
  { id: "enquiries", name: "Enquiries & Leads", desc: "Pipeline leads with source attribution & SLA" },
  { id: "appointments", name: "OPD Appointments", desc: "Consultation bookings & status history" },
  { id: "calls", name: "Telephony Calls Log", desc: "Inbound/outbound call durations & outcomes" },
  { id: "messages", name: "Omnichannel Messages", desc: "Sent and received message logs" },
  { id: "feedback", name: "NPS & Complaints", desc: "NPS scores & service recovery resolutions" },
]

const ACTION_TONE: Record<AuditLog["action"], Tone> = {
  create: "ok",
  update: "info",
  delete: "bad",
  read: "neutral",
  request: "neutral",
}

function auditDetail(log: AuditLog): string {
  if (log.object_repr) return log.object_repr
  return log.object_id ? `${log.model_name} #${log.object_id}` : log.model_name
}

function formatSyncedAt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "never synced"
}

function formatRunAt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "never run"
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("users")
  const [exportingModel, setExportingModel] = useState<string | null>(null)

  const { data: usersData, isLoading: isUsersLoading, isError: isUsersError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
    enabled: activeTab === "users",
  })

  const { data: rolesData, isLoading: isRolesLoading } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => listRoles(),
    enabled: activeTab === "roles",
  })

  const { data: auditData, isLoading: isAuditLoading, isError: isAuditError } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: () => listAuditLogs(),
    enabled: activeTab === "audit",
  })

  const { data: healthData, isLoading: isHealthLoading, isError: isHealthError } = useQuery({
    queryKey: ["admin-integration-health"],
    queryFn: () => integrationHealth(),
    enabled: activeTab === "integrations",
  })

  const handleCsvExport = (modelName: string) => {
    setExportingModel(modelName)
    window.open(`${API_BASE_URL}/export/${modelName}/`, "_blank")
    setTimeout(() => setExportingModel(null), 1000)
  }

  const handleFhirExport = (resourceType: string) => {
    setExportingModel(`fhir_${resourceType}`)
    window.open(`${API_BASE_URL}/export/fhir/${resourceType}/`, "_blank")
    setTimeout(() => setExportingModel(null), 1000)
  }

  const users = usersData?.results ?? []
  const roles = rolesData?.results ?? []
  const auditLogs = auditData?.results ?? []

  const isStubConnector = healthData?.his_connector === "stub"
  const connectorLabel = healthData ? (isStubConnector ? "Stub (not connected)" : healthData.his_connector) : "—"
  const connectorTone: Tone = isStubConnector ? "warn" : "ok"

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px px-3 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-brand text-brand"
                : "border-transparent text-ink-4 hover:text-ink-2"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* User Directory */}
      {activeTab === "users" && (
        <Card>
          <CardHeader>
            <div className="text-[13px] font-semibold">User directory</div>
            <div className="text-[12px] text-ink-4">access accounts for this tenant hospital</div>
          </CardHeader>
          <div className="px-3.5 overflow-x-auto">
            <div className="grid grid-cols-[1.3fr_1.6fr_1.1fr_0.7fr_0.9fr] gap-2.5 py-2.5 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold min-w-[760px]">
              <div>User</div>
              <div>Email</div>
              <div>Role</div>
              <div>Language</div>
              <div>Status</div>
            </div>
            {isUsersLoading && <LoadingState />}
            {isUsersError && <ErrorState />}
            {!isUsersLoading && !isUsersError && users.map((u) => (
              <div key={u.id} className="grid grid-cols-[1.3fr_1.6fr_1.1fr_0.7fr_0.9fr] gap-2.5 py-2.5 border-b border-border-faint items-center text-[13px] min-w-[760px]">
                <div className="font-semibold truncate">
                  {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.email}
                </div>
                <div className="text-ink-3 truncate">{u.email}</div>
                <div className="text-ink-3 truncate">{u.role_name || (u.is_staff ? "Administrator" : "Staff")}</div>
                <div className="uppercase"><NeutralTag>{u.preferred_language}</NeutralTag></div>
                <div>{u.is_active ? <SuccessTag>ACTIVE</SuccessTag> : <NeutralTag>INACTIVE</NeutralTag>}</div>
              </div>
            ))}
            {!isUsersLoading && !isUsersError && users.length === 0 && (
              <EmptyState message="No users registered in this tenant hospital." />
            )}
          </div>
        </Card>
      )}

      {/* Roles & RBAC */}
      {activeTab === "roles" && (
        <Card>
          <CardHeader>
            <div className="text-[13px] font-semibold">Hospital roles</div>
            <div className="text-[12px] text-ink-4">backed by Django groups</div>
          </CardHeader>
          <div className="p-3.5">
            {isRolesLoading ? (
              <LoadingState />
            ) : roles.length === 0 ? (
              <EmptyState message="No custom roles defined yet." />
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {roles.map((r) => (
                  <Card key={r.id} padded>
                    <div className="flex justify-between items-center gap-2">
                      <div className="text-[13px] font-semibold">{r.name}</div>
                      <NeutralTag>Role #{r.id}</NeutralTag>
                    </div>
                    {r.description && <div className="text-[12px] text-ink-4 mt-1">{r.description}</div>}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* CSV & FHIR Exporter */}
      {activeTab === "export" && (
        <div className="flex flex-col gap-3.5">
          <Card>
            <CardHeader>
              <div className="text-[13px] font-semibold">HL7 FHIR R4 standard export</div>
              <SuccessTag>FHIR R4 compliant</SuccessTag>
            </CardHeader>
            <div className="p-3.5">
              <div className="text-[12px] text-ink-4 mb-3">
                Export structured FHIR Patient and Appointment resources as standardized JSON bundles for healthcare
                interoperability.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {FHIR_EXPORTS.map((exp) => (
                  <Card key={exp.id} padded className="flex flex-col justify-between gap-2.5">
                    <div>
                      <div className="text-[13px] font-semibold">{exp.name}</div>
                      <div className="text-[12px] text-ink-4 mt-1">{exp.desc}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={exportingModel === `fhir_${exp.id}`}
                      onClick={() => handleFhirExport(exp.id)}
                    >
                      {exportingModel === `fhir_${exp.id}` ? "Exporting..." : exp.label}
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-[13px] font-semibold">Self-service CSV data exporter</div>
              <div className="text-[12px] text-ink-4">raw datasets for offline MIS reporting or compliance auditing</div>
            </CardHeader>
            <div className="p-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {CSV_EXPORTS.map((exp) => (
                  <Card key={exp.id} padded className="flex flex-col justify-between gap-2.5">
                    <div>
                      <div className="text-[13px] font-semibold">{exp.name}</div>
                      <div className="text-[12px] text-ink-4 mt-1">{exp.desc}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={exportingModel === exp.id}
                      onClick={() => handleCsvExport(exp.id)}
                    >
                      {exportingModel === exp.id ? "Exporting..." : "Download CSV ↓"}
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Audit Trail */}
      {activeTab === "audit" && (
        <Card>
          <CardHeader>
            <div className="text-[13px] font-semibold">Audit trail</div>
            <div className="text-[12px] text-ink-4">immutable log of create/update/delete/read/request activity</div>
          </CardHeader>
          <div className="px-3.5 overflow-x-auto">
            <div className="grid grid-cols-[1.2fr_1.3fr_0.8fr_1.8fr_0.9fr] gap-2.5 py-2.5 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold min-w-[900px]">
              <div>Time</div>
              <div>User</div>
              <div>Action</div>
              <div>Detail</div>
              <div>Source</div>
            </div>
            {isAuditLoading && <LoadingState />}
            {isAuditError && <ErrorState />}
            {!isAuditLoading && !isAuditError && auditLogs.map((log) => (
              <div key={log.id} className="grid grid-cols-[1.2fr_1.3fr_0.8fr_1.8fr_0.9fr] gap-2.5 py-2.5 border-b border-border-faint items-center text-[13px] min-w-[900px]">
                <div className="font-mono text-[12px] text-ink-3">{new Date(log.created_at).toLocaleString()}</div>
                <div className="text-ink-3 truncate">{log.actor_email ?? "system"}</div>
                <div><Pill tone={ACTION_TONE[log.action]}>{log.action}</Pill></div>
                <div className="text-ink-2 truncate">{auditDetail(log)}</div>
                <div className="font-mono text-[12px] text-ink-4">{log.ip_address ?? "—"}</div>
              </div>
            ))}
            {!isAuditLoading && !isAuditError && auditLogs.length === 0 && (
              <EmptyState message="No audit events recorded yet." />
            )}
          </div>
        </Card>
      )}

      {/* Integration Health */}
      {activeTab === "integrations" && (
        <div className="flex flex-col gap-3.5">
          {isHealthLoading && <LoadingState />}
          {isHealthError && <ErrorState />}
          {!isHealthLoading && !isHealthError && healthData && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card padded>
                  <div className="text-[11.5px] text-ink-4 font-semibold mb-1.5">HIS connector</div>
                  <Pill tone={connectorTone}>{connectorLabel}</Pill>
                  <div className="text-[11px] text-ink-5 font-mono mt-2">connector: {healthData.his_connector}</div>
                </Card>
                <StatTile
                  label="HIS visits synced"
                  value={healthData.his_visits.count}
                  sub={`latest: ${formatSyncedAt(healthData.his_visits.latest_synced_at)}`}
                />
                <StatTile
                  label="HIS billing synced"
                  value={healthData.his_billing.count}
                  sub={`latest: ${formatSyncedAt(healthData.his_billing.latest_synced_at)}`}
                />
              </div>

              <Card>
                <CardHeader>
                  <div className="text-[13px] font-semibold">Scheduled sync jobs</div>
                  <div className="text-[12px] text-ink-4">Celery beat tasks driving background sync & escalation</div>
                </CardHeader>
                <div className="px-3.5 overflow-x-auto">
                  <div className="grid grid-cols-[1fr_1.5fr_1.3fr_0.7fr_0.6fr] gap-2.5 py-2.5 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold min-w-[820px]">
                    <div>Task</div>
                    <div>Path</div>
                    <div>Last run</div>
                    <div>Enabled</div>
                    <div>Runs</div>
                  </div>
                  {healthData.celery_tasks.map((task) => (
                    <div key={task.task} className="grid grid-cols-[1fr_1.5fr_1.3fr_0.7fr_0.6fr] gap-2.5 py-2.5 border-b border-border-faint items-center text-[13px] min-w-[820px]">
                      <div className="font-semibold truncate">{task.name}</div>
                      <div className="text-ink-4 text-[11.5px] font-mono truncate">{task.task}</div>
                      <div className="font-mono text-[12px] text-ink-3">{formatRunAt(task.last_run_at)}</div>
                      <div>
                        {task.enabled === null ? (
                          <NeutralTag>Unknown</NeutralTag>
                        ) : task.enabled ? (
                          <Pill tone="ok">Enabled</Pill>
                        ) : (
                          <Pill tone="bad">Disabled</Pill>
                        )}
                      </div>
                      <div className="text-ink-3">{task.total_run_count}</div>
                    </div>
                  ))}
                  {healthData.celery_tasks.length === 0 && (
                    <EmptyState message="No scheduled sync jobs reported." />
                  )}
                </div>
              </Card>

              <Card padded>
                <Eyebrow>Data & compliance</Eyebrow>
                <div className="grid grid-cols-2 gap-3 text-[13px] mb-3">
                  <div className="flex justify-between">
                    <span className="text-ink-3">Data retention</span>
                    <span className="font-semibold">{healthData.data_retention_days} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-3">Hosting</span>
                    <span className="font-semibold">{healthData.is_on_premise ? "On-premise" : "Cloud-hosted"}</span>
                  </div>
                </div>
                <div className="text-[12px] text-ink-4 leading-relaxed flex flex-col gap-1 pt-3 border-t border-border-soft">
                  <div>Data at rest is encrypted with AES-256; all traffic between services uses TLS 1.3.</div>
                  <div>Automated backups run hourly with point-in-time recovery.</div>
                  <div>Access to patient data is scoped by role and recorded in the audit trail above.</div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
