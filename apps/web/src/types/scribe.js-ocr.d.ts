declare module "scribe.js-ocr" {
  interface ScribeDocument {
    inputData: { pageCount: number };
    progressHandler: (message: {
      type: string;
      n?: number;
      info?: { engineName?: string };
    }) => void;
    recognize(options: {
      langs: string[];
      modeAdv: "lstm";
      vanillaMode: true;
      ocrPages: "autoShallow";
    }): Promise<unknown>;
    exportData(
      format: "pdf",
      options: { displayMode: "invis" },
    ): Promise<ArrayBuffer | Uint8Array>;
    close(): Promise<void>;
  }

  const scribe: {
    openDocument(files: File[]): Promise<ScribeDocument>;
  };

  export default scribe;
}
