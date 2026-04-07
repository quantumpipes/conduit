import { describe, it, expect, vi, beforeEach } from "vitest";
import { tlsApi } from "./tls";

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: () => Promise.resolve(data),
  });
}

describe("tlsApi", () => {
  describe("list", () => {
    it("calls GET /api/tls (not /api/tls/certs)", async () => {
      mockFetch.mockReturnValue(jsonResponse({ certs: [] }));

      await tlsApi.list();

      expect(mockFetch).toHaveBeenCalledWith("/api/tls");
    });

    it("returns certs array", async () => {
      const certs = [{ name: "grafana", status: "valid" }];
      mockFetch.mockReturnValue(jsonResponse({ certs }));

      const result = await tlsApi.list();

      expect(result.certs).toEqual(certs);
    });
  });

  describe("rotate", () => {
    it("calls POST /api/tls/{name}/rotate", async () => {
      mockFetch.mockReturnValue(jsonResponse({ ok: true }));

      await tlsApi.rotate("grafana");

      expect(mockFetch).toHaveBeenCalledWith("/api/tls/grafana/rotate", expect.objectContaining({
        method: "POST",
      }));
    });
  });

  describe("inspect", () => {
    it("calls GET /api/tls/{name}/inspect", async () => {
      mockFetch.mockReturnValue(jsonResponse({ name: "grafana" }));

      await tlsApi.inspect("grafana");

      expect(mockFetch).toHaveBeenCalledWith("/api/tls/grafana/inspect");
    });
  });

  describe("trust", () => {
    it("calls POST /api/tls/trust", async () => {
      mockFetch.mockReturnValue(jsonResponse({ ok: true }));

      await tlsApi.trust();

      expect(mockFetch).toHaveBeenCalledWith("/api/tls/trust", expect.objectContaining({
        method: "POST",
      }));
    });
  });

  describe("getCaInfo", () => {
    it("calls GET /api/tls/ca", async () => {
      mockFetch.mockReturnValue(jsonResponse({ ca: null }));

      await tlsApi.getCaInfo();

      expect(mockFetch).toHaveBeenCalledWith("/api/tls/ca");
    });
  });
});
