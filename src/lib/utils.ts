import { env } from "@/env.mjs";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import * as z from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRandomLightColor() {
  const getRandomLightValue = () => Math.floor(Math.random() * 128) + 128;
  const toHex = (value: number) => value.toString(16).padStart(2, "0");

  const r = getRandomLightValue();
  const g = getRandomLightValue();
  const b = getRandomLightValue();

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// FEEDBACK FORM UTILS
export const FEEDBACK_TYPES = ["Feature request", "Bug", "Other"] as const;
export const feedbackFormSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  message: z
    .string()
    .min(10, { message: "Feedback should be atleast 10 characters." })
    .max(200, {
      message: "Feedback must not be longer than 200 characters.",
    }),
  type: z.enum(FEEDBACK_TYPES),
});

export const FEEDBACK_FORM_DEFAULT_VALUES = {
  email: "",
  message: "",
  type: FEEDBACK_TYPES[0],
};

export const copyTextToClipboard = (
  text: string | undefined,
  callback: () => void,
) => {
  if (text) {
    navigator.clipboard.writeText(text);
  }
  callback();
};

export const isDev = env.NEXT_PUBLIC_ENV === "development";
