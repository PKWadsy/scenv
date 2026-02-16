import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createInterface } from "node:readline";
import { defaultPrompt } from "./prompt-default.js";

vi.mock("node:readline", () => ({
  createInterface: vi.fn(),
}));

describe("defaultPrompt", () => {
  let questionCb: (answer: string) => void;
  let errorCb: (err: Error) => void;

  beforeEach(() => {
    vi.mocked(createInterface).mockImplementation((opts: { input: unknown; output: unknown }) => {
      return {
        question: (msg: string, cb: (answer: string) => void) => {
          questionCb = cb;
        },
        on: (ev: string, cb: (err: Error) => void) => {
          if (ev === "error") errorCb = cb;
        },
        close: vi.fn(),
      } as ReturnType<typeof createInterface>;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves with user input when non-empty", async () => {
    const p = defaultPrompt("Test Name", "default");
    queueMicrotask(() => questionCb("  user-typed  "));
    const value = await p;
    expect(value).toBe("user-typed");
  });

  it("resolves with default when user input is empty", async () => {
    const p = defaultPrompt("Test Name", "my-default");
    queueMicrotask(() => questionCb(""));
    const value = await p;
    expect(value).toBe("my-default");
  });

  it("uses empty string message when default is undefined", async () => {
    const p = defaultPrompt("Name", undefined as unknown as string);
    queueMicrotask(() => questionCb("x"));
    await p;
    expect(createInterface).toHaveBeenCalledWith({
      input: process.stdin,
      output: process.stdout,
    });
  });

  it("rejects when error event fires", async () => {
    const p = defaultPrompt("X", "d");
    queueMicrotask(() => errorCb(new Error("readline error")));
    await expect(p).rejects.toThrow("readline error");
  });
});
