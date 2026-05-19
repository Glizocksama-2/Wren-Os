import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ProtectedNorthwatch from "./auth/ProtectedNorthwatch";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProtectedNorthwatch />
  </StrictMode>
);
