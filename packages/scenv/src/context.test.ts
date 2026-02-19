import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { configure, resetConfig } from "./config.js";
import {
  discoverContextPaths,
  getMergedContextValues,
  getContext,
  getContextWritePath,
  writeToContext,
  getInMemoryContext,
  setInMemoryContext,
  resetInMemoryContext,
  getContextAtPath,
  resolveSaveContextPath,
} from "./context.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("context", () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    resetConfig();
    origCwd = process.cwd();
    tmpDir = join(tmpdir(), `scenv-ctx-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);
    configure({ root: tmpDir, context: [] });
  });

  afterEach(() => {
    try {
      process.chdir(origCwd);
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
    configure({ root: tmpDir, context: ["a", "b"] });
    const values = getMergedContextValues();
    expect(values.foo).toBe("from-a");
    expect(values.bar).toBe("from-b");
  });

  it("getMergedContextValues returns {} when ignoreContext", () => {
    writeFileSync(join(tmpDir, "prod.context.json"), '{"x":"y"}');
    configure({ root: tmpDir, context: ["prod"], ignoreContext: true });
    const values = getMergedContextValues();
    expect(values).toEqual({});
  });

  it("writeToContext creates file and getMergedContextValues reads it", () => {
    configure({ root: tmpDir, context: ["myctx"] });
    writeToContext("myctx", "api_url", "https://api.example.com");
    const values = getMergedContextValues();
    expect(values.api_url).toBe("https://api.example.com");
  });

  it("getContextWritePath returns path for new context under project root", () => {
    const path = getContextWritePath("newcontext");
    expect(path).toBe(join(tmpDir, "newcontext.context.json"));
  });

  it("getContextWritePath uses existing discovered path when context is under cwd", () => {
    const sub = join(tmpDir, "existing");
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, "myctx.context.json"), "{}");
    configure({ root: tmpDir });
    const path = getContextWritePath("myctx");
    expect(path).toContain("existing");
    expect(path).toContain("myctx.context.json");
    expect(path.endsWith("existing/myctx.context.json") || path.endsWith(join("existing", "myctx.context.json"))).toBe(true);
  });

  it("getMergedContextValues skips context file with invalid JSON", () => {
    writeFileSync(join(tmpDir, "bad.context.json"), "not json");
    writeFileSync(
      join(tmpDir, "good.context.json"),
      JSON.stringify({ key: "value" })
    );
    configure({ root: tmpDir, context: ["bad", "good"] });
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
    configure({ root: tmpDir, context: ["mixed"] });
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

  it("getContext falls back to project root when not found under cwd", () => {
    const projectRoot = join(tmpDir, "project");
    const subdir = join(projectRoot, "sub");
    mkdirSync(subdir, { recursive: true });
    writeFileSync(
      join(projectRoot, "blah.context.json"),
      JSON.stringify({ api_url: "https://api.blah.com" })
    );
    configure({ root: projectRoot });
    process.chdir(subdir);
    const values = getContext("blah");
    process.chdir(origCwd);
    expect(values.api_url).toBe("https://api.blah.com");
  });

  it("getInMemoryContext and setInMemoryContext and resetInMemoryContext", () => {
    expect(getInMemoryContext()).toEqual({});
    setInMemoryContext("k1", "v1");
    expect(getInMemoryContext().k1).toBe("v1");
    setInMemoryContext("k2", "v2");
    expect(getInMemoryContext().k2).toBe("v2");
    resetInMemoryContext();
    expect(getInMemoryContext()).toEqual({});
  });

  it("getMergedContextValues uses only context list, not saveContextTo", () => {
    const savePath = join(tmpDir, "save-ctx.context.json");
    writeFileSync(savePath, JSON.stringify({ from_save: "saved-value" }));
    configure({ root: tmpDir, context: ["a"], saveContextTo: join(tmpDir, "save-ctx") });
    writeFileSync(
      join(tmpDir, "a.context.json"),
      JSON.stringify({ from_save: "from-a", other: "from-a" })
    );
    const values = getMergedContextValues();
    expect(values.from_save).toBe("from-a");
    expect(values.other).toBe("from-a");
    resetConfig();
    configure({ root: tmpDir, context: [], saveContextTo: join(tmpDir, "save-ctx") });
    const values2 = getMergedContextValues();
    expect(values2.from_save).toBeUndefined();
    expect(values2).toEqual({});
    resetConfig();
  });

  it("getContextWritePath with path-like returns path with suffix", () => {
    const pathLike = join(tmpDir, "mydir", "myfile");
    const p = getContextWritePath(pathLike);
    expect(p).toBe(pathLike + ".context.json");
  });

  it("getContextAtPath loads from file", () => {
    const fp = join(tmpDir, "at-path.context.json");
    writeFileSync(fp, JSON.stringify({ x: "y" }));
    const values = getContextAtPath(fp);
    expect(values.x).toBe("y");
  });

  it("resolveSaveContextPath with path-like appends suffix", () => {
    const pathLike = join(tmpDir, "resolved");
    expect(resolveSaveContextPath(pathLike)).toBe(pathLike + ".context.json");
  });
});
