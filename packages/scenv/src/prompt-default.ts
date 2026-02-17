import { createInterface } from "node:readline";

function ask(message: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve, reject) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
    rl.on("error", (err) => {
      rl.close();
      reject(err);
    });
  });
}

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

/**
 * Default "whether to save" callback: asks yes/no. Only used when shouldSavePrompt is "ask" or "always".
 * Where to save is handled separately by onAskContext when ambiguous.
 */
export async function defaultAskWhetherToSave(
  name: string,
  _value: unknown
): Promise<boolean> {
  const answer = await ask(`Save "${name}" for next time? (y/n): `);
  const v = answer.toLowerCase();
  return v === "y" || v === "yes" || v === "1" || v === "true";
}

/**
 * Default "which context to save to" callback: asks for a context name.
 * Used when saveContextTo is "ask" and no onAskContext is configured.
 */
export async function defaultAskContext(
  name: string,
  contextNames: string[]
): Promise<string> {
  const hint = contextNames.length > 0
    ? ` (${contextNames.join(", ")})`
    : "";
  const answer = await ask(`Save "${name}" to which context?${hint}: `);
  if (answer) return answer;
  return contextNames[0] ?? "default";
}
