
import { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./app/App";
import "./styles/index.css";

const Analytics = lazy(() =>
  import("@vercel/analytics/react").then((module) => ({ default: module.Analytics })),
);
const SpeedInsights = lazy(() =>
  import("@vercel/speed-insights/react").then((module) => ({ default: module.SpeedInsights })),
);

async function unregisterServiceWorkers() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

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
  } catch {
    toast.error("Unable to clear old offline cache automatically.");
  }
}

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void unregisterServiceWorkers();
  });
}

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    {import.meta.env.PROD ? (
      <Suspense fallback={null}>
        <Analytics />
        <SpeedInsights />
      </Suspense>
    ) : null}
  </>
);
