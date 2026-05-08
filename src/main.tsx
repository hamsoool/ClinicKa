
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";
import App from "./app/App";
import "./styles/index.css";

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

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>
);
