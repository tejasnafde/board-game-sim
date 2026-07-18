export function inferConnect4Screen(joined: boolean): "lobby" | "gameplay" {
  return joined ? "gameplay" : "lobby";
}
