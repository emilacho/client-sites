/**
 * R103 · tracker stage mapping unit tests.
 *
 * Verifies the 8-status enum collapses correctly to the 4 visual stages
 * the customer sees, plus the cancelled side-channel.
 */
import { describe, it, expect } from "vitest"
import {
  TRACKER_STAGES,
  stageForStatus,
  stageIndexForStatus,
} from "../lib/tracker/stages"

describe("tracker stages canon · R103", () => {
  it("exposes 4 ordered stages with the canonical Emilio microcopy", () => {
    expect(TRACKER_STAGES).toHaveLength(4)
    expect(TRACKER_STAGES.map((s) => s.key)).toEqual([
      "received",
      "preparing",
      "en_route",
      "delivered",
    ])
    expect(TRACKER_STAGES.map((s) => s.index)).toEqual([1, 2, 3, 4])
    // Microcopy reviewed 2026-05-23 by Emilio
    expect(TRACKER_STAGES[0].microcopy).toBe("Cocina ya tiene tu pedido")
    expect(TRACKER_STAGES[1].microcopy).toBe(
      "El cocinero está preparando tu pedido",
    )
  })

  it("maps lifecycle statuses to the right visual stage", () => {
    expect(stageForStatus("PENDING")).toBe("received")
    expect(stageForStatus("ACCEPTED")).toBe("received")
    expect(stageForStatus("PREPARING")).toBe("preparing")
    expect(stageForStatus("READY")).toBe("preparing")
    expect(stageForStatus("RIDER_PICKED_UP")).toBe("en_route")
    expect(stageForStatus("IN_TRANSIT")).toBe("en_route")
    expect(stageForStatus("DELIVERED")).toBe("delivered")
    expect(stageForStatus("CANCELLED")).toBe("cancelled")
  })

  it("returns null status as received (defensive · pre-insert state)", () => {
    expect(stageForStatus(null)).toBe("received")
    expect(stageForStatus(undefined)).toBe("received")
  })

  it("returns numeric stage index 1-4 · 0 for cancelled", () => {
    expect(stageIndexForStatus("PENDING")).toBe(1)
    expect(stageIndexForStatus("PREPARING")).toBe(2)
    expect(stageIndexForStatus("IN_TRANSIT")).toBe(3)
    expect(stageIndexForStatus("DELIVERED")).toBe(4)
    expect(stageIndexForStatus("CANCELLED")).toBe(0)
  })
})
