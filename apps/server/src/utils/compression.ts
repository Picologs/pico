import { gzipSync, gunzipSync } from "zlib";
import {
  COMPRESSION_THRESHOLD_BYTES,
  COMPRESSION_THRESHOLD_LOGS,
} from "../config/constants";

/**
 * Compress a logs array using gzip
 * @param logs - Array of log objects to compress
 * @returns Base64-encoded gzipped JSON string
 */
export function compressLogs(logs: any[]): string {
  const json = JSON.stringify(logs);
  const compressed = gzipSync(json);
  return compressed.toString("base64");
}

/**
 * Decompress a base64-encoded gzipped JSON string
 * @param compressedData - Base64-encoded gzipped data
 * @returns Array of decompressed log objects
 */
export function decompressLogs(compressedData: string): any[] {
  const compressed = Buffer.from(compressedData, "base64");
  const decompressed = gunzipSync(compressed);
  return JSON.parse(decompressed.toString("utf-8"));
}

/**
 * Check if logs should be compressed based on size/count thresholds
 * @param logs - Array of log objects
 * @returns true if compression should be used
 */
export function shouldCompressLogs(logs: any[]): boolean {
  if (logs.length > COMPRESSION_THRESHOLD_LOGS) {
    return true;
  }
  const jsonSize = JSON.stringify(logs).length;
  return jsonSize > COMPRESSION_THRESHOLD_BYTES;
}
