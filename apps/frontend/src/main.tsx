import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { SessionProvider } from "./lib/session";
import { SystemSettingsProvider } from "./lib/system-settings";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SystemSettingsProvider>
        <SessionProvider>
          <App />
        </SessionProvider>
      </SystemSettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
