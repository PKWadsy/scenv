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
  resetLogState,
  LOG_LEVELS,
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
    const cb = getCallbacks();
    expect(typeof cb.defaultPrompt).toBe("function");
    expect(typeof cb.onAskWhetherToSave).toBe("function");
    expect(typeof cb.onAskContext).toBe("function");
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

  it("re-exports resetLogState and LOG_LEVELS", () => {
    expect(typeof resetLogState).toBe("function");
    expect(LOG_LEVELS).toEqual(["none", "trace", "debug", "info", "warn", "error"]);
  });
});
