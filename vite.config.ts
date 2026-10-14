import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "YoRHa · 2B Companion",
        short_name: "2B",
        description: "Votre compagnon 2B en 2,5D, avec chat et mémoire.",
        theme_color: "#e8edf2",
        background_color: "#e8edf2",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,png,svg,glb,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [
          /^\/signin-with-chatgpt/,
          /^\/signout-with-chatgpt/,
          /^\/callback/,
          /^\/api\//,
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes("/three/") || id.includes("/@react-three/")
            ? "three"
            : undefined,
      },
    },
  },
});
