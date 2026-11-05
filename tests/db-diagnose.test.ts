import { describe, expect, it } from "vitest";
import { classifyDbError } from "@/lib/db-diagnose";

describe("classifyDbError", () => {
  it("spots a missing connection string", () => {
    expect(classifyDbError(new Error("error: Environment variable not found: DATABASE_URL."))).toBe("no_url");
  });
  it("spots wrong credentials", () => {
    expect(classifyDbError({ errorCode: "P1000", message: "Authentication failed against database server" })).toBe("bad_credentials");
  });
  it("spots an unreachable server", () => {
    expect(classifyDbError({ errorCode: "P1001", message: "Can't reach database server at `x:5432`" })).toBe("unreachable");
  });
  it("spots missing tables", () => {
    expect(classifyDbError({ code: "P2021", message: "The table `public.User` does not exist in the current database." })).toBe("tables_missing");
  });
  it("falls back to unknown", () => {
    expect(classifyDbError(new Error("boom"))).toBe("unknown");
  });
});
