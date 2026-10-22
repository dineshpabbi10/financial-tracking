export function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let encoding = "utf-8";
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 600));
  const charset = head.match(/CHARSET[:\s]+(\d+)/i)?.[1];
  if (charset === "1252") encoding = "windows-1252";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = "utf-16le";

  if (encoding === "utf-8") {
    try {
      // Bank exports are usually UTF-8, but older French-Canadian exports are
      // sometimes Windows-1252 without a BOM. Fall back instead of showing
      // replacement characters in descriptions.
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder("windows-1252").decode(bytes);
    }
  }

  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
