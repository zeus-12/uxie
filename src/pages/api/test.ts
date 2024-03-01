import { vectoriseDocument } from "@/lib/vectorise";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // local db
  await vectoriseDocument(
    "https://utfs.io/f/9e2e286e-e56a-4692-b71d-3d8e29ec5d8f-d9prv8.pdf",
    "closx7tog001cvxo3vd20lqfk",
  );
}
