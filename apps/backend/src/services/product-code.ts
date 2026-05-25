export function nextProductCode(lastCode?: string | null) {
  const nextNumber = Number(lastCode ?? "0") + 1;

  if (nextNumber > 9_999_999) {
    throw new Error("Limite de códigos de produto atingido.");
  }

  return String(nextNumber).padStart(7, "0");
}
