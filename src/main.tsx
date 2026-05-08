
import { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";
import App from "./app/App";
import "./styles/index.css";

const Analytics = lazy(() =>
  import("@vercel/analytics/react").then((module) => ({ default: module.Analytics })),
);
const SpeedInsights = lazy(() =>
  import("@vercel/speed-insights/react").then((module) => ({ default: module.SpeedInsights })),
);

function registerServiceWorker() {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast("A new version is available.", {
        description: "Update now to get the latest fixes and features.",
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
      toast.success("App is ready for offline use.");
    },
  });
}

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => registerServiceWorker());
      return;
    }
    setTimeout(() => registerServiceWorker(), 0);
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
