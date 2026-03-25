import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { parse } from "csv-parse/sync";

const projectRoot = process.cwd();
const curatedDir = path.join(projectRoot, "..", "..", "data", "curated");

type CsvRow = Record<string, string>;

const readCsv = cache(async (fileName: string) => {
  const content = await readFile(path.join(curatedDir, fileName), "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
});

export async function readCuratedCsv(fileName: string) {
  return readCsv(fileName);
}

export async function readCuratedCsvOptional(fileName: string) {
  try {
    return await readCsv(fileName);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
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
