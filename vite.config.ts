import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Vercel deployment: disable Cloudflare Workers plugin and build as a static SPA.
export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
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
