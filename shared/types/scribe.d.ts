declare module "scribe.js-ocr" {
  export interface ScribeProgressMessage {
    type: string;
    n?: number;
    info?: { engineName?: string };
  }

  export interface ScribeDocument {
    inputData: { pageCount: number; ocrApplied: boolean[] | null };
    progressHandler: (message: ScribeProgressMessage) => void;
    recognize(options: {
      langs: string[];
      modeAdv: "lstm";
      vanillaMode: false;
      ocrPages: "autoShallow";
      signal?: AbortSignal;
    }): Promise<unknown>;
    exportData(
      format: "pdf",
      options: { displayMode: "invis" },
    ): Promise<string | ArrayBuffer>;
    close(): Promise<void>;
  }

  const scribe: {
    openDocument(files: File[]): Promise<ScribeDocument>;
  };

  export default scribe;
}
