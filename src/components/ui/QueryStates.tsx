import { useTranslation } from "react-i18next"

export function LoadingState() {
  const { t } = useTranslation()
  return <div className="text-[13px] text-ink-4 p-4">{t("common.loading")}</div>
}

export function ErrorState({ message }: { message?: string }) {
  const { t } = useTranslation()
  return <div className="text-[13px] text-danger-text p-4">{message ?? t("common.error")}</div>
}

export function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation()
  return <div className="text-[13px] text-ink-4 p-4">{message ?? t("common.empty")}</div>
}
