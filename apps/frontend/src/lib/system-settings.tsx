import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { SystemSettings } from "./types";

const themeKey = "almoxarifado-theme";

export const defaultSystemSettings: SystemSettings = {
  id: "system",
  loginBackgroundUrl: null,
  loginImageUrl: null,
  loginSubtitle: "Entre com seu usuario para acompanhar o estoque municipal.",
  loginTitle: "Almoxarifado Municipal",
  logoUrl: null,
  primaryColor: "#0f766e",
  reportFooterText: "Documento gerado pelo sistema de almoxarifado municipal.",
  reportLogoUrl: null,
  reportPrimaryColor: "#0f766e",
  reportTitle: "GEMA - Gestao Municipal de Almoxarifado",
  systemName: "Prefeitura",
};

type ThemeMode = "dark" | "light";

type SystemSettingsContextValue = {
  darkMode: boolean;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  saveSettings: (settings: SystemSettings) => Promise<SystemSettings>;
  setDarkMode: (enabled: boolean) => void;
  settings: SystemSettings;
};

const fallbackContext: SystemSettingsContextValue = {
  darkMode: false,
  error: null,
  loading: false,
  reload: () => Promise.resolve(),
  saveSettings: async (settings) => settings,
  setDarkMode: () => undefined,
  settings: defaultSystemSettings,
};

const SystemSettingsContext =
  createContext<SystemSettingsContextValue>(fallbackContext);

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.localStorage.getItem(themeKey) === "dark" ? "dark" : "light";
}

function normalizeHex(hex: string) {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : defaultSystemSettings.primaryColor;
}

function hexToHsl(hex: string) {
  const normalized = normalizeHex(hex).slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;

  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));

    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
  }

  return `${Math.round(hue * 60 + (hue < 0 ? 360 : 0))} ${Math.round(
    saturation * 100,
  )}% ${Math.round(lightness * 100)}%`;
}

function foregroundFor(hex: string) {
  const normalized = normalizeHex(hex).slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.62 ? "222 47% 11%" : "0 0% 100%";
}

function applyBranding(settings: SystemSettings, darkMode: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const primaryColor = normalizeHex(settings.primaryColor);

  root.classList.toggle("dark", darkMode);
  root.style.setProperty("--primary", hexToHsl(primaryColor));
  root.style.setProperty("--ring", hexToHsl(primaryColor));
  root.style.setProperty("--primary-foreground", foregroundFor(primaryColor));
}

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(defaultSystemSettings);
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setSettings(await api<SystemSettings>("/settings/public"));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao carregar configuracoes.",
      );
      setSettings(defaultSystemSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    applyBranding(settings, theme === "dark");
  }, [settings, theme]);

  const value = useMemo<SystemSettingsContextValue>(
    () => ({
      darkMode: theme === "dark",
      error,
      loading,
      reload,
      async saveSettings(nextSettings) {
        const savedSettings = await api<SystemSettings>("/settings", {
          body: JSON.stringify(nextSettings),
          method: "PUT",
        });

        setSettings(savedSettings);
        return savedSettings;
      },
      setDarkMode(enabled) {
        const nextTheme = enabled ? "dark" : "light";

        window.localStorage.setItem(themeKey, nextTheme);
        setTheme(nextTheme);
      },
      settings,
    }),
    [error, loading, reload, settings, theme],
  );

  return (
    <SystemSettingsContext.Provider value={value}>
      {children}
    </SystemSettingsContext.Provider>
  );
}

export function useSystemSettings() {
  return useContext(SystemSettingsContext);
}
