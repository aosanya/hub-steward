import "./design.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { closeMcp } from "./wakala/mcp";
import { I18nProvider } from "./i18n";
import { SessionProvider } from "./session";

window.addEventListener("pagehide", closeMcp);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <I18nProvider>
        <SessionProvider>
          <App />
        </SessionProvider>
      </I18nProvider>
    </HashRouter>
  </StrictMode>,
);
