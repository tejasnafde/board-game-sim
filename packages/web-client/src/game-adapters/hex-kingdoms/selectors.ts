export function inferHexKingdomsScreen(joined: boolean): "lobby" | "gameplay" {
  return joined ? "gameplay" : "lobby";
}
