import { parseCsv, type CsvOptions } from "./csv";
import { parseFit } from "./fit";
import { ImportError, type NormalizedRun } from "./types";
import { parseGpx, parseTcx } from "./xml";

export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

export async function parseActivityFile(
  filename: string,
  data: ArrayBuffer,
  opts: CsvOptions = {},
): Promise<{ source: string; runs: NormalizedRun[] }> {
  if (data.byteLength > MAX_IMPORT_BYTES) throw new ImportError("File is larger than 15 MB");
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "fit") return { source: "fit", runs: await parseFit(data) };
  const text = new TextDecoder("utf-8").decode(data);
  if (ext === "gpx") return { source: "gpx", runs: parseGpx(text) };
  if (ext === "tcx") return { source: "tcx", runs: parseTcx(text) };
  if (ext === "csv" || ext === "txt") return { source: "csv", runs: parseCsv(text, opts) };
  throw new ImportError("Unsupported file type. Use GPX, TCX, FIT or CSV.");
}

export { ImportError };
export type { NormalizedRun };
