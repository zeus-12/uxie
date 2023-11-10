import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRandomLightColor() {
  function getRandomLightValue() {
    return Math.floor(Math.random() * 128) + 128;
  }

  var r = getRandomLightValue();
  var g = getRandomLightValue();
  var b = getRandomLightValue();

  return "#" + r.toString(16) + g.toString(16) + b.toString(16);
}
