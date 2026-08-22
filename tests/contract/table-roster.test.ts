import { describe, expect, test } from "vitest";
import { TableRoster, normalizeTablePlan } from "@board-game-sim/server";

describe("table roster", () => {
  test("reserves human seats before bot seats", () => {
    const roster = new TableRoster();

    roster.create("mixed", ["player-1", "player-2", "player-3"], {
      humanSeats: 2,
      botSeats: 1
    });

    expect(roster.summary("mixed")).toEqual({
      humanSeats: 2,
      botSeats: 1,
      claimedHumanSeats: 0,
      ready: false
    });
    expect(roster.botSeats("mixed")).toEqual(["player-3"]);
    expect(roster.seatNames("mixed")).toEqual({ "player-3": "Computer" });
  });

  test("claims only human seats and reconnects to the same seat", () => {
    const roster = new TableRoster();
    roster.create("mixed", ["player-1", "player-2", "player-3"], {
      humanSeats: 2,
      botSeats: 1
    });

    expect(roster.claimHuman("mixed", "tejas")).toBe("player-1");
    expect(roster.summary("mixed").ready).toBe(false);
    expect(roster.claimHuman("mixed", "friend")).toBe("player-2");
    expect(roster.summary("mixed").ready).toBe(true);
    expect(roster.claimHuman("mixed", "tejas")).toBe("player-1");
    expect(roster.claimHuman("mixed", "intruder")).toBeNull();
    expect(roster.seatNames("mixed")).toEqual({
      "player-1": "tejas",
      "player-2": "friend",
      "player-3": "Computer"
    });
  });

  test.each([
    { humanSeats: 0, botSeats: 2 },
    { humanSeats: 1, botSeats: 0 },
    { humanSeats: 4, botSeats: 1 },
    { humanSeats: 2.5, botSeats: 1 }
  ])("rejects invalid table plan $humanSeats+$botSeats", (plan) => {
    const roster = new TableRoster();
    expect(() => roster.create("invalid", ["p1", "p2", "p3", "p4"], plan)).toThrow("invalid_table_plan");
  });

  test("normalizes legacy seat and bot counts into a canonical plan", () => {
    expect(normalizeTablePlan({ seatCount: 3 }, 2, 4)).toEqual({ humanSeats: 3, botSeats: 0 });
    expect(normalizeTablePlan({ seatCount: 3, bots: 2 }, 2, 4)).toEqual({ humanSeats: 1, botSeats: 2 });
    expect(normalizeTablePlan({ bots: 1 }, 2, 2)).toEqual({ humanSeats: 1, botSeats: 1 });
    expect(normalizeTablePlan({ tablePlan: { humanSeats: 2, botSeats: 1 } }, 2, 4)).toEqual({
      humanSeats: 2,
      botSeats: 1
    });
  });

  test("reports whether a session roster has been registered", () => {
    const roster = new TableRoster();
    expect(roster.has("table")).toBe(false);
    roster.create("table", ["p1", "p2"], { humanSeats: 2, botSeats: 0 });
    expect(roster.has("table")).toBe(true);
  });
});
