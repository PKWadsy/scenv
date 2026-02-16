import { describe, it, expect } from "vitest";
import { parseScenvArgs } from "./cli-args.js";

describe("parseScenvArgs", () => {
  it("parses --context", () => {
    const config = parseScenvArgs(["--context", "prod,dev"]);
    expect(config.contexts).toEqual(["prod", "dev"]);
  });

  it("parses --add-context", () => {
    const config = parseScenvArgs(["--add-context", "staging"]);
    expect(config.addContexts).toEqual(["staging"]);
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

  it("parses --save-prompt and --save-context-to", () => {
    const config = parseScenvArgs([
      "--save-prompt",
      "ask",
      "--save-context-to",
      "prod",
    ]);
    expect(config.savePrompt).toBe("ask");
    expect(config.saveContextTo).toBe("prod");
  });

  it("returns empty partial for empty argv", () => {
    const config = parseScenvArgs([]);
    expect(config).toEqual({});
  });
});
