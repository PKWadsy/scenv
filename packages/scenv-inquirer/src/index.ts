import inquirer from "inquirer";

/**
 * Returns a prompt function for use with scenv(): (name, defaultValue) => Promise<T>.
 * Scenv passes the variable name and default (from env/context/default); this uses inquirer to ask for input.
 * Returns string; use a validator (e.g. scenv-zod) for type/coercion.
 */
export function prompt<T = string>(): (
  name: string,
  defaultValue: T
) => Promise<T> {
  return async (name: string, defaultValue: T): Promise<T> => {
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
  };
}

/**
 * Returns a function suitable for scenv's onAskSaveAfterPrompt callback.
 * Asks "Save '{name}' for next time?" and, if yes, "Which context?" (from contextNames or new).
 * @returns Context name to save to, or null to skip saving
 */
export function askSaveAfterPrompt(): (
  name: string,
  value: unknown,
  contextNames: string[]
) => Promise<string | null> {
  return async (
    name: string,
    _value: unknown,
    contextNames: string[]
  ): Promise<string | null> => {
    const { save } = await inquirer.prompt<{ save: boolean }>([
      {
        type: "confirm",
        name: "save",
        message: `Save "${name}" for next time?`,
        default: true,
      },
    ]);
    if (!save) return null;
    const choices = [...contextNames];
    if (choices.length === 0) choices.push("default");
    choices.push("(new context)");
    const { context } = await inquirer.prompt<{ context: string }>([
      {
        type: "list",
        name: "context",
        message: "Which context?",
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
 * Returns a function suitable for scenv's onAskContext callback.
 * Asks user to choose a context from contextNames or enter a new one.
 */
export function askContext(): (
  name: string,
  contextNames: string[]
) => Promise<string> {
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
 * Returns an object suitable for scenv's configure(): { callbacks: { onAskSaveAfterPrompt, onAskContext } }.
 * Use as configure(callbacks()) or configure({ ...config, ...callbacks() }) to wire both save-after-prompt and ask-context via inquirer.
 */
export function callbacks(): {
  callbacks: {
    onAskSaveAfterPrompt: ReturnType<typeof askSaveAfterPrompt>;
    onAskContext: ReturnType<typeof askContext>;
  };
} {
  return {
    callbacks: {
      onAskSaveAfterPrompt: askSaveAfterPrompt(),
      onAskContext: askContext(),
    },
  };
}
