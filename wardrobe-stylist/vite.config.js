import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /api calls to the local Node backend (server/index.js),
// which holds your Anthropic API key. This keeps the key off the browser.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
