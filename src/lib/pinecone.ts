import { env } from "@/env.mjs";
import { Pinecone } from "@pinecone-database/pinecone";

export const getPineconeClient = () => {
  return new Pinecone({
    environment: env.PINECONE_ENVIRONMENT,
    apiKey: env.PINECONE_API_KEY,
  });
};
