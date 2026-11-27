import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@uxie/shared/components/theme/theme-provider";
import { Toaster } from "@uxie/shared/components/ui/sonner";
import App from "./App";
import { ViewZoom } from "./view-zoom";
import { WindowBackgroundSync } from "./window-background-sync";
import "./globals.css";

// No StrictMode: react-pdf-highlighter renders imperatively (createRoot per
// page) and its class components don't tolerate the dev double-mount.
createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <WindowBackgroundSync />
    <ViewZoom />
    <App />
    <Toaster />
  </ThemeProvider>,
);
