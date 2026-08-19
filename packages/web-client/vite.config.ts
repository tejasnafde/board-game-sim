import { cp, mkdir } from "node:fs/promises";
import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";

function copyDiscoveryFiles(): Plugin {
  const source = fileURLToPath(new URL("./app/public", import.meta.url));
  return {
    name: "copy-discovery-files",
    apply: "build",
    async writeBundle(options) {
      const output = String(options.dir);
      await mkdir(output, { recursive: true });
      await cp(source, output, { recursive: true });
    }
  };
}

export default defineConfig({
  root: fileURLToPath(new URL("./app", import.meta.url)),
  publicDir: fileURLToPath(new URL("../games/battleship", import.meta.url)),
  plugins: [copyDiscoveryFiles()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/realtime": {
        target: "ws://127.0.0.1:8080",
        ws: true,
        rewriteWsOrigin: true
      }
    }
  }
});
