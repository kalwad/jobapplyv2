import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@japp/ui/tokens.css";
import "./shell.css";
import { DesktopShell } from "./shell.tsx";

const root = document.getElementById("root");
if (root === null)
  throw new Error("The desktop app mount point is unavailable.");
createRoot(root).render(
  <StrictMode>
    <DesktopShell />
  </StrictMode>,
);
