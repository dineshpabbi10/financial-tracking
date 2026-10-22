import { describe, expect, it } from "vitest";
import { parseStatementDate } from "@/lib/import/statement-date";

describe("parseStatementDate", () => {
  it("parses unambiguous dates", () => {
    expect(parseStatementDate("2026-09-01")).toBe("2026-09-01");
    expect(parseStatementDate("2026/9/1")).toBe("2026-09-01");
    expect(parseStatementDate("20260901")).toBe("2026-09-01");
    expect(parseStatementDate("2026-09-01T12:00:00Z")).toBe("2026-09-01");
  });

  it("uses Canadian month-first order when either order is possible", () => {
    expect(parseStatementDate("09/01/2026")).toBe("2026-09-01");
    expect(parseStatementDate("09/01/2026", "mdy")).toBe("2026-09-01");
    expect(parseStatementDate("09/01/2026", "dmy")).toBe("2026-01-09");
  });

  it("disambiguates impossible month/day combinations", () => {
    expect(parseStatementDate("13/01/2026")).toBe("2026-01-13");
    expect(parseStatementDate("01/13/2026")).toBe("2026-01-13");
  });

  it("parses month names in English and French", () => {
    expect(parseStatementDate("Sep 3, 2026")).toBe("2026-09-03");
    expect(parseStatementDate("3 September 2026")).toBe("2026-09-03");
    expect(parseStatementDate("05-JAN-2026")).toBe("2026-01-05");
    expect(parseStatementDate("5 sept. 2026")).toBe("2026-09-05");
    expect(parseStatementDate("5 février 2026")).toBe("2026-02-05");
  });

  it("uses the statement year when the date omits it", () => {
    expect(parseStatementDate("Jan 05", "auto", 2025)).toBe("2025-01-05");
    expect(parseStatementDate("05 Jan", "auto", 2025)).toBe("2025-01-05");
    expect(parseStatementDate("01/05", "dmy", 2025)).toBe("2025-05-01");
    expect(parseStatementDate("Jan 05")).toBeNull();
  });

  it("rejects invalid calendar dates", () => {
    expect(parseStatementDate("2026-02-29")).toBeNull();
    expect(parseStatementDate("31/04/2026")).toBeNull();
    expect(parseStatementDate("not a date")).toBeNull();
    expect(parseStatementDate("")).toBeNull();
  });
});
