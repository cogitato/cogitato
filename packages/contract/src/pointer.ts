// JSON pointer helpers. No Node imports: this module is part of the browser-safe tokens entry.

export function pointer(...segments: (string | number)[]): string {
  return segments.map((s) => "/" + String(s).replace(/~/g, "~0").replace(/\//g, "~1")).join("");
}

function segmentsOf(path: string): string[] {
  if (!path) return [];
  return path
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/** Human form of a JSON pointer: "/screens/1/states/0/id" -> "screens #2 › states #1 › id". */
export function describePath(path: string): string {
  return segmentsOf(path)
    .map((s) => (/^\d+$/.test(s) ? `#${Number(s) + 1}` : s))
    .join(" › ")
    .replace(/ › #/g, " #");
}
