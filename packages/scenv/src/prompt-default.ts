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

/**
 * Default "whether to save" callback. Asks "Save '&lt;name&gt;' for next time? (y/n): " via readline.
 * Only used when {@link ScenvConfig.shouldSavePrompt} is "ask". Where to save
 * is determined separately by saveContextTo or onAskContext.
 *
 * @param name - Variable display name.
 * @param _value - The value that was just prompted (unused in default implementation).
 * @returns true to save, false to skip.
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
 * Default "which context to save to" callback. Asks "Save '&lt;name&gt;' to which context? (context1, context2): "
 * via readline. Used when {@link ScenvConfig.saveContextTo} is "ask" (or after prompt when destination is "ask").
 *
 * @param name - Variable display name.
 * @param contextNames - Known context names (from config) shown as a hint.
 * @returns The context name to write to. If empty input, returns first context or "default".
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
