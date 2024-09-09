import { Plan } from "@prisma/client";

interface PlanData {
  title: string;
  price: number;
  maxDocs: number;
  maxPagesPerDoc: number;
  maxFileSizePerDoc: string;
  maxCollaboratorsPerDoc: number;
}

export const PLANS: Record<Plan, PlanData> = {
  FREE: {
    title: "Free",
    price: 0,
    maxDocs: 3,
    maxPagesPerDoc: 5,
    maxFileSizePerDoc: "8MB",
    maxCollaboratorsPerDoc: 0,
  },

  FREE_PLUS: {
    title: "Free",
    price: 0,
    maxDocs: 5,
    maxPagesPerDoc: 5,
    maxFileSizePerDoc: "8MB",
    maxCollaboratorsPerDoc: 0,
  },
  PRO: {
    title: "Pro",
    price: 9.99,
    maxDocs: 100,
    maxPagesPerDoc: 25,
    maxFileSizePerDoc: "64MB",
    maxCollaboratorsPerDoc: 5,
  },
};

export const FREE_PLAN = "FREE";
