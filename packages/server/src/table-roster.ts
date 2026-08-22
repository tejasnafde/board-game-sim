import type { TablePlan, TableSummary } from "@board-game-sim/shared";

type TableEntry = {
  humanSeatIds: string[];
  botSeatIds: string[];
  claims: Map<string, string>;
  names: Map<string, string>;
};

type TablePlanInput = {
  tablePlan?: TablePlan;
  seatCount?: number;
  bots?: number;
};

export function normalizeTablePlan(input: TablePlanInput, minSeats: number, maxSeats: number): TablePlan {
  if (input.tablePlan) return input.tablePlan;
  const totalSeats = Math.min(maxSeats, Math.max(minSeats, input.seatCount ?? minSeats));
  const botSeats = Math.min(Math.max(0, input.bots ?? 0), totalSeats - 1);
  return { humanSeats: totalSeats - botSeats, botSeats };
}

export class TableRoster {
  private readonly entries = new Map<string, TableEntry>();

  has(sessionId: string): boolean {
    return this.entries.has(sessionId);
  }

  create(sessionId: string, seatIds: string[], plan: TablePlan): void {
    const totalSeats = plan.humanSeats + plan.botSeats;
    if (
      !Number.isInteger(plan.humanSeats)
      || !Number.isInteger(plan.botSeats)
      || plan.humanSeats < 1
      || plan.botSeats < 0
      || totalSeats < 2
      || totalSeats > 4
      || seatIds.length !== totalSeats
    ) {
      throw new Error("invalid_table_plan");
    }
    const humanSeatIds = seatIds.slice(0, plan.humanSeats);
    const botSeatIds = seatIds.slice(plan.humanSeats, plan.humanSeats + plan.botSeats);
    const names = new Map<string, string>();
    botSeatIds.forEach((seatId, index) => {
      names.set(seatId, botSeatIds.length === 1 ? "Computer" : `Computer ${index + 1}`);
    });
    this.entries.set(sessionId, { humanSeatIds, botSeatIds, claims: new Map(), names });
  }

  claimHuman(sessionId: string, playerName: string): string | null {
    const entry = this.entry(sessionId);
    const existing = entry.claims.get(playerName);
    if (existing) return existing;
    const claimedSeats = new Set(entry.claims.values());
    const seatId = entry.humanSeatIds.find((candidate) => !claimedSeats.has(candidate));
    if (!seatId) return null;
    entry.claims.set(playerName, seatId);
    entry.names.set(seatId, playerName);
    return seatId;
  }

  summary(sessionId: string): TableSummary {
    const entry = this.entry(sessionId);
    const claimedHumanSeats = entry.claims.size;
    return {
      humanSeats: entry.humanSeatIds.length,
      botSeats: entry.botSeatIds.length,
      claimedHumanSeats,
      ready: claimedHumanSeats === entry.humanSeatIds.length
    };
  }

  botSeats(sessionId: string): string[] {
    return [...this.entry(sessionId).botSeatIds];
  }

  seatNames(sessionId: string): Record<string, string> {
    return Object.fromEntries(this.entry(sessionId).names);
  }

  private entry(sessionId: string): TableEntry {
    const entry = this.entries.get(sessionId);
    if (!entry) throw new Error("table_roster_missing");
    return entry;
  }
}
