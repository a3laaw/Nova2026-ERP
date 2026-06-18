import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getTenantPath(companyId: string, ...segments: string[]) {
  return ["companies", companyId, ...segments].join("/");
}
