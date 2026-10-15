import { useQuery } from "@tanstack/react-query"
import { api } from "../../api/client"

interface StaffLink { kind: "staff" | "dependent"; employee_code: string; employee_name: string; relationship: string }

/** "Staff" / "Staff dependent" tag: this patient is billed at the staff rate. */
export function StaffRateTag({ patientId }: { patientId: number }) {
  const q = useQuery({
    queryKey: ["staff-link", patientId],
    queryFn: () => api.get<{ link: StaffLink | null }>(`/hr/dependents/staff-link/?patient=${patientId}`),
    retry: false,
  })
  const link = q.data?.link
  if (!link) return null
  const text = link.kind === "staff" ? `Staff · ${link.employee_code}` : `Staff dependent · ${link.relationship} of ${link.employee_name} (${link.employee_code})`
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-semibold bg-accent-tint text-accent-hover dark:bg-teal-900/50 dark:text-teal-200" title="Billed at the staff rate category">
      {text}
    </span>
  )
}
