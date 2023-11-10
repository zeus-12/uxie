import { createNextPageApiHandler } from "uploadthing/next-legacy";

import { docUploader } from "@/server/uploadthing";

const handler = createNextPageApiHandler({
  router: docUploader,
});

export default handler;
