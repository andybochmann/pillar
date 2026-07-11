import { describe, it, expect, vi, beforeEach } from "vitest";

const connectMock = vi.hoisted(() => vi.fn());

vi.mock("mongoose", () => ({
  default: { connect: connectMock },
}));

describe("connectDB", () => {
  beforeEach(() => {
    vi.resetModules();
    connectMock.mockReset();
    // Reset the HMR-cached connection between tests
    (globalThis as { mongooseCache?: unknown }).mongooseCache = undefined;
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
  });

  it("does not cache a rejected connection promise (Bug H7)", async () => {
    connectMock
      .mockRejectedValueOnce(new Error("transient outage"))
      .mockResolvedValueOnce({ connection: {} });

    const { connectDB } = await import("./db");

    // First attempt fails
    await expect(connectDB()).rejects.toThrow("transient outage");

    // Second attempt must retry a fresh connect (the rejected promise was
    // not cached) and succeed.
    await expect(connectDB()).resolves.toBeDefined();
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it("caches a successful connection", async () => {
    connectMock.mockResolvedValue({ connection: {} });

    const { connectDB } = await import("./db");

    const first = await connectDB();
    const second = await connectDB();

    expect(first).toBe(second);
    // Only connects once — subsequent calls reuse the cached connection.
    expect(connectMock).toHaveBeenCalledTimes(1);
  });
});
