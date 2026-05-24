import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { RouteLoadingProvider } from "./lib/route-loading";
import { SessionProvider } from "./lib/session";
import { SystemSettingsProvider } from "./lib/system-settings";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RouteLoadingProvider>
        <SystemSettingsProvider>
          <SessionProvider>
            <App />
          </SessionProvider>
        </SystemSettingsProvider>
      </RouteLoadingProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
