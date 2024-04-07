import {
  generateReactHelpers,
  generateUploadDropzone,
} from "@uploadthing/react";

import type { OurFileRouter } from "@/server/uploadthing";

export const UploadDropzone = generateUploadDropzone<OurFileRouter>();

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
