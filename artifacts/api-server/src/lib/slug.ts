export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .substring(0, 20);

  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}
