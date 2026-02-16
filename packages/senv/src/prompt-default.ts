import { createInterface } from "node:readline";

/**
 * Minimal readline-based prompt. Used when config requests prompting but no custom prompt is provided.
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
