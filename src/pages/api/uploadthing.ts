import { docUploader } from "@/server/uploadthing";
import { createRouteHandler } from "uploadthing/next-legacy";

const handler = createRouteHandler({
  router: docUploader,
});

export default handler;
