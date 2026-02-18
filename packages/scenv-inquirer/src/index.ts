import inquirer from "inquirer";
import type { ScenvCallbacks, DefaultPromptFn } from "scenv";

/**
 * Returns an inquirer-based prompt function for use with scenv variables. Use as the
 * variable's `prompt` option or as `callbacks.defaultPrompt`. Scenv calls it with the
 * variable name and default value when prompting; this shows an inquirer input prompt.
 * Returned value is a string; use a validator (e.g. scenv-zod) for type coercion.
 *
 * @typeParam T - Value type (default string). Cast or validate in your validator.
 * @returns A function `(name, defaultValue) => Promise<T>` suitable for scenv's prompt or defaultPrompt.
 *
 * @example
 * const apiUrl = scenv("API URL", { default: "http://localhost:4000", prompt: prompt() });
 * const url = await apiUrl.get(); // prompts via inquirer if no env/context
 */
export function prompt<T = string>(): DefaultPromptFn {
  return (async (name: string, defaultValue: T): Promise<T> => {
    const defaultStr =
      defaultValue !== undefined && defaultValue !== null
        ? String(defaultValue)
        : "";
    const { value } = await inquirer.prompt<{ value: string }>([
      {
        type: "input",
        name: "value",
        message: name,
        default: defaultStr,
      },
    ]);
    return value as unknown as T;
  }) as DefaultPromptFn;
}

/**
 * Returns an object with the defaultPrompt callback for scenv. Pass to {@link configure}
 * to use inquirer for variable prompts. Variable-level `prompt` overrides defaultPrompt.
 *
 * @returns `{ callbacks: { defaultPrompt } }` – spread into configure() or merge with other config.
 *
 * @example
 * import { configure } from "scenv";
 * import { callbacks } from "scenv-inquirer";
 * configure(callbacks());
 * // or: configure({ ...parseScenvArgs(process.argv.slice(2)), ...callbacks() });
 */
export function callbacks(): { callbacks: ScenvCallbacks } {
  return { callbacks: { defaultPrompt: prompt() } };
}
