import type { MouseEvent, ReactNode } from "react"
import { create } from "zustand"
import type { RecordDetailsOptions } from "../components/record/RecordDetails"

// One app-wide "click a row → see the whole record" drawer
// (GlobalRecordDrawer, mounted in the Shell). List screens call viewRecord
// from a row's onClick instead of each keeping their own drawer state.

export interface RecordViewOptions extends RecordDetailsOptions {
  title?: ReactNode
  subtitle?: ReactNode
  /** API path of the full record, when list rows are trimmed */
  fetchUrl?: string
}

interface RecordViewerState {
  record: Record<string, any> | null
  options: RecordViewOptions
  open: (record: Record<string, any>, options?: RecordViewOptions) => void
  close: () => void
}

export const useRecordViewer = create<RecordViewerState>((set) => ({
  record: null,
  options: {},
  open: (record, options = {}) => set({ record, options }),
  close: () => set({ record: null, options: {} }),
}))

const INTERACTIVE = "button, a, input, select, textarea, label, [role=button], [data-no-row-click]"

/** Row click handler: opens the record unless the click was on a control inside the row. */
export function viewRecord(e: MouseEvent, record: Record<string, any>, options?: RecordViewOptions) {
  const target = e.target as HTMLElement | null
  if (target?.closest(INTERACTIVE)) return
  if (window.getSelection()?.toString()) return // selecting text, not opening
  useRecordViewer.getState().open(record, options)
}
