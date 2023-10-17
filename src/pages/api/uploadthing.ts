import { createNextPageApiHandler } from "uploadthing/next-legacy";

import { imageUploader } from "@/server/uploadthing";

const handler = createNextPageApiHandler({
  router: imageUploader,
});

export default handler;
