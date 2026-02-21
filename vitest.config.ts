import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@board-game-sim/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      "@board-game-sim/shared/": fileURLToPath(new URL("./packages/shared/src/", import.meta.url)),
      "@board-game-sim/engine": fileURLToPath(new URL("./packages/engine/src/index.ts", import.meta.url)),
      "@board-game-sim/engine/": fileURLToPath(new URL("./packages/engine/src/", import.meta.url)),
      "@board-game-sim/server": fileURLToPath(new URL("./packages/server/src/index.ts", import.meta.url)),
      "@board-game-sim/server/": fileURLToPath(new URL("./packages/server/src/", import.meta.url)),
      "@board-game-sim/battleship": fileURLToPath(new URL("./packages/games/battleship/src/index.ts", import.meta.url)),
      "@board-game-sim/battleship/": fileURLToPath(new URL("./packages/games/battleship/src/", import.meta.url)),
      "@board-game-sim/labyrinth": fileURLToPath(new URL("./packages/games/labyrinth/src/index.ts", import.meta.url)),
      "@board-game-sim/labyrinth/": fileURLToPath(new URL("./packages/games/labyrinth/src/", import.meta.url))
    }
  },
  test: {
    include: ["tests/**/*.test.ts"]
  }
});
