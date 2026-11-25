import { readFileSync, renameSync, writeFileSync } from "node:fs";

/** Reads the saved Jetstream position (Unix microseconds). */
export function loadCursor(path: string): number | undefined {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const value = Number(text.trim());
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/** Writes through a temporary file so a crash cannot leave a half-written cursor. */
export function saveCursor(path: string, cursor: number): void {
  writeFileSync(`${path}.tmp`, `${cursor}\n`);
  renameSync(`${path}.tmp`, path);
}
