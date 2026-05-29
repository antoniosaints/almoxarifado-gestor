declare module "html-to-pdfmake" {
  export default function htmlToPdfmake(
    html: string,
    options?: Record<string, unknown>,
  ): unknown;
}

declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string);
    window: unknown;
  }
}

declare module "pdfmake" {
  export type PdfMakeFontDefinitions = Record<
    string,
    {
      bold?: string;
      bolditalics?: string;
      italics?: string;
      normal: string;
    }
  >;

  export type PdfMakeDocument = {
    getBuffer(): Promise<Buffer>;
  };

  export type PdfMake = {
    addFonts(fonts: PdfMakeFontDefinitions): void;
    createPdf(
      docDefinition: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): PdfMakeDocument;
    setLocalAccessPolicy(callback?: (filePath: string) => boolean): void;
    setUrlAccessPolicy(callback?: (url: string) => boolean): void;
  };

  const pdfMake: PdfMake;
  export default pdfMake;
}

declare module "pdfmake/fonts/Roboto" {
  import type { PdfMakeFontDefinitions } from "pdfmake";

  const fonts: PdfMakeFontDefinitions;
  export default fonts;
}
