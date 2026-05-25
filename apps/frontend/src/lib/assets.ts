const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3333";
const uploadBaseUrl = import.meta.env.VITE_UPLOAD_BASE_URL ?? apiBaseUrl;

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function resolveAssetUrl(url?: string | null) {
  const trimmed = url?.trim();

  if (!trimmed) {
    return "";
  }

  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${trimTrailingSlash(uploadBaseUrl)}${trimmed}`;
  }

  return trimmed;
}
