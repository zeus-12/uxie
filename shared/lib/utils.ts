import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function copyTextToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function stripTextFromEnd(text: string | null | undefined, strip: string) {
  if (!text) return "";
  return text.endsWith(strip) ? text.slice(0, -strip.length) : text;
}
