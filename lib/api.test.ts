import { describe, expect, it } from "vitest";
import { ApiError, assertSameOrigin } from "@/lib/api";

function mutation(origin?: string): Request {
  const headers = new Headers({ host: "loonie.example" });
  if (origin) headers.set("origin", origin);
  return new Request("http://loonie.example/api/test", {
    method: "POST",
    headers,
  });
}

describe("assertSameOrigin", () => {
  it("accepts matching origins", () => {
    expect(() =>
      assertSameOrigin(mutation("http://loonie.example")),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(mutation("https://loonie.example")),
    ).not.toThrow();
  });

  it("rejects cross-origin mutations", () => {
    expect(() => assertSameOrigin(mutation("https://evil.example"))).toThrow(
      ApiError,
    );
  });

  it("rejects missing or malformed origins", () => {
    expect(() => assertSameOrigin(mutation())).toThrow(/Missing request origin/);
    expect(() => assertSameOrigin(mutation("null"))).toThrow(/Invalid origin/);
    expect(() => assertSameOrigin(mutation("not a url"))).toThrow(
      /Invalid origin/,
    );
  });
});
