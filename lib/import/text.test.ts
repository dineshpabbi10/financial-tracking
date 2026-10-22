import { describe, expect, it } from "vitest";
import { decodeText } from "@/lib/import/text";

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

describe("decodeText", () => {
  it("decodes UTF-8 statements", () => {
    const text = "Date;Libellé;Débit\n01/09/2026;Dépôt;45,00";
    expect(decodeText(arrayBuffer(new TextEncoder().encode(text)))).toBe(text);
  });

  it("falls back to Windows-1252 for older French exports", () => {
    // "Libellé" encoded as Windows-1252 (0xe9 is é).
    const bytes = Uint8Array.from([
      0x4c, 0x69, 0x62, 0x65, 0x6c, 0x6c, 0xe9,
    ]);
    expect(decodeText(arrayBuffer(bytes))).toBe("Libellé");
  });

  it("honours an OFX CHARSET declaration", () => {
    const prefix = new TextEncoder().encode("OFXHEADER:100\nCHARSET:1252\n\n");
    const suffix = Uint8Array.from([0x44, 0xe9, 0x70, 0xf4, 0x74]); // Dépôt
    const bytes = new Uint8Array(prefix.length + suffix.length);
    bytes.set(prefix);
    bytes.set(suffix, prefix.length);
    expect(decodeText(arrayBuffer(bytes))).toContain("Dépôt");
  });

  it("decodes UTF-16LE with a BOM", () => {
    const bytes = Uint8Array.from([
      0xff, 0xfe, 0x48, 0x00, 0x69, 0x00,
    ]);
    expect(decodeText(arrayBuffer(bytes))).toBe("Hi");
  });
});
