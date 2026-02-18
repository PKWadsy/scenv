import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, configure, resetConfig, getCallbacks } from "./config.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("config", () => {
  let tmpDir: string;
  const origEnv = process.env;

  beforeEach(() => {
    resetConfig();
    tmpDir = join(tmpdir(), `scenv-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    process.env = { ...origEnv };
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {
      // ignore
    }
    process.env = origEnv;
  });

  it("loadConfig returns root and defaults when no file", () => {
    const config = loadConfig(tmpDir);
    expect(config.root).toBe(tmpDir);
    expect(config.context).toEqual([]);
    expect(config.prompt).toBeUndefined();
  });

  it("loadConfig reads scenv.config.json", () => {
    writeFileSync(
      join(tmpDir, "scenv.config.json"),
      JSON.stringify({
        context: ["prod"],
        prompt: "fallback",
        ignoreEnv: true,
      })
    );
    const config = loadConfig(tmpDir);
    expect(config.context).toEqual(["prod"]);
    expect(config.prompt).toBe("fallback");
    expect(config.ignoreEnv).toBe(true);
  });

  it("configure merges programmatic config with precedence over file", () => {
    writeFileSync(
      join(tmpDir, "scenv.config.json"),
      JSON.stringify({ context: ["file"], prompt: "never" })
    );
    configure({ prompt: "always", root: tmpDir });
    const config = loadConfig(tmpDir);
    expect(config.prompt).toBe("always");
    expect(config.context).toEqual(["file"]);
  });

  it("context replace: programmatic context wins", () => {
    writeFileSync(
      join(tmpDir, "scenv.config.json"),
      JSON.stringify({ context: ["file"] })
    );
    configure({ context: ["prog"], root: tmpDir });
    const config = loadConfig(tmpDir);
    expect(config.context).toEqual(["prog"]);
  });

  it("addContext merges with file context", () => {
    writeFileSync(
      join(tmpDir, "scenv.config.json"),
      JSON.stringify({ context: ["file-a"] })
    );
    configure({ addContext: ["prog-b"], root: tmpDir });
    const config = loadConfig(tmpDir);
    expect(config.context).toContain("file-a");
    expect(config.context).toContain("prog-b");
  });

  it("env SCENV_PROMPT and SCENV_IGNORE_ENV overlay file", () => {
    writeFileSync(
      join(tmpDir, "scenv.config.json"),
      JSON.stringify({ prompt: "never" })
    );
    process.env.SCENV_PROMPT = "always";
    process.env.SCENV_IGNORE_ENV = "1";
    const config = loadConfig(tmpDir);
    expect(config.prompt).toBe("always");
    expect(config.ignoreEnv).toBe(true);
    delete process.env.SCENV_PROMPT;
    delete process.env.SCENV_IGNORE_ENV;
  });

  it("loadConfig reads contextDir from file and env", () => {
    writeFileSync(
      join(tmpDir, "scenv.config.json"),
      JSON.stringify({ contextDir: "envs" })
    );
    const config = loadConfig(tmpDir);
    expect(config.contextDir).toBe("envs");
    process.env.SCENV_CONTEXT_DIR = "custom-dir";
    const config2 = loadConfig(tmpDir);
    expect(config2.contextDir).toBe("custom-dir");
    delete process.env.SCENV_CONTEXT_DIR;
  });

  it("resetConfig clears programmatic config", () => {
    configure({ prompt: "always", root: tmpDir });
    resetConfig();
    const config = loadConfig(tmpDir);
    expect(config.prompt).toBeUndefined();
  });

  it("loadConfigFile returns {} for invalid JSON", () => {
    writeFileSync(join(tmpDir, "scenv.config.json"), "not valid json {");
    const config = loadConfig(tmpDir);
    expect(config.context).toEqual([]);
    expect(config.prompt).toBeUndefined();
  });

  it("env SCENV_IGNORE_ENV=yes is coerced to true", () => {
    process.env.SCENV_IGNORE_ENV = "yes";
    const config = loadConfig(tmpDir);
    expect(config.ignoreEnv).toBe(true);
    delete process.env.SCENV_IGNORE_ENV;
  });

  it("env SCENV_SAVE_PROMPT=ask and SCENV_PROMPT=no-env", () => {
    process.env.SCENV_SAVE_PROMPT = "ask";
    process.env.SCENV_PROMPT = "no-env";
    const config = loadConfig(tmpDir);
    expect(config.shouldSavePrompt).toBe("ask");
    expect(config.prompt).toBe("no-env");
    delete process.env.SCENV_SAVE_PROMPT;
    delete process.env.SCENV_PROMPT;
  });

  it("getCallbacks() returns default callbacks when none configured", () => {
    resetConfig();
    const cb = getCallbacks();
    expect(typeof cb.defaultPrompt).toBe("function");
    expect(typeof cb.onAskWhetherToSave).toBe("function");
    expect(typeof cb.onAskContext).toBe("function");
  });

  it("configure with callbacks merges callbacks", () => {
    const askContext = async () => "ctx";
    configure({ root: tmpDir, callbacks: { onAskContext: askContext } });
    const cb = getCallbacks();
    expect(cb.onAskContext).toBe(askContext);
    resetConfig();
  });

  it("configure with callbacks merges defaultPrompt", () => {
    const defaultPrompt = async (name: string) => name;
    configure({ root: tmpDir, callbacks: { defaultPrompt } });
    const cb = getCallbacks();
    expect(cb.defaultPrompt).toBe(defaultPrompt);
    resetConfig();
  });

  it("loadConfig reads logLevel from file", () => {
    writeFileSync(
      join(tmpDir, "scenv.config.json"),
      JSON.stringify({ logLevel: "debug" })
    );
    const config = loadConfig(tmpDir);
    expect(config.logLevel).toBe("debug");
  });

  it("env SCENV_LOG_LEVEL overlays file", () => {
    writeFileSync(
      join(tmpDir, "scenv.config.json"),
      JSON.stringify({ logLevel: "info" })
    );
    process.env.SCENV_LOG_LEVEL = "warn";
    const config = loadConfig(tmpDir);
    expect(config.logLevel).toBe("warn");
    delete process.env.SCENV_LOG_LEVEL;
  });

  it("configure logLevel has precedence over env", () => {
    process.env.SCENV_LOG_LEVEL = "error";
    configure({ logLevel: "trace", root: tmpDir });
    const config = loadConfig(tmpDir);
    expect(config.logLevel).toBe("trace");
    delete process.env.SCENV_LOG_LEVEL;
    resetConfig();
  });

  it("logLevel none is valid", () => {
    writeFileSync(
      join(tmpDir, "scenv.config.json"),
      JSON.stringify({ logLevel: "none" })
    );
    const config = loadConfig(tmpDir);
    expect(config.logLevel).toBe("none");
  });
});
