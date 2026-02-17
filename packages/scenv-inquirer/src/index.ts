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
 * Returns a function suitable for scenv's {@link ScenvCallbacks.onAskWhetherToSave} callback.
 * Uses inquirer confirm to ask "Save '{name}' for next time?" (y/n). Where to save is
 * determined by config.saveContextTo or the onAskContext callback when saveContextTo is "ask".
 * Only called when {@link ScenvConfig.shouldSavePrompt} is "ask" and the user was just prompted. ("always" saves without asking.)
 *
 * @returns A function `(name, value) => Promise<boolean>`: true to save, false to skip.
 */
export function askWhetherToSave(): NonNullable<ScenvCallbacks["onAskWhetherToSave"]> {
  return async (name: string, _value: unknown): Promise<boolean> => {
    const { save } = await inquirer.prompt<{ save: boolean }>([
      {
        type: "confirm",
        name: "save",
        message: `Save "${name}" for next time?`,
        default: true,
      },
    ]);
    return save;
  };
}

/**
 * Returns a function suitable for scenv's {@link ScenvCallbacks.onAskContext} callback.
 * Uses inquirer list to choose a context from contextNames, with a "(new context)" option
 * that prompts for a new name. Used when {@link ScenvConfig.saveContextTo} is "ask" or
 * when saving after a prompt and the destination is "ask".
 *
 * @returns A function `(name, contextNames) => Promise<string>` that returns the chosen context name.
 */
export function askContext(): NonNullable<ScenvCallbacks["onAskContext"]> {
  return async (name: string, contextNames: string[]): Promise<string> => {
    const choices = [...contextNames];
    if (choices.length === 0) choices.push("default");
    choices.push("(new context)");
    const { context } = await inquirer.prompt<{ context: string }>([
      {
        type: "list",
        name: "context",
        message: `Save "${name}" to which context?`,
        choices,
      },
    ]);
    if (context === "(new context)") {
      const { newContext } = await inquirer.prompt<{ newContext: string }>([
        { type: "input", name: "newContext", message: "Context name:", default: "default" },
      ]);
      return newContext.trim() || "default";
    }
    return context;
  };
}

/**
 * Returns an object with all inquirer-based callbacks for scenv. Pass to {@link configure}
 * to use inquirer for variable prompts, "save for next time?", and "which context?".
 * Variable-level `prompt` overrides defaultPrompt.
 *
 * @returns `{ callbacks: { defaultPrompt, onAskWhetherToSave, onAskContext } }` – spread into configure() or merge with other config.
 *
 * @example
 * import { configure } from "scenv";
 * import { callbacks } from "scenv-inquirer";
 * configure(callbacks());
 * // or: configure({ ...parseScenvArgs(process.argv.slice(2)), ...callbacks() });
 */
export function callbacks(): { callbacks: ScenvCallbacks } {
  const cbs: ScenvCallbacks = {
    defaultPrompt: prompt(),
    onAskWhetherToSave: askWhetherToSave(),
    onAskContext: askContext(),
  };
  return { callbacks: cbs };
}
