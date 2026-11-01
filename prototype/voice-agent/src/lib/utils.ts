import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("zh-HK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
