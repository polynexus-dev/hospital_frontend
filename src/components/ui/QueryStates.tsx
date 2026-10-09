import { useTranslation } from "react-i18next"

export function LoadingState() {
  const { t } = useTranslation()
  return <div className="text-[13px] text-ink-4 p-4">{t("common.loading")}</div>
}

export function ErrorState({ title, message }: { title?: string; message?: string }) {
  const { t } = useTranslation()
  return (
    <div className="text-[13px] text-danger-text p-4">
      {title && <div className="font-semibold mb-0.5">{title}</div>}
      <div>{message ?? t("common.error")}</div>
    </div>
  )
}

export function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation()
  return <div className="text-[13px] text-ink-4 p-4">{message ?? t("common.empty")}</div>
}
