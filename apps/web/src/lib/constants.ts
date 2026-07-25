import { Plan } from "@prisma/client";

// Uploadthing's `FileSize` only accepts powers of two
type FileSizeMb = 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | 1024;

interface PlanData {
  title: string;
  price: number;
  maxDocs: number;
  maxPagesPerDoc: number;
  maxFileSizeMbPerDoc: FileSizeMb;
}

export const PLANS: Record<Plan, PlanData> = {
  FREE: {
    title: "Free",
    price: 0,
    maxDocs: 3,
    maxPagesPerDoc: 10,
    maxFileSizeMbPerDoc: 8,
  },

  FREE_PLUS: {
    title: "Free Plus",
    price: 0,
    maxDocs: 25,
    maxPagesPerDoc: 15,
    maxFileSizeMbPerDoc: 8,
  },
  PRO: {
    title: "Pro",
    price: 9.99,
    maxDocs: 100,
    maxPagesPerDoc: 40,
    maxFileSizeMbPerDoc: 64,
  },
};

export const FREE_PLAN = "FREE";

/** The uploadthing route is defined once, so it must allow the most generous plan. */
export const MAX_FILE_SIZE_MB_ANY_PLAN = Math.max(
  ...Object.values(PLANS).map((p) => p.maxFileSizeMbPerDoc),
) as FileSizeMb;

export const fileSizeLabel = (mb: FileSizeMb) => `${mb}MB` as const;
export const fileSizeBytes = (mb: FileSizeMb) => mb * 1024 * 1024;

export { PDF_BACKGROUND_COLOURS } from "@uxie/shared/lib/constants";
