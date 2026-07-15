import { createRoot } from "react-dom/client";
import { Toaster } from "@uxie/shared/components/ui/sonner";
import App from "./App";
import "./globals.css";

// No StrictMode: react-pdf-highlighter renders imperatively (createRoot per
// page) and its class components don't tolerate the dev double-mount.
createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster />
  </>,
);
