export type LineEnding = "crlf" | "lf";

export function detectLineEnding(input: string): LineEnding {
  return input.includes("\r\n") ? "crlf" : "lf";
}

export function applyLineEnding(input: string, lineEnding: LineEnding): string {
  const normalized = input.replace(/\r\n/g, "\n");
  return lineEnding === "crlf" ? normalized.replace(/\n/g, "\r\n") : normalized;
}

