export function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function hasText(value: unknown): boolean {
  return cleanText(value) !== "";
}

export function cleanTextArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => cleanText(value))
    .filter((value) => value !== "");
}

export function joinNonEmpty(values: unknown[], separator = " | "): string {
  return values
    .map((value) => cleanText(value))
    .filter((value) => value !== "")
    .join(separator);
}

export function hasAnyText(values: unknown[]): boolean {
  return values.some((value) => hasText(value));
}