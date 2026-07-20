import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base` is "/" for local dev but "/alfred-ai-operating-system/" for the
// production build, so assets resolve correctly when the app is served from a
// GitHub Pages project subpath (https://<user>.github.io/<repo>/).
//
// The dev server proxies /api calls to the local Node backend (server/index.js),
// which holds your Anthropic API key. This keeps the key off the browser.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/alfred-ai-operating-system/" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
}));
