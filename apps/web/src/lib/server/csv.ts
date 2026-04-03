import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { parse } from "csv-parse/sync";

const projectRoot = process.cwd();
const curatedDir = path.join(projectRoot, "..", "..", "data", "curated");

type CsvRow = Record<string, string>;
const missingCuratedCsvWarnings = new Set<string>();

const readCsv = cache(async (fileName: string) => {
  try {
    const content = await readFile(path.join(curatedDir, fileName), "utf-8");
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      if (!missingCuratedCsvWarnings.has(fileName)) {
        missingCuratedCsvWarnings.add(fileName);
        console.warn(
          `[curated-csv:missing] ${fileName} was not found in data/curated. Falling back to empty data.`,
        );
      }

      return [];
    }

    throw error;
  }
});

export async function readCuratedCsv(fileName: string) {
  return readCsv(fileName);
}

export async function readCuratedCsvOptional(fileName: string) {
  return readCsv(fileName);
}

export function parseNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

export function parseBoolean(value: string | undefined) {
  return value === "true" || value === "True";
}
