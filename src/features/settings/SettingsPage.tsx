import { Card, Eyebrow } from "../../components/ui/Card"
import { AvatarSquare } from "../../components/ui/Avatar"
import { useAuthStore } from "../../store/auth"

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-border-faint text-[13px]">
      <span className="text-ink-4">{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  )
}

export function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email
  const hospitalLocation = [user.hospital_city, user.hospital_state].filter(Boolean).join(", ")
  const joined = user.date_joined ? new Date(user.date_joined).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : "—"

  return (
    <div className="flex flex-col gap-3.5 max-w-[900px]">
      <div className="grid grid-cols-2 gap-3.5 items-start">
        <Card padded>
          <Eyebrow>Account</Eyebrow>
          <div className="flex items-center gap-3 mb-3.5">
            <AvatarSquare name={fullName} size={44} />
            <div className="min-w-0">
              <div className="text-[14px] font-semibold truncate">{fullName}</div>
              <div className="text-[12px] text-ink-4 truncate">{user.role_name ?? "—"}</div>
            </div>
          </div>
          <Field label="Email" value={user.email} />
          <Field label="Phone" value={user.phone ?? "—"} />
          <Field label="Preferred language" value={user.preferred_language === "mr" ? "मराठी" : user.preferred_language === "hi" ? "हिन्दी" : "English"} />
          <Field label="Member since" value={joined} />
        </Card>

        <Card padded>
          <Eyebrow>Hospital</Eyebrow>
          <div className="flex items-center gap-3 mb-3.5">
            <AvatarSquare name={user.hospital_name ?? "Hospital"} size={44} />
            <div className="min-w-0">
              <div className="text-[14px] font-semibold truncate">{user.hospital_name ?? "—"}</div>
              <div className="text-[12px] text-ink-4 truncate">{hospitalLocation || "—"}</div>
            </div>
          </div>
          <Field label="Address" value={user.hospital_address ?? "—"} />
          {user.available_hospitals && user.available_hospitals.length > 1 && (
            <Field label="Branches" value={String(user.available_hospitals.length)} />
          )}
        </Card>
      </div>

      {user.hospital_enabled_modules && user.hospital_enabled_modules.length > 0 && (
        <Card padded>
          <Eyebrow>Enabled modules</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {user.hospital_enabled_modules.map((m) => (
              <span key={m} className="text-[11.5px] font-semibold px-2 py-1 rounded-tag bg-chip-bg text-chip-text capitalize">
                {m}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
