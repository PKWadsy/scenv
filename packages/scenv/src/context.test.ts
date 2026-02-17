import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { configure, resetConfig } from "./config.js";
import {
  discoverContextPaths,
  getMergedContextValues,
  getContext,
  getContextWritePath,
  writeToContext,
} from "./context.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("context", () => {
  let tmpDir: string;

  beforeEach(() => {
    resetConfig();
    tmpDir = join(tmpdir(), `scenv-ctx-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    configure({ root: tmpDir, contexts: [] });
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {
      // ignore
    }
  });

  it("discoverContextPaths finds *.context.json in dir", () => {
    writeFileSync(join(tmpDir, "prod.context.json"), "{}");
    writeFileSync(join(tmpDir, "dev.context.json"), "{}");
    const paths = discoverContextPaths(tmpDir);
    expect(paths.get("prod")).toBe(join(tmpDir, "prod.context.json"));
    expect(paths.get("dev")).toBe(join(tmpDir, "dev.context.json"));
  });

  it("discoverContextPaths finds context in subdir", () => {
    const sub = join(tmpDir, "sub");
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, "staging.context.json"), "{}");
    const paths = discoverContextPaths(tmpDir);
    expect(paths.get("staging")).toBe(join(sub, "staging.context.json"));
  });

  it("getMergedContextValues returns merged values in context order", () => {
    writeFileSync(
      join(tmpDir, "a.context.json"),
      JSON.stringify({ foo: "from-a", bar: "from-a" })
    );
    writeFileSync(
      join(tmpDir, "b.context.json"),
      JSON.stringify({ bar: "from-b" })
    );
    configure({ root: tmpDir, contexts: ["a", "b"] });
    const values = getMergedContextValues();
    expect(values.foo).toBe("from-a");
    expect(values.bar).toBe("from-b");
  });

  it("getMergedContextValues returns {} when ignoreContext", () => {
    writeFileSync(join(tmpDir, "prod.context.json"), '{"x":"y"}');
    configure({ root: tmpDir, contexts: ["prod"], ignoreContext: true });
    const values = getMergedContextValues();
    expect(values).toEqual({});
  });

  it("writeToContext creates file and getMergedContextValues reads it", () => {
    configure({ root: tmpDir, contexts: ["myctx"] });
    writeToContext("myctx", "api_url", "https://api.example.com");
    const values = getMergedContextValues();
    expect(values.api_url).toBe("https://api.example.com");
  });

  it("getContextWritePath returns path for new context under root", () => {
    const path = getContextWritePath("newcontext");
    expect(path).toBe(join(tmpDir, "newcontext.context.json"));
  });

  it("getMergedContextValues skips context file with invalid JSON", () => {
    writeFileSync(join(tmpDir, "bad.context.json"), "not json");
    writeFileSync(
      join(tmpDir, "good.context.json"),
      JSON.stringify({ key: "value" })
    );
    configure({ root: tmpDir, contexts: ["bad", "good"] });
    const values = getMergedContextValues();
    expect(values.key).toBe("value");
  });

  it("getMergedContextValues only includes string values from context file", () => {
    writeFileSync(
      join(tmpDir, "mixed.context.json"),
      JSON.stringify({
        str: "ok",
        num: 42,
        bool: true,
        null: null,
        arr: ["a"],
        nested: { x: 1 },
      })
    );
    configure({ root: tmpDir, contexts: ["mixed"] });
    const values = getMergedContextValues();
    expect(values).toEqual({ str: "ok" });
  });

  it("discoverContextPaths returns empty when path is not a directory", () => {
    const filePath = join(tmpDir, "file.txt");
    writeFileSync(filePath, "x");
    const paths = discoverContextPaths(filePath);
    expect(paths.size).toBe(0);
  });

  it("getContext returns key-value map for a single context", () => {
    writeFileSync(
      join(tmpDir, "prod.context.json"),
      JSON.stringify({ api_url: "https://api.example.com", port: "443" })
    );
    const values = getContext("prod", tmpDir);
    expect(values.api_url).toBe("https://api.example.com");
    expect(values.port).toBe("443");
  });

  it("getContext returns {} when context not found", () => {
    const values = getContext("nonexistent", tmpDir);
    expect(values).toEqual({});
  });
});
