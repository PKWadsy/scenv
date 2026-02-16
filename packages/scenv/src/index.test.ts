import { describe, it, expect } from "vitest";
import {
  loadConfig,
  configure,
  resetConfig,
  getCallbacks,
  getContextValues,
  discoverContextPaths,
  scenv,
  parseScenvArgs,
} from "./index.js";

describe("index", () => {
  it("re-exports loadConfig, configure, resetConfig, getCallbacks", () => {
    expect(typeof loadConfig).toBe("function");
    expect(typeof configure).toBe("function");
    expect(typeof resetConfig).toBe("function");
    expect(typeof getCallbacks).toBe("function");
    const config = loadConfig();
    expect(config).toHaveProperty("root");
    expect(config).toHaveProperty("contexts");
    expect(getCallbacks()).toEqual({});
  });

  it("re-exports getContextValues, discoverContextPaths", () => {
    expect(typeof getContextValues).toBe("function");
    expect(typeof discoverContextPaths).toBe("function");
  });

  it("re-exports scenv, parseScenvArgs", () => {
    expect(typeof scenv).toBe("function");
    expect(typeof parseScenvArgs).toBe("function");
    const v = scenv("Test", { default: "x" });
    expect(v.get).toBeDefined();
    expect(v.safeGet).toBeDefined();
    expect(v.save).toBeDefined();
    expect(parseScenvArgs([])).toEqual({});
  });
});
