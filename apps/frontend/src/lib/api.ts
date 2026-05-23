import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredSession } from "./session";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3333";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getStoredSession();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(payload?.message ?? "Nao foi possivel concluir a operacao.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiFile(path: string, init?: RequestInit): Promise<Blob> {
  const session = getStoredSession();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(payload?.message ?? "Nao foi possivel baixar o arquivo.");
  }

  return response.blob();
}

export function useApiResource<T>(path: string, initialValue: T) {
  const [data, setData] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    if (mounted.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const nextData = await api<T>(path);

      if (mounted.current) {
        setData(nextData);
      }
    } catch (caughtError) {
      if (mounted.current) {
        setError(
          caughtError instanceof Error ? caughtError.message : "Falha ao carregar dados.",
        );
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [path]);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    data,
    error,
    loading,
    reload,
    setData,
  };
}
