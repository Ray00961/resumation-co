import type { ContactInfo } from "../../schemas/cv-json-v1.ts";

export function joinNonEmpty(values: string[], separator = " | "): string {
  return values
    .filter((v) => typeof v === "string" && v.trim() !== "")
    .join(separator);
}

export function buildContactLine(contact: ContactInfo): string {
  return joinNonEmpty([
    contact.email,
    contact.phone,
    contact.linkedin,
    contact.location,
  ]);
}
