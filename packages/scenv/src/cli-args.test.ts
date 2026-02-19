import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseScenvArgs } from "./cli-args.js";

describe("parseScenvArgs", () => {
  it("parses --root and resolves relative paths", () => {
    const config = parseScenvArgs(["--root", "/tmp/project"]);
    expect(config.root).toBe("/tmp/project");
    const configRel = parseScenvArgs(["--root", "."]);
    expect(configRel.root).toBe(resolve("."));
  });

  it("parses --context", () => {
    const config = parseScenvArgs(["--context", "prod,dev"]);
    expect(config.context).toEqual(["prod", "dev"]);
  });

  it("parses --add-context", () => {
    const config = parseScenvArgs(["--add-context", "staging"]);
    expect(config.addContext).toEqual(["staging"]);
  });

  it("parses --prompt", () => {
    expect(parseScenvArgs(["--prompt", "fallback"]).prompt).toBe("fallback");
    expect(parseScenvArgs(["--prompt", "never"]).prompt).toBe("never");
  });

  it("parses --ignore-env and --ignore-context", () => {
    const config = parseScenvArgs(["--ignore-env", "--ignore-context"]);
    expect(config.ignoreEnv).toBe(true);
    expect(config.ignoreContext).toBe(true);
  });

  it("parses --set key=value", () => {
    const config = parseScenvArgs(["--set", "foo=bar"]);
    expect(config.set).toEqual({ foo: "bar" });
  });

  it("parses multiple --set", () => {
    const config = parseScenvArgs([
      "--set",
      "a=1",
      "--set",
      "b=2",
    ]);
    expect(config.set).toEqual({ a: "1", b: "2" });
  });

  it("parses --set=key=value", () => {
    const config = parseScenvArgs(["--set=core_server_url=localhost:7000"]);
    expect(config.set).toEqual({ core_server_url: "localhost:7000" });
  });

  it("parses --save-context-to", () => {
    const config = parseScenvArgs(["--save-context-to", "prod"]);
    expect(config.saveContextTo).toBe("prod");
  });

  it("parses --save-mode", () => {
    expect(parseScenvArgs(["--save-mode", "all"]).saveMode).toBe("all");
    expect(parseScenvArgs(["--save-mode", "prompts-only"]).saveMode).toBe("prompts-only");
    expect(parseScenvArgs(["--save-mode", "PROMPTS-ONLY"]).saveMode).toBe("prompts-only");
  });

  it("returns empty partial for empty argv", () => {
    const config = parseScenvArgs([]);
    expect(config).toEqual({});
  });

  it("parses --log-level and --log=", () => {
    expect(parseScenvArgs(["--log-level", "debug"]).logLevel).toBe("debug");
    expect(parseScenvArgs(["--log", "info"]).logLevel).toBe("info");
    expect(parseScenvArgs(["--log=warn"]).logLevel).toBe("warn");
    expect(parseScenvArgs(["--log-level", "none"]).logLevel).toBe("none");
  });
});
