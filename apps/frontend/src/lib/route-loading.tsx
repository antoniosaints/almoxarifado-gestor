import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type RouteLoadingContextValue = {
  active: boolean;
  pendingCount: number;
  startLoading: () => () => void;
};

const fallbackContext: RouteLoadingContextValue = {
  active: false,
  pendingCount: 0,
  startLoading: () => () => undefined,
};

const RouteLoadingContext =
  createContext<RouteLoadingContextValue>(fallbackContext);

export function RouteLoadingProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);

  const startLoading = useCallback(() => {
    let finished = false;

    setPendingCount((current) => current + 1);

    return () => {
      if (finished) {
        return;
      }

      finished = true;
      setPendingCount((current) => Math.max(0, current - 1));
    };
  }, []);

  const value = useMemo<RouteLoadingContextValue>(
    () => ({
      active: pendingCount > 0,
      pendingCount,
      startLoading,
    }),
    [pendingCount, startLoading],
  );

  return (
    <RouteLoadingContext.Provider value={value}>
      {children}
    </RouteLoadingContext.Provider>
  );
}

export function useRouteLoading() {
  return useContext(RouteLoadingContext);
}
