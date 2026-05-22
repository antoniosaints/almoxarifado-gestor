import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchSelectOption = {
  label: string;
  searchText?: string;
  value: string;
};

type SearchSelectProps = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  emptyMessage?: string;
  id?: string;
  onValueChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  value: string;
};

type PanelPosition = {
  maxHeight: number;
  side: "bottom" | "top";
};

const panelGap = 8;
const panelFloorHeight = 112;
const panelPreferredHeight = 336;
const panelMinimumHeight = 176;
const viewportPadding = 16;

function clipsFloatingContent(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return /(auto|clip|hidden|scroll)/.test(`${style.overflow} ${style.overflowY}`);
}

function getVerticalBoundary(trigger: HTMLButtonElement) {
  let ancestor = trigger.parentElement;

  while (ancestor) {
    if (clipsFloatingContent(ancestor)) {
      const rect = ancestor.getBoundingClientRect();

      return {
        bottom: Math.min(window.innerHeight - viewportPadding, rect.bottom - viewportPadding),
        top: Math.max(viewportPadding, rect.top + viewportPadding),
      };
    }

    ancestor = ancestor.parentElement;
  }

  return {
    bottom: window.innerHeight - viewportPadding,
    top: viewportPadding,
  };
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function SearchSelect({
  ariaLabel,
  className,
  disabled,
  emptyMessage = "Nenhuma opcao encontrada.",
  id,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder = "Buscar...",
  value,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({
    maxHeight: panelPreferredHeight,
    side: "bottom",
  });
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      normalizeSearch(`${option.label} ${option.searchText ?? ""}`).includes(
        normalizedQuery,
      ),
    );
  }, [options, query]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePanelPosition() {
      const trigger = triggerRef.current;

      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const boundary = getVerticalBoundary(trigger);
      const spaceBelow = boundary.bottom - rect.bottom;
      const spaceAbove = rect.top - boundary.top;
      const side =
        spaceBelow < panelMinimumHeight && spaceAbove > spaceBelow ? "top" : "bottom";
      const availableSpace = side === "top" ? spaceAbove : spaceBelow;

      setPanelPosition({
        maxHeight: Math.max(
          panelFloorHeight,
          Math.min(panelPreferredHeight, availableSpace - panelGap),
        ),
        side,
      });
    }

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  function selectValue(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <Button
        aria-expanded={open}
        aria-label={ariaLabel}
        className="h-10 w-full justify-between overflow-hidden px-3 font-normal"
        disabled={disabled}
        id={id}
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        type="button"
        variant="outline"
        ref={triggerRef}
      >
        <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>

      {open ? (
        <div
          className={cn(
            "absolute z-[60] flex w-full min-w-60 flex-col overflow-hidden rounded-md border bg-card p-2 text-foreground shadow-xl",
            panelPosition.side === "top"
              ? "bottom-[calc(100%+0.5rem)]"
              : "top-[calc(100%+0.5rem)]",
          )}
          data-side={panelPosition.side}
          data-testid="search-select-panel"
          style={{ maxHeight: panelPosition.maxHeight }}
        >
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              value={query}
            />
          </div>
          <div
            className="min-h-0 space-y-1 overflow-y-auto"
            style={{ maxHeight: Math.max(72, panelPosition.maxHeight - 64) }}
          >
            {filteredOptions.map((option) => (
              <button
                className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                key={`${option.value}-${option.label}`}
                onClick={() => selectValue(option.value)}
                type="button"
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {option.value === value ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            ))}
            {!filteredOptions.length ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">{emptyMessage}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
