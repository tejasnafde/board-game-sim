/// <reference types="vite/client" />

import { mountFromBrowser } from "../src/bootstrap";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("app_root_not_found");
}

mountFromBrowser(root, {
  VITE_WS_URL: import.meta.env.VITE_WS_URL
});
