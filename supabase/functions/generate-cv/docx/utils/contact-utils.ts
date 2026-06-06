import type { ContactInfo } from "../schemas/cv-json-v1.ts";

export function buildContactLine(contact: ContactInfo): string {
  return [contact.email, contact.phone, contact.linkedin, contact.location]
    .filter((v) => typeof v === "string" && v.trim() !== "")
    .join(" | ");
}