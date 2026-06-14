
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";
import { pdfjs } from "react-pdf";
import App from "./app/App";
import "./styles/index.css";

// Configure the PDF.js worker locally to prevent version mismatch errors
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const PWA_MIGRATION_KEY = "clinicka-pwa-migration-v2";
const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000;

async function cleanupLegacyPwaState() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (window.localStorage.getItem(PWA_MIGRATION_KEY) === "done") return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(
        cacheKeys
          .filter((key) => key.startsWith("workbox-") || key.includes("precache") || key.includes("google-fonts"))
          .map((key) => window.caches.delete(key)),
      );
    }

    window.localStorage.setItem(PWA_MIGRATION_KEY, "done");
  } catch {
    toast.error("Unable to refresh the installed app cache automatically.");
  }
}

function registerServiceWorker() {
  let visibilityHandlerBound = false;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast("A new ClinicKa! update is available.", {
        description: "Install the latest version to refresh the app and PWA assets.",
        action: {
          label: "Update",
          onClick: () => {
            void updateSW(true);
          },
        },
        duration: 10000,
      });
    },
    onOfflineReady() {
      toast.success("ClinicKa! is ready for offline use.");
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      void registration.update();
      window.setInterval(() => {
        void registration.update();
      }, SW_UPDATE_INTERVAL_MS);

      if (!visibilityHandlerBound) {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            void registration.update();
          }
        });
        visibilityHandlerBound = true;
      }
    },
    onRegisterError(error) {
      console.error("Failed to register ClinicKa! service worker:", error);
    },
  });
}

async function bootPwa() {
  await cleanupLegacyPwaState();
  if ("serviceWorker" in navigator) {
    registerServiceWorker();
  }
}

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => {
        void bootPwa();
      });
      return;
    }

    window.setTimeout(() => {
      void bootPwa();
    }, 0);
  });
}

createRoot(document.getElementById("root")!).render(
  <App />
);
