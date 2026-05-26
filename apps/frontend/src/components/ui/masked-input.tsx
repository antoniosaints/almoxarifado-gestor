import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import {
  formatCnpj,
  formatCpf,
  formatCpfCnpj,
  formatPhone,
  isValidCnpj,
  isValidCpf,
  isValidCpfCnpj,
  isValidPhone,
  onlyDigits,
} from "@/lib/masks";

type Mask = "cnpj" | "cpf" | "cpfCnpj" | "phone";

type MaskedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "inputMode"> & {
  mask: Mask;
  validate?: boolean;
};

const maskConfig: Record<
  Mask,
  {
    format: (value: string) => string;
    maxLength: number;
    message: string;
    pattern: string;
    placeholder: string;
    valid: (value: string) => boolean;
  }
> = {
  cnpj: {
    format: formatCnpj,
    maxLength: 18,
    message: "Informe um CNPJ válido.",
    pattern: "\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2}",
    placeholder: "00.000.000/0000-00",
    valid: isValidCnpj,
  },
  cpf: {
    format: formatCpf,
    maxLength: 14,
    message: "Informe um CPF válido.",
    pattern: "\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}",
    placeholder: "000.000.000-00",
    valid: isValidCpf,
  },
  cpfCnpj: {
    format: formatCpfCnpj,
    maxLength: 18,
    message: "Informe um CPF ou CNPJ válido.",
    pattern:
      "(\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}|\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2})",
    placeholder: "CPF ou CNPJ",
    valid: isValidCpfCnpj,
  },
  phone: {
    format: formatPhone,
    maxLength: 15,
    message: "Informe um telefone válido com DDD.",
    pattern: "\\(\\d{2}\\) \\d{4,5}-\\d{4}",
    placeholder: "(00) 00000-0000",
    valid: isValidPhone,
  },
};

function validateField(input: HTMLInputElement, mask: Mask, shouldValidate: boolean) {
  if (!shouldValidate || !input.value) {
    input.setCustomValidity("");
    return;
  }

  input.setCustomValidity(maskConfig[mask].valid(input.value) ? "" : maskConfig[mask].message);
}

export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  (
    {
      mask,
      maxLength,
      onBlur,
      onChange,
      onInvalid,
      pattern,
      placeholder,
      validate = true,
      ...props
    },
    ref,
  ) => {
    const config = maskConfig[mask];

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
      event.currentTarget.value = config.format(event.currentTarget.value);
      validateField(event.currentTarget, mask, validate);
      onChange?.(event);
    }

    return (
      <Input
        inputMode="numeric"
        maxLength={maxLength ?? config.maxLength}
        onBlur={(event) => {
          validateField(event.currentTarget, mask, validate);
          onBlur?.(event);
        }}
        onChange={handleChange}
        onInvalid={(event) => {
          validateField(event.currentTarget, mask, validate);
          onInvalid?.(event);
        }}
        pattern={validate ? (pattern ?? config.pattern) : pattern}
        placeholder={placeholder ?? config.placeholder}
        ref={ref}
        title={validate ? config.message : props.title}
        {...props}
      />
    );
  },
);

MaskedInput.displayName = "MaskedInput";

export function maskedValue(mask: Mask, value: string) {
  return maskConfig[mask].format(value);
}

export { onlyDigits };
