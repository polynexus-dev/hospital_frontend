import { describe, expect, it } from "vitest"
import { lineTotals } from "./ui"

describe("lineTotals", () => {
  it("adds taxable value and GST per line after discount", () => {
    const l = (quantity: string, rate: string, discount: string, gst_rate: string) => ({ tariff: null, description: "x", hsn_sac: "", quantity, rate, discount, gst_rate })
    expect(lineTotals([l("50", "1200", "", "0"), l("2", "5000", "", "18")])).toEqual({ taxable: 70000, tax: 1800, total: 71800 })
    expect(lineTotals([l("1", "100", "150", "18")])).toEqual({ taxable: 0, tax: 0, total: 0 })
  })
})
