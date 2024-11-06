import { env } from "@/env.mjs";
import { StreamingTextResponse } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { z } from "zod";

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
export const FEEDBACK_TYPES = ["Bug", "Feature request", "Other"] as const;

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

export const generateDummyStream = () => {
  return new StreamingTextResponse(
    new ReadableStream({
      async start(controller) {
        let i = 0;
        while (i < 15) {
          controller.enqueue(`${i}`);
          i++;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        controller.enqueue(`done, time: ${new Date().toISOString()}`);
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain",
      },
    },
  );
};

export const isBrowser = typeof window !== "undefined";

// export const noop = () => {};

export const downloadPageAsHtml = (id?: string) => {
  if (!isBrowser) {
    throw new Error("This function can only be called in the browser.");
  }
  let html = document.documentElement.outerHTML;
  if (id) {
    const el = document.getElementById(id);
    if (el) {
      html = el.outerHTML;
    }
  }

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "page.html";
  a.click();
};

export const waitFor = (ms: number) => new Promise((r) => setTimeout(r, ms));
