import { describe, it, expect, vi, afterEach } from "vitest";
import { timeSince, formatBytes, formatDuration, esc, formatLogTime } from "./format";

describe("timeSince", () => {
  afterEach(() => vi.useRealTimers());

  it("returns dash for empty string", () => {
    expect(timeSince("")).toBe("\u2014");
  });

  it("returns dash for zero-date", () => {
    expect(timeSince("0001-01-01T00:00:00Z")).toBe("\u2014");
  });

  it("returns 'just now' for future dates", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(timeSince(future)).toBe("just now");
  });

  it("returns seconds for <60s", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:30Z"));
    expect(timeSince("2026-04-07T12:00:00Z")).toBe("30s ago");
  });

  it("returns minutes for <60m", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:05:00Z"));
    expect(timeSince("2026-04-07T12:00:00Z")).toBe("5m ago");
  });

  it("returns hours and minutes for <24h", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T14:30:00Z"));
    expect(timeSince("2026-04-07T12:00:00Z")).toBe("2h 30m ago");
  });

  it("returns days and hours for >=24h", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T14:00:00Z"));
    expect(timeSince("2026-04-07T12:00:00Z")).toBe("2d 2h ago");
  });
});

describe("formatBytes", () => {
  it("returns '0 B' for zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("returns bytes for <1024", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("returns KB for <1MB", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("returns MB for <1GB", () => {
    expect(formatBytes(5 * 1024 ** 2)).toBe("5.0 MB");
  });

  it("returns GB for >=1GB", () => {
    expect(formatBytes(2.5 * 1024 ** 3)).toBe("2.50 GB");
  });
});

describe("formatDuration", () => {
  it("returns empty string for undefined", () => {
    expect(formatDuration(undefined)).toBe("");
  });

  it("returns '<1ms' for sub-microsecond", () => {
    expect(formatDuration(0.0001)).toBe("<1ms");
  });

  it("returns ms for <1s", () => {
    expect(formatDuration(0.25)).toBe("250ms");
  });

  it("returns seconds for >=1s", () => {
    expect(formatDuration(3.456)).toBe("3.46s");
  });
});

describe("esc", () => {
  it("escapes HTML entities", () => {
    expect(esc("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt;",
    );
  });

  it("passes plain text through", () => {
    expect(esc("hello world")).toBe("hello world");
  });

  it("escapes ampersands", () => {
    expect(esc("a&b")).toBe("a&amp;b");
  });
});

describe("formatLogTime", () => {
  it("returns dash for undefined", () => {
    expect(formatLogTime()).toBe("\u2014");
  });

  it("returns dash for empty string", () => {
    expect(formatLogTime("")).toBe("\u2014");
  });

  it("returns dash for zero-date", () => {
    expect(formatLogTime("0001-01-01T00:00:00Z")).toBe("\u2014");
  });

  it("returns dash for invalid date", () => {
    expect(formatLogTime("not-a-date")).toBe("\u2014");
  });

  it("returns 24h time for valid ISO", () => {
    const result = formatLogTime("2026-04-07T14:30:45Z");
    // Time format depends on locale, just check it contains digits and colons
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
