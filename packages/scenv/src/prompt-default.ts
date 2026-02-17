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
 * Default "save after prompt" callback: asks whether to save and which context.
 * Used when savePrompt is ask/always and no onAskSaveAfterPrompt is configured.
 */
export async function defaultAskSaveAfterPrompt(
  name: string,
  _value: unknown,
  contextNames: string[]
): Promise<string | null> {
  const hint = contextNames.length > 0
    ? ` (${contextNames.join(", ")} or n to skip)`
    : " (context name or n to skip)";
  const answer = await ask(`Save "${name}" for next time?${hint}: `);
  if (!answer || answer.toLowerCase() === "n" || answer.toLowerCase() === "no") {
    return null;
  }
  return answer;
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
