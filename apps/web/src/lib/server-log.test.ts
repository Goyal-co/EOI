import { afterEach, describe, expect, it, vi } from "vitest";
import { formatServerLog, logApiError, serializeError } from "./server-log";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("server-log", () => {
  it("formats a grep-friendly error line", () => {
    expect(
      formatServerLog("error", "partner.register", "Failed to upload", {
        status: 400,
        method: "POST",
        path: "/api/partner/register",
        code: "UPLOAD_FAILED",
      }),
    ).toBe(
      "[error] scope=partner.register method=POST path=/api/partner/register status=400 code=UPLOAD_FAILED msg=Failed to upload",
    );
  });

  it("serializes Error objects with stack", () => {
    const err = new Error("boom");
    const serialized = serializeError(err);
    expect(serialized.name).toBe("Error");
    expect(serialized.message).toBe("boom");
    expect(String(serialized.stack)).toContain("boom");
  });

  it("logs 5xx as error and 4xx as warn", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logApiError({ message: "Internal", status: 500 });
    logApiError({ message: "Bad request", status: 400, code: "BAD_REQUEST" });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain("[error]");
    expect(String(errorSpy.mock.calls[0][0])).toContain("status=500");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("[warn]");
    expect(String(warnSpy.mock.calls[0][0])).toContain("status=400");
  });
});
