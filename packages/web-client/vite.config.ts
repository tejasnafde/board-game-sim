import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL("./app", import.meta.url)),
  publicDir: fileURLToPath(new URL("./app/public", import.meta.url)),
  plugins: [react()],
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
