import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { configure, resetConfig } from "./config.js";
import { scenv } from "./variable.js";
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("variable", () => {
  let tmpDir: string;

  beforeEach(() => {
    resetConfig();
    tmpDir = join(tmpdir(), `scenv-var-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    configure({
      root: tmpDir,
      contexts: [],
      prompt: "never",
      ignoreEnv: true,
      ignoreContext: true,
    });
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {
      // ignore
    }
  });

  it("get() uses default when no set/env/context", async () => {
    const v = scenv("Core Server URL", { default: "localhost:7000" });
    const value = await v.get();
    expect(value).toBe("localhost:7000");
  });

  it("get() uses config.set override", async () => {
    configure({ set: { core_server_url: "https://api.example.com" } });
    const v = scenv("Core Server URL", { default: "localhost:7000" });
    const value = await v.get();
    expect(value).toBe("https://api.example.com");
  });

  it("get() uses env when not ignoreEnv", async () => {
    configure({ ignoreEnv: false });
    process.env.CORE_SERVER_URL = "https://env.example.com";
    const v = scenv("Core Server URL", { default: "localhost:7000" });
    const value = await v.get();
    expect(value).toBe("https://env.example.com");
    delete process.env.CORE_SERVER_URL;
  });

  it("get() uses context when not ignoreContext", async () => {
    const ctxPath = join(tmpDir, "prod.context.json");
    writeFileSync(
      ctxPath,
      JSON.stringify({ core_server_url: "https://ctx.example.com" })
    );
    configure({ ignoreContext: false, contexts: ["prod"] });
    const v = scenv("Core Server URL", { default: "localhost:7000" });
    const value = await v.get();
    expect(value).toBe("https://ctx.example.com");
  });

  it("get() throws when missing value and no default", async () => {
    const v = scenv("Required Var", { key: "required_var" });
    await expect(v.get()).rejects.toThrow(/Missing value/);
  });

  it("safeGet() returns success with value", async () => {
    const v = scenv("X", { default: "ok" });
    const result = await v.safeGet();
    expect(result.success).toBe(true);
    if (result.success) expect(result.value).toBe("ok");
  });

  it("safeGet() returns failure without throwing", async () => {
    const v = scenv("Required Var", { key: "required_var" });
    const result = await v.safeGet();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  it("get({ default: n }) overrides variable default for that call", async () => {
    const v = scenv("Port", { key: "port", default: 3000 });
    const value = await v.get({ default: 22 });
    expect(value).toBe(22);
    const valueNoOverride = await v.get();
    expect(valueNoOverride).toBe(3000);
  });

  it("get({ prompt: fn }) overrides variable prompt for that call", async () => {
    configure({ prompt: "always" });
    const v = scenv("Prompted", {
      key: "prompted_key",
      default: "var-default",
      prompt: () => "from-var-prompt",
    });
    const valueOverride = await v.get({ prompt: () => "from-call-prompt" });
    expect(valueOverride).toBe("from-call-prompt");
    const valueNoOverride = await v.get();
    expect(valueNoOverride).toBe("from-var-prompt");
  });

  it("get({ default, prompt }) applies both overrides for that call", async () => {
    configure({ prompt: "fallback" });
    const v = scenv("Both", { key: "both_key" });
    const value = await v.get({
      default: "call-default",
      prompt: (name, defaultVal) => {
        expect(defaultVal).toBe("call-default");
        return "prompted-value";
      },
    });
    expect(value).toBe("prompted-value");
  });

  it("safeGet(options) passes options to get", async () => {
    const v = scenv("Safe Override", { key: "safe_override" });
    const result = await v.safeGet({ default: "safe-default" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.value).toBe("safe-default");
  });

  it("validator receives value and can reject", async () => {
    const v = scenv("Port", {
      default: "3000",
      validator: (val) => {
        const n = Number(val);
        return n >= 1 && n <= 65535 ? true : { success: false, error: "bad port" };
      },
    });
    const value = await v.get();
    expect(value).toBe("3000");
    configure({ set: { port: "99999" } });
    const v2 = scenv("Port", {
      key: "port",
      validator: (val) => {
        const n = Number(val);
        return n >= 1 && n <= 65535 ? true : { success: false, error: "bad port" };
      },
    });
    await expect(v2.get()).rejects.toThrow(/Validation failed/);
  });

  it("save() writes to context file", async () => {
    configure({ saveContextTo: "mysave", contexts: ["mysave"] });
    const v = scenv("Saved Key", { key: "saved_key", default: "saved-value" });
    await v.save();
    const ctxPath = join(tmpDir, "mysave.context.json");
    const content = readFileSync(ctxPath, "utf-8");
    const data = JSON.parse(content);
    expect(data.saved_key).toBe("saved-value");
  });

  it("get() uses custom prompt when prompt mode is always", async () => {
    configure({ prompt: "always" });
    const v = scenv("Prompted Var", {
      key: "prompted_var",
      default: "default-val",
      prompt: (name, defaultVal) => {
        expect(name).toBe("Prompted Var");
        expect(defaultVal).toBe("default-val");
        return "from-prompt";
      },
    });
    const value = await v.get();
    expect(value).toBe("from-prompt");
  });

  it("get() uses custom prompt when prompt mode fallback and no value", async () => {
    configure({ prompt: "fallback" });
    const v = scenv("Fallback Var", {
      key: "fallback_var",
      prompt: () => "fallback-typed",
    });
    const value = await v.get();
    expect(value).toBe("fallback-typed");
  });

  it("get() uses callbacks.defaultPrompt when variable has no prompt option", async () => {
    configure({
      prompt: "fallback",
      callbacks: {
        defaultPrompt: async (name, defaultVal) => {
          expect(name).toBe("No Var Prompt");
          expect(defaultVal).toBe("default-from-callback");
          return "from-default-prompt";
        },
      },
    });
    const v = scenv("No Var Prompt", {
      key: "no_var_prompt",
      default: "default-from-callback",
    });
    const value = await v.get();
    expect(value).toBe("from-default-prompt");
  });

  it("get() uses variable prompt (override) over callbacks.defaultPrompt", async () => {
    const defaultPromptCalled: string[] = [];
    configure({
      prompt: "fallback",
      callbacks: {
        defaultPrompt: async (name) => {
          defaultPromptCalled.push(name);
          return "from-callbacks-default";
        },
      },
    });
    const v = scenv("Override Prompt", {
      key: "override_prompt",
      prompt: () => "from-var-override",
    });
    const value = await v.get();
    expect(value).toBe("from-var-override");
    expect(defaultPromptCalled).toEqual([]);
  });

  it("get() prompts when prompt mode fallback and only default exists (no set/env/context)", async () => {
    configure({ prompt: "fallback" });
    const v = scenv("Core Server URL", {
      key: "core_server_url",
      env: "CORE_SERVER_URL",
      default: "http://localhost:3000",
      prompt: () => "prompted-value",
    });
    const value = await v.get();
    expect(value).toBe("prompted-value");
  });

  it("get() does not prompt when prompt mode fallback and value from env", async () => {
    configure({ prompt: "fallback", ignoreEnv: false });
    process.env.CORE_SERVER_URL = "https://env.example.com";
    const v = scenv("Core Server URL", {
      key: "core_server_url",
      env: "CORE_SERVER_URL",
      default: "http://localhost:3000",
      prompt: () => {
        throw new Error("prompt should not be called when value from env");
      },
    });
    const value = await v.get();
    expect(value).toBe("https://env.example.com");
    delete process.env.CORE_SERVER_URL;
  });

  it("get() calls onAskSaveAfterPrompt when prompted and savePrompt is ask", async () => {
    configure({
      prompt: "always",
      savePrompt: "ask",
      contexts: ["ctx1"],
      callbacks: {
        onAskSaveAfterPrompt: async (name, value, contextNames) => {
          expect(name).toBe("Save Me");
          expect(value).toBe("saved-value");
          expect(contextNames).toEqual(["ctx1"]);
          return "savedctx";
        },
      },
    });
    const v = scenv("Save Me", {
      key: "save_me",
      prompt: () => "saved-value",
    });
    const value = await v.get();
    expect(value).toBe("saved-value");
    const ctxPath = join(tmpDir, "savedctx.context.json");
    const content = readFileSync(ctxPath, "utf-8");
    const data = JSON.parse(content);
    expect(data.save_me).toBe("saved-value");
  });

  it("get() does not save when onAskSaveAfterPrompt returns null", async () => {
    configure({
      prompt: "always",
      savePrompt: "ask",
      contexts: ["ctx1"],
      callbacks: {
        onAskSaveAfterPrompt: async () => null,
      },
    });
    const v = scenv("No Save", { key: "no_save", prompt: () => "x" });
    const value = await v.get();
    expect(value).toBe("x");
    const ctxPath = join(tmpDir, "ctx1.context.json");
    expect(() => readFileSync(ctxPath, "utf-8")).toThrow();
  });

  it("save() uses onAskContext when saveContextTo is ask", async () => {
    configure({
      saveContextTo: "ask",
      contexts: ["existing"],
      callbacks: {
        onAskContext: async (name, contextNames) => {
          expect(name).toBe("Ask Context Var");
          expect(contextNames).toEqual(["existing"]);
          return "chosen-ctx";
        },
      },
    });
    const v = scenv("Ask Context Var", {
      key: "ask_context_var",
      default: "val",
    });
    await v.save();
    const ctxPath = join(tmpDir, "chosen-ctx.context.json");
    const content = readFileSync(ctxPath, "utf-8");
    const data = JSON.parse(content);
    expect(data.ask_context_var).toBe("val");
  });

  it("save() uses first context when saveContextTo is ask and no onAskContext", async () => {
    configure({ saveContextTo: "ask", contexts: ["first-ctx"] });
    const v = scenv("No Callback", { key: "no_callback", default: "v" });
    await v.save();
    const ctxPath = join(tmpDir, "first-ctx.context.json");
    const content = readFileSync(ctxPath, "utf-8");
    const data = JSON.parse(content);
    expect(data.no_callback).toBe("v");
  });
});
