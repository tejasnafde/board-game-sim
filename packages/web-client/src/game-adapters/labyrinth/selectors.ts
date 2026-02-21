export function inferLabyrinthScreen(joined: boolean): "lobby" | "gameplay" {
  return joined ? "gameplay" : "lobby";
}
