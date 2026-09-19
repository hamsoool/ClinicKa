import path from "path";
import dotenv from "dotenv";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Load single unified deployment environment configuration
dotenv.config({ path: path.resolve(__dirname, ".env.deployment") });

// Subdirectory base path — "/" for dev/root, "/clinicka/" for school deployment
const basePath = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      injectRegister: false,
      registerType: "autoUpdate",
      includeAssets: ["logo.png", "clinickalogo.png", "footer.png"],
      manifest: {
        id: basePath,
        name: "ClinicKa!",
        short_name: "ClinicKa!",
        description: "ClinicKa! health records and clinic management for Gordon College",
        theme_color: "#006d3c",
        background_color: "#fffeff",
        display: "standalone",
        start_url: basePath,
        scope: basePath,
        orientation: "portrait",
        categories: ["medical", "health", "education"],
        icons: [
          {
            src: "footer.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "footer.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "footer.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Student Portal",
            short_name: "Student",
            url: "/student/dashboard",
          },
          {
            name: "Staff Portal",
            short_name: "Staff",
            url: "/staff/dashboard",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        disableDevLogs: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        globIgnores: [
          "unused/**",
          "gordon_college_academicaffairs.png",
          "previews/**",
          "assets/inline-pdf-viewer-*.js",
          "assets/inline-pdf-viewer-*.css",
          "assets/pdf.worker.min-*.mjs",
          "assets/password-strength-meter-*.js",
          "assets/AreaChart-*.js",
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${basePath}index.html`.replace(/\/\//g, '/'),
        navigateFallbackDenylist: [/\/api\//],
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/assets\/(inline-pdf-viewer|pdf\.worker\.min|password-strength-meter|AreaChart)-.*\.(js|css|mjs)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "on-demand-assets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client", "react-router", "lucide-react"],
  },
  build: {
    chunkSizeWarningLimit: 1200,
    // Industry-standard content-hashed filenames — obscures source names & enables cache-busting
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]',
      },
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/storage': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  assetsInclude: ["**/*.svg", "**/*.csv"],
});
