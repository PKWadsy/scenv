import { describe, it, expect, beforeEach } from "vitest";
import { configure, resetConfig, scenv, getCallbacks } from "scenv";
import type { ScenvCallbacks } from "scenv";
import { prompt, askWhetherToSave, askContext, callbacks } from "./index.js";

describe("scenv-inquirer", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("callbacks() return type satisfies ScenvCallbacks", () => {
    const { callbacks: cbs } = callbacks();
    const _typed: ScenvCallbacks = cbs;
    expect(typeof cbs.defaultPrompt).toBe("function");
    expect(typeof cbs.onAskWhetherToSave).toBe("function");
    expect(typeof cbs.onAskContext).toBe("function");
  });

  it("configure() accepts callbacks() and getCallbacks() returns them", () => {
    const { callbacks: cbs } = callbacks();
    configure({ callbacks: cbs });
    const fromScenv = getCallbacks();
    expect(fromScenv.defaultPrompt).toBe(cbs.defaultPrompt);
    expect(fromScenv.onAskWhetherToSave).toBe(cbs.onAskWhetherToSave);
    expect(fromScenv.onAskContext).toBe(cbs.onAskContext);
  });

  it("scenv variable resolves with inquirer callbacks configured and prompt never", async () => {
    configure({ ...callbacks(), prompt: "never" });
    const v = scenv("Test Var", { key: "test_var", default: "from-default" });
    const value = await v.get();
    expect(value).toBe("from-default");
  });

  it("prompt() return is assignable to DefaultPromptFn", () => {
    const fn = prompt();
    expect(typeof fn).toBe("function");
    expect(fn.length).toBe(2);
  });

  it("askWhetherToSave() return has correct signature", () => {
    const fn = askWhetherToSave();
    expect(typeof fn).toBe("function");
    expect(fn.length).toBe(2);
  });

  it("askContext() return has correct signature", () => {
    const fn = askContext();
    expect(typeof fn).toBe("function");
    expect(fn.length).toBe(2);
  });
});
