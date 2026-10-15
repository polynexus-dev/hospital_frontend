import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useRecordViewer } from "../../store/recordViewer"
import { RecordDrawer } from "./RecordDrawer"

/** The drawer behind viewRecord(); mounted once in the Shell. */
export function GlobalRecordDrawer() {
  const { record, options, close } = useRecordViewer()
  const { pathname } = useLocation()

  // leaving the screen closes it
  useEffect(() => {
    close()
  }, [pathname, close])

  if (!record) return null
  const { title, subtitle, fetchUrl, ...detailOptions } = options
  return <RecordDrawer record={record} fetchUrl={fetchUrl} title={title} subtitle={subtitle} options={detailOptions} onClose={close} />
}
