export function cleanSearchTerm(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s.'_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function buildDirectoryFilter(raw: string): string | null {
  const term = cleanSearchTerm(raw);
  if (!term) return null;
  const pattern = `"%${term}%"`;
  return ["full_name", "username", "institution", "field_of_interest"]
    .map((column) => `${column}.ilike.${pattern}`)
    .join(",");
}

export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}
