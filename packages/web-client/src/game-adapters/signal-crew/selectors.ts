export function inferSignalCrewScreen(joined: boolean): "lobby" | "gameplay" {
  return joined ? "gameplay" : "lobby";
}
