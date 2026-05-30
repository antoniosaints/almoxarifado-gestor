import { cn } from "@/lib/utils";

const officeDocumentAttribute = 'data-office-letter-document="true"';

function hasOfficeDocumentRoot(html: string) {
  return /\sdata-office-letter-document(?:\s*=\s*(?:"true"|'true'|true))?/i.test(
    html,
  );
}

function printableOfficeHtml(html: string) {
  if (hasOfficeDocumentRoot(html)) {
    return html;
  }

  return `<article ${officeDocumentAttribute}>${html}</article>`;
}

export function OfficeLetterDocument({
  className,
  html,
}: {
  className?: string;
  html: string;
}) {
  return (
    <div className={cn("office-letter-a4", className)}>
      <div
        dangerouslySetInnerHTML={{ __html: printableOfficeHtml(html) }}
        className="office-letter-a4__canvas"
      />
    </div>
  );
}
