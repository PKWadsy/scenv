import inquirer from "inquirer";

/**
 * Returns a prompt function for use with senv(): (name, defaultValue) => Promise<T>.
 * Senv passes the variable name and default (from env/context/default); this uses inquirer to ask for input.
 * Returns string; use a validator (e.g. senv-zod) for type/coercion.
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
