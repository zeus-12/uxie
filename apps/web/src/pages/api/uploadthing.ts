import { docUploader } from "@/server/uploadthing";
import { createRouteHandler } from "uploadthing/next-legacy";

export const config = {
  maxDuration: 30,
};

const handler = createRouteHandler({
  router: docUploader,
});

export default handler;
