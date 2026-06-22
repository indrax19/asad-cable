import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Vercel deployment: disable Cloudflare Workers plugin and build as a static SPA.
// This app is Firebase client-only — no server functions run at runtime.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/",
      },
    },
    pages: [{ path: "/" }],
  },
});
