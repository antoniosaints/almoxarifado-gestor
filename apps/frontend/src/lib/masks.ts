export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function allDigitsEqual(digits: string) {
  return digits.split("").every((digit) => digit === digits[0]);
}

export function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(
      /^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/,
      "$1.$2.$3/$4-$5",
    );
}

export function formatCpfCnpj(value: string) {
  return onlyDigits(value).length > 11 ? formatCnpj(value) : formatCpf(value);
}

export function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/^(\(\d{2}\) )(\d{4})(\d)/, "$1$2-$3");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/^(\(\d{2}\) )(\d{5})(\d)/, "$1$2-$3");
}

function verifierDigit(digits: string, weights: number[]) {
  const sum = weights.reduce(
    (total, weight, index) => total + Number(digits[index] ?? 0) * weight,
    0,
  );
  const rest = sum % 11;

  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(value: string) {
  const digits = onlyDigits(value);

  if (digits.length !== 11 || allDigitsEqual(digits)) {
    return false;
  }

  const firstDigit = verifierDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = verifierDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);

  return digits.endsWith(`${firstDigit}${secondDigit}`);
}

export function isValidCnpj(value: string) {
  const digits = onlyDigits(value);

  if (digits.length !== 14 || allDigitsEqual(digits)) {
    return false;
  }

  const firstDigit = verifierDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = verifierDigit(
    digits,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return digits.endsWith(`${firstDigit}${secondDigit}`);
}

export function isValidCpfCnpj(value: string) {
  const digits = onlyDigits(value);

  return digits.length <= 11 ? isValidCpf(value) : isValidCnpj(value);
}

export function isValidPhone(value: string) {
  const digits = onlyDigits(value);

  return (
    (digits.length === 10 || digits.length === 11) &&
    /^[1-9]\d/.test(digits) &&
    !allDigitsEqual(digits)
  );
}
