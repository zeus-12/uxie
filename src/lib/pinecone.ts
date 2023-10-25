import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "@/env.mjs";

export const getPineconeClient = () => {
  return new Pinecone({
    environment: env.PINECONE_ENVIRONMENT,
    apiKey: env.PINECONE_API_KEY,
  });
};
