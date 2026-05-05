import { Readable } from 'stream';
import sysLogger from './logger';

export type CsvRow = Record<string, string>;

/**
 * Parse a single CSV line handling quotes and escapes.
 * Properly handles:
 * - Quoted fields with commas inside: "name, with comma"
 * - Escaped quotes: "He said ""Hello"""
 * - Whitespace trimming
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Comma outside quotes = field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Push final field
  result.push(current.trim());
  return result;
}

/**
 * Stream CSV file and yield chunks of parsed rows.
 *
 * Features:
 * - Streams file without loading entire content into memory
 * - Auto-detects headers from first line
 * - Skips empty/blank lines
 * - Handles CSV quoting and escaping
 * - Validates row has correct number of columns
 * - Yields rows in configurable chunks (default: 500)
 *
 * @param fileStream - Readable stream of CSV file
 * @param chunkSize - Number of rows per chunk (default: 500)
 *
 * @example
 *   for await (const chunk of streamCSVChunks(fileStream, 500)) {
 *     // chunk is array of CsvRow[], max 500 rows
 *     console.log(`Processing ${chunk.length} rows`);
 *   }
 */
export async function* streamCSVChunks(
  fileStream: Readable,
  chunkSize: number = 500,
): AsyncGenerator<CsvRow[]> {
  let buffer = '';
  let headers: string[] = [];
  let isHeaderParsed = false;
  const rowBuffer: CsvRow[] = [];
  let lineCount = 0;
  let rowCount = 0;

  for await (const chunk of fileStream) {
    buffer += chunk.toString();

    // Split by newlines, keep incomplete line in buffer
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep last incomplete line

    for (const line of lines) {
      lineCount++;

      // Skip empty or whitespace-only lines
      if (!line.trim()) {
        continue;
      }

      // Parse header from first non-empty line
      if (!isHeaderParsed) {
        headers = parseCsvLine(line);
        isHeaderParsed = true;
        sysLogger.info(`CSV headers detected: ${headers.join(', ')}`);
        continue;
      }

      // Parse data row
      const values = parseCsvLine(line);

      // Validate row has correct column count
      if (values.length === 0) {
        continue; // Skip malformed empty rows
      }

      if (values.length !== headers.length) {
        sysLogger.warn(
          `Line ${lineCount}: Column mismatch. Expected ${headers.length}, got ${values.length}. Skipping.`,
        );
        continue;
      }

      // Build row object
      const row: CsvRow = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || '';
      });
      rowBuffer.push(row);
      rowCount++;

      // Yield chunk when threshold reached
      if (rowBuffer.length >= chunkSize) {
        const chunk = rowBuffer.splice(0, chunkSize);
        sysLogger.debug(
          `CSV: Yielding chunk of ${chunk.length} rows (total: ${rowCount})`,
        );
        yield chunk;
      }
    }
  }

  // Process remaining buffer (incomplete last line)
  if (buffer.trim()) {
    const values = parseCsvLine(buffer);

    if (values.length > 0 && values.length === headers.length) {
      const row: CsvRow = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || '';
      });
      rowBuffer.push(row);
      rowCount++;
    } else if (values.length > 0) {
      sysLogger.warn(
        `Final line: Column mismatch. Expected ${headers.length}, got ${values.length}. Skipping.`,
      );
    }
  }

  // Yield remaining rows
  if (rowBuffer.length > 0) {
    sysLogger.debug(`CSV: Yielding final chunk of ${rowBuffer.length} rows`);
    yield rowBuffer;
  }

  sysLogger.info(
    `CSV parsing complete: ${lineCount} lines, ${rowCount} data rows parsed`,
  );
}
