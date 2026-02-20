import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./app", import.meta.url)),
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
