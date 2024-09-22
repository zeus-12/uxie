import { generateReactHelpers } from "@uploadthing/react";

import type { OurFileRouter } from "@/server/uploadthing";

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
