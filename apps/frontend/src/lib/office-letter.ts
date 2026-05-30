type WindowOpener = (
  url?: string | URL,
  target?: string,
  features?: string,
) => Window | null;

export function officeLetterPrintPath(requestId: string) {
  return `/requests/${encodeURIComponent(requestId)}/office-letter/print`;
}

export function officeLetterFileSuffix(
  numberFormatted: string | null | undefined,
  requestId: string,
) {
  return (
    numberFormatted?.replace(/[^\d]+/g, "-").replace(/^-|-$/g, "") ||
    requestId
  );
}

export function openOfficeLetterPrintWindow(
  requestId: string,
  opener: WindowOpener = window.open.bind(window),
) {
  const opened = opener(
    officeLetterPrintPath(requestId),
    "_blank",
    "noopener,noreferrer",
  );

  return Boolean(opened);
}
