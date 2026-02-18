import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { configure, resetConfig } from "./config.js";
import { resetInMemoryContext } from "./context.js";
import { scenv } from "./variable.js";
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("variable", () => {
  let tmpDir: string;

  beforeEach(() => {
    resetConfig();
    resetInMemoryContext();
    tmpDir = join(tmpdir(), `scenv-var-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    configure({
      root: tmpDir,
      context: [],
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
    configure({ ignoreContext: false, context: ["prod"] });
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
    configure({ saveContextTo: "mysave", context: ["mysave"] });
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

  it("get() saves prompted value to saveContextTo and in-memory when saveContextTo is set", async () => {
    configure({
      prompt: "always",
      saveContextTo: "always-ctx",
      context: ["always-ctx"],
    });
    const v = scenv("Always Save", { key: "always_save", prompt: () => "auto-saved" });
    const value = await v.get();
    expect(value).toBe("auto-saved");
    const ctxPath = join(tmpDir, "always-ctx.context.json");
    const content = readFileSync(ctxPath, "utf-8");
    const data = JSON.parse(content);
    expect(data.always_save).toBe("auto-saved");
  });

  it("get() on same variable twice does not prompt twice (in-memory used)", async () => {
    configure({ prompt: "fallback", ignoreContext: true });
    let promptCount = 0;
    const v = scenv("Once", {
      key: "once_key",
      prompt: () => {
        promptCount++;
        return "prompted-value";
      },
    });
    const a = await v.get();
    const b = await v.get();
    expect(a).toBe("prompted-value");
    expect(b).toBe("prompted-value");
    expect(promptCount).toBe(1);
  });

  it("get() on same variable twice uses saveContextTo file when set (no double prompt)", async () => {
    configure({
      prompt: "fallback",
      ignoreContext: false,
      saveContextTo: "persist",
      context: ["persist"],
    });
    let promptCount = 0;
    const v = scenv("Persist Var", {
      key: "persist_var",
      prompt: () => {
        promptCount++;
        return "from-prompt";
      },
    });
    const first = await v.get();
    expect(first).toBe("from-prompt");
    expect(promptCount).toBe(1);
    const second = await v.get();
    expect(second).toBe("from-prompt");
    expect(promptCount).toBe(1);
    const ctxPath = join(tmpDir, "persist.context.json");
    const data = JSON.parse(readFileSync(ctxPath, "utf-8"));
    expect(data.persist_var).toBe("from-prompt");
  });

  it("saveContextTo as file path (without .context.json) writes to that path", async () => {
    const customPath = join(tmpDir, "custom-save");
    configure({ saveContextTo: customPath, context: [] });
    const v = scenv("Path Var", { key: "path_var", default: "path-value" });
    await v.save();
    const content = readFileSync(customPath + ".context.json", "utf-8");
    const data = JSON.parse(content);
    expect(data.path_var).toBe("path-value");
  });

  it("save() without saveContextTo only updates in-memory (no file)", async () => {
    configure({ context: [], ignoreContext: true });
    const v = scenv("Memory Only", { key: "mem_key", default: "mem-value" });
    await v.save();
    const ctxPath = join(tmpDir, "default.context.json");
    expect(() => readFileSync(ctxPath, "utf-8")).toThrow();
    const again = await v.get();
    expect(again).toBe("mem-value");
  });

  it("get() uses config applied after variable is created", async () => {
    const v = scenv("Late Config", { key: "late_config", default: "variable-default" });
    // No config override yet; get() uses variable default
    expect(await v.get()).toBe("variable-default");
    // Configure after variable creation; next get() uses set override
    configure({ set: { late_config: "from-set" } });
    expect(await v.get()).toBe("from-set");
    configure({ set: {} });
    expect(await v.get()).toBe("variable-default");
  });

  it("save() uses saveContextTo when set to a context name", async () => {
    configure({ saveContextTo: "first-ctx", context: ["first-ctx"] });
    const v = scenv("No Callback", { key: "no_callback", default: "v" });
    await v.save();
    const ctxPath = join(tmpDir, "first-ctx.context.json");
    const content = readFileSync(ctxPath, "utf-8");
    const data = JSON.parse(content);
    expect(data.no_callback).toBe("v");
  });

  describe("@context:key resolution", () => {
    it("resolves @prod:key from set override", async () => {
      writeFileSync(
        join(tmpDir, "prod.context.json"),
        JSON.stringify({ core_server_url: "https://prod.example.com" })
      );
      configure({
        set: { api_url: "@prod:core_server_url" },
        root: tmpDir,
      });
      const v = scenv("API URL", { key: "api_url", default: "http://localhost" });
      const value = await v.get();
      expect(value).toBe("https://prod.example.com");
    });

    it("resolves @context:key from env", async () => {
      writeFileSync(
        join(tmpDir, "prod.context.json"),
        JSON.stringify({ core_server_url: "https://env-prod.example.com" })
      );
      configure({
        ignoreEnv: false,
        root: tmpDir,
      });
      process.env.API_URL = "@prod:core_server_url";
      const v = scenv("API URL", { key: "api_url", default: "http://localhost" });
      const value = await v.get();
      expect(value).toBe("https://env-prod.example.com");
      delete process.env.API_URL;
    });

    it("resolves @context:key from merged context value", async () => {
      writeFileSync(
        join(tmpDir, "prod.context.json"),
        JSON.stringify({ base_url: "https://prod.example.com" })
      );
      writeFileSync(
        join(tmpDir, "dev.context.json"),
        JSON.stringify({ api_url: "@prod:base_url" })
      );
      configure({
        ignoreContext: false,
        context: ["dev"],
        root: tmpDir,
      });
      const v = scenv("API URL", { key: "api_url", default: "http://localhost" });
      const value = await v.get();
      expect(value).toBe("https://prod.example.com");
    });

    it("resolves @context:key from default option", async () => {
      writeFileSync(
        join(tmpDir, "prod.context.json"),
        JSON.stringify({ core_server_url: "https://default-prod.example.com" })
      );
      configure({ root: tmpDir });
      const v = scenv("API URL", {
        key: "api_url",
        default: "@prod:core_server_url",
      });
      const value = await v.get();
      expect(value).toBe("https://default-prod.example.com");
    });

    it("resolves @context:key from prompt return value", async () => {
      writeFileSync(
        join(tmpDir, "prod.context.json"),
        JSON.stringify({ core_server_url: "https://prompt-prod.example.com" })
      );
      configure({
        prompt: "always",
        root: tmpDir,
      });
      const v = scenv("API URL", {
        key: "api_url",
        default: "http://localhost",
        prompt: () => "@prod:core_server_url",
      });
      const value = await v.get();
      expect(value).toBe("https://prompt-prod.example.com");
    });

    it("throws when @context:key key not in context", async () => {
      writeFileSync(join(tmpDir, "prod.context.json"), JSON.stringify({ other_key: "x" }));
      configure({ set: { api_url: "@prod:missing_key" }, root: tmpDir });
      const v = scenv("API URL", { key: "api_url" });
      await expect(v.get()).rejects.toThrow(/key "missing_key" is not defined in context "prod"/);
    });

    it("throws when @context:key context not found", async () => {
      configure({ set: { api_url: "@nonexistent:some_key" }, root: tmpDir });
      const v = scenv("API URL", { key: "api_url" });
      await expect(v.get()).rejects.toThrow(/context "nonexistent" not found/);
    });

    it("resolves recursive @context:key", async () => {
      writeFileSync(
        join(tmpDir, "staging.context.json"),
        JSON.stringify({ final_url: "https://final.example.com" })
      );
      writeFileSync(
        join(tmpDir, "prod.context.json"),
        JSON.stringify({ api_url: "@staging:final_url" })
      );
      configure({ set: { api_url: "@prod:api_url" }, root: tmpDir });
      const v = scenv("API URL", { key: "api_url" });
      const value = await v.get();
      expect(value).toBe("https://final.example.com");
    });

    it("resolves @context (short form) using variable key", async () => {
      writeFileSync(
        join(tmpDir, "prod.context.json"),
        JSON.stringify({ url: "https://prod.example.com" })
      );
      configure({ set: { url: "@prod" }, root: tmpDir });
      const v = scenv("URL", { key: "url" });
      const value = await v.get();
      expect(value).toBe("https://prod.example.com");
    });

    it("resolves @prod:core_url explicitly when key differs from variable key", async () => {
      writeFileSync(
        join(tmpDir, "prod.context.json"),
        JSON.stringify({ core_url: "https://core.example.com", url: "https://other.example.com" })
      );
      configure({ set: { url: "@prod:core_url" }, root: tmpDir });
      const v = scenv("URL", { key: "url" });
      const value = await v.get();
      expect(value).toBe("https://core.example.com");
    });

    it("resolves @context short form from env and context", async () => {
      writeFileSync(
        join(tmpDir, "prod.context.json"),
        JSON.stringify({ api_url: "https://from-prod.example.com" })
      );
      writeFileSync(join(tmpDir, "dev.context.json"), JSON.stringify({ api_url: "@prod" }));
      configure({ ignoreContext: false, context: ["dev"], root: tmpDir });
      const v = scenv("API URL", { key: "api_url" });
      const value = await v.get();
      expect(value).toBe("https://from-prod.example.com");
    });

    it("throws when @context short form but key not in context", async () => {
      writeFileSync(join(tmpDir, "prod.context.json"), JSON.stringify({ other_key: "x" }));
      configure({ set: { api_url: "@prod" }, root: tmpDir });
      const v = scenv("API URL", { key: "api_url" });
      await expect(v.get()).rejects.toThrow(/key "api_url" is not defined in context "prod"/);
    });
  });

  describe("$ env var resolution", () => {
    it("resolves $VAR from set override", async () => {
      process.env.SOME_URL = "https://from-env.example.com";
      configure({ set: { url: "$SOME_URL" }, root: tmpDir });
      const v = scenv("URL", { key: "url" });
      const value = await v.get();
      expect(value).toBe("https://from-env.example.com");
      delete process.env.SOME_URL;
    });

    it("resolves $VAR from default", async () => {
      process.env.DEFAULT_HOST = "api.example.com";
      configure({ root: tmpDir });
      const v = scenv("Host", { key: "host", default: "$DEFAULT_HOST" });
      const value = await v.get();
      expect(value).toBe("api.example.com");
      delete process.env.DEFAULT_HOST;
    });

    it("resolves ${VAR} brace syntax", async () => {
      process.env.BRACED_VAR = "brace-value";
      configure({ set: { key: "${BRACED_VAR}" }, root: tmpDir });
      const v = scenv("Key", { key: "key" });
      const value = await v.get();
      expect(value).toBe("brace-value");
      delete process.env.BRACED_VAR;
    });

    it("unset $VAR becomes empty string", async () => {
      configure({ set: { url: "$UNSET_VAR" }, root: tmpDir });
      const v = scenv("URL", { key: "url" });
      const value = await v.get();
      expect(value).toBe("");
    });

    it("resolves $VAR then @context when env holds a context ref", async () => {
      process.env.REF = "@prod:api_url";
      writeFileSync(
        join(tmpDir, "prod.context.json"),
        JSON.stringify({ api_url: "https://chained.example.com" })
      );
      configure({ set: { url: "$REF" }, root: tmpDir });
      const v = scenv("URL", { key: "url" });
      const value = await v.get();
      expect(value).toBe("https://chained.example.com");
      delete process.env.REF;
    });

    it("expands multiple $ refs in one value", async () => {
      process.env.HOST = "api.example.com";
      process.env.PORT = "443";
      configure({ set: { url: "https://$HOST:$PORT" }, root: tmpDir });
      const v = scenv("URL", { key: "url" });
      const value = await v.get();
      expect(value).toBe("https://api.example.com:443");
      delete process.env.HOST;
      delete process.env.PORT;
    });
  });
});
