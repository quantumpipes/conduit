import { describe, it, expect, vi, beforeEach } from "vitest";
import { get, post, put, del, ApiError } from "./client";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

function ok(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve(data),
  });
}

function err(status: number, body: unknown) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: "Bad Request",
    json: () => Promise.resolve(body),
  });
}

describe("ApiError", () => {
  it("has status and message", () => {
    const e = new ApiError(404, "Not found");
    expect(e.status).toBe(404);
    expect(e.message).toBe("Not found");
    expect(e.name).toBe("ApiError");
  });

  it("extends Error", () => {
    expect(new ApiError(500, "fail")).toBeInstanceOf(Error);
  });
});

describe("get", () => {
  it("calls fetch with /api prefix", async () => {
    mockFetch.mockReturnValue(ok({ items: [] }));
    await get("/services");
    expect(mockFetch).toHaveBeenCalledWith("/api/services");
  });

  it("returns parsed JSON body", async () => {
    mockFetch.mockReturnValue(ok({ count: 42 }));
    const result = await get<{ count: number }>("/count");
    expect(result.count).toBe(42);
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockReturnValue(err(404, { error: "Not found" }));
    await expect(get("/missing")).rejects.toThrow(ApiError);
  });

  it("includes error message from response body", async () => {
    mockFetch.mockReturnValue(err(400, { error: "Invalid input" }));
    await expect(get("/bad")).rejects.toThrow("Invalid input");
  });

  it("falls back to statusText when no error field", async () => {
    mockFetch.mockReturnValue(err(500, {}));
    await expect(get("/fail")).rejects.toThrow("Bad Request");
  });
});

describe("post", () => {
  it("sends POST with JSON body", async () => {
    mockFetch.mockReturnValue(ok({ ok: true }));
    await post("/services", { name: "grafana" });
    expect(mockFetch).toHaveBeenCalledWith("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"grafana"}',
    });
  });

  it("sends POST without body when data is undefined", async () => {
    mockFetch.mockReturnValue(ok({ ok: true }));
    await post("/tls/trust");
    expect(mockFetch).toHaveBeenCalledWith("/api/tls/trust", expect.objectContaining({
      method: "POST",
    }));
  });

  it("throws ApiError on error response", async () => {
    mockFetch.mockReturnValue(err(422, { error: "Validation failed" }));
    await expect(post("/bad", {})).rejects.toThrow("Validation failed");
  });
});

describe("put", () => {
  it("sends PUT with JSON body", async () => {
    mockFetch.mockReturnValue(ok({ ok: true }));
    await put("/services/grafana", { port: 3001 });
    expect(mockFetch).toHaveBeenCalledWith("/api/services/grafana", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: '{"port":3001}',
    });
  });

  it("throws ApiError on error response", async () => {
    mockFetch.mockReturnValue(err(409, { error: "Conflict" }));
    await expect(put("/dup", {})).rejects.toThrow("Conflict");
  });
});

describe("del", () => {
  it("sends DELETE request", async () => {
    mockFetch.mockReturnValue(ok({ ok: true }));
    await del("/services/grafana");
    expect(mockFetch).toHaveBeenCalledWith("/api/services/grafana", {
      method: "DELETE",
    });
  });

  it("throws ApiError on error response", async () => {
    mockFetch.mockReturnValue(err(404, { error: "Not found" }));
    await expect(del("/missing")).rejects.toThrow("Not found");
  });
});
