import type { ClientView } from "./types";

export function inferBattleshipScreen(joined: boolean, view: ClientView): "lobby" | "setup" | "gameplay" {
  if (!joined) return "lobby";
  if ((view.phase ?? "setup") === "setup") return "setup";
  return "gameplay";
}
