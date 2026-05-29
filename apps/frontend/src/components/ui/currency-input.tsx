import {
  forwardRef,
  useEffect,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CurrencyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "inputMode" | "onChange" | "type" | "value"
> & {
  onValueChange?: (value: string) => void;
  value?: number | string | null;
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatCents(digits: string) {
  const amount = Number(digits || "0") / 100;

  return amount.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function valueToDisplay(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const amount = Number(String(value).replace(",", "."));

  if (!Number.isFinite(amount)) {
    return "";
  }

  return amount.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function digitsToDecimal(digits: string) {
  return (Number(digits || "0") / 100).toFixed(2);
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, disabled, onValueChange, value, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(() => valueToDisplay(value));

    useEffect(() => {
      setDisplayValue(valueToDisplay(value));
    }, [value]);

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
      const digits = digitsOnly(event.currentTarget.value);
      const formatted = formatCents(digits);

      setDisplayValue(formatted);
      event.currentTarget.value = formatted;
      onValueChange?.(digitsToDecimal(digits));
    }

    return (
      <div
        className={cn(
          "flex h-10 w-full overflow-hidden rounded-md border bg-card shadow-sm focus-within:ring-2 focus-within:ring-ring",
          disabled ? "opacity-60" : "",
          className,
        )}
      >
        <span className="flex select-none items-center border-r bg-muted px-3 text-sm font-medium text-muted-foreground">
          R$
        </span>
        <Input
          className="h-full rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          disabled={disabled}
          inputMode="decimal"
          onChange={handleChange}
          ref={ref}
          type="text"
          value={displayValue}
          {...props}
        />
      </div>
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";
