import { describe, it, expect } from "vitest";
import { parseSenvArgs } from "./cli-args.js";

describe("parseSenvArgs", () => {
  it("parses --context", () => {
    const config = parseSenvArgs(["--context", "prod,dev"]);
    expect(config.contexts).toEqual(["prod", "dev"]);
  });

  it("parses --add-context", () => {
    const config = parseSenvArgs(["--add-context", "staging"]);
    expect(config.addContexts).toEqual(["staging"]);
  });

  it("parses --prompt", () => {
    expect(parseSenvArgs(["--prompt", "fallback"]).prompt).toBe("fallback");
    expect(parseSenvArgs(["--prompt", "never"]).prompt).toBe("never");
  });

  it("parses --ignore-env and --ignore-context", () => {
    const config = parseSenvArgs(["--ignore-env", "--ignore-context"]);
    expect(config.ignoreEnv).toBe(true);
    expect(config.ignoreContext).toBe(true);
  });

  it("parses --set key=value", () => {
    const config = parseSenvArgs(["--set", "foo=bar"]);
    expect(config.set).toEqual({ foo: "bar" });
  });

  it("parses multiple --set", () => {
    const config = parseSenvArgs([
      "--set",
      "a=1",
      "--set",
      "b=2",
    ]);
    expect(config.set).toEqual({ a: "1", b: "2" });
  });

  it("parses --set=key=value", () => {
    const config = parseSenvArgs(["--set=core_server_url=localhost:7000"]);
    expect(config.set).toEqual({ core_server_url: "localhost:7000" });
  });

  it("parses --save-prompt and --save-context-to", () => {
    const config = parseSenvArgs([
      "--save-prompt",
      "ask",
      "--save-context-to",
      "prod",
    ]);
    expect(config.savePrompt).toBe("ask");
    expect(config.saveContextTo).toBe("prod");
  });

  it("returns empty partial for empty argv", () => {
    const config = parseSenvArgs([]);
    expect(config).toEqual({});
  });
});
