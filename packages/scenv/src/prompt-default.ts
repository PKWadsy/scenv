import { createInterface } from "node:readline";

/**
 * Minimal readline-based prompt. Used as the default when config requests prompting and no
 * custom prompt or callbacks.defaultPrompt is provided. Asks "Enter &lt;name&gt; [&lt;default&gt;]: "
 * on stdin; empty input returns the default. Exported for use by config default callbacks.
 *
 * @param name - Variable display name (shown in the prompt).
 * @param defaultValue - Default value (shown in brackets; used when user enters nothing).
 * @returns The entered value or the default.
 */
export function defaultPrompt<T>(
  name: string,
  defaultValue: T
): Promise<T> {
  const defaultStr = defaultValue !== undefined && defaultValue !== null
    ? String(defaultValue)
    : "";
  const message = defaultStr
    ? `Enter ${name} [${defaultStr}]: `
    : `Enter ${name}: `;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve, reject) => {
    rl.question(message, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      const value = trimmed !== "" ? trimmed : defaultStr;
      resolve(value as unknown as T);
    });
    rl.on("error", (err) => {
      rl.close();
      reject(err);
    });
  });
}
