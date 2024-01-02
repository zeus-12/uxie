import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
