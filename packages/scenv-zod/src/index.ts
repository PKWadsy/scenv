import type { z } from "zod";

/**
 * Returns a validator function for use with scenv's `validator` option. Uses Zod's safeParse;
 * on success returns `{ success: true, data }` with the inferred type, on failure
 * `{ success: false, error }` with the Zod error. Values from set/env/context are strings,
 * so use coercion in your schema (e.g. z.coerce.number(), z.coerce.boolean()).
 *
 * @typeParam T - A Zod schema type (e.g. z.ZodNumber, z.ZodString). Inferred output type is z.infer<T>.
 * @param schema - Zod schema to validate (and optionally coerce) the resolved value.
 * @returns A function `(val: unknown) => ValidatorResult<z.infer<T>>` suitable for scenv variable options.
 *
 * @example
 * const port = scenv("Port", { default: 3000, validator: validator(z.coerce.number().min(1).max(65535)) });
 * const n = await port.get(); // number
 */
export function validator<T extends z.ZodTypeAny>(schema: T): (val: unknown) => { success: true; data: z.infer<T> } | { success: false; error: unknown } {
  return (val: unknown) => {
    const result = schema.safeParse(val);
    if (result.success) {
      return { success: true, data: result.data as z.infer<T> };
    }
    return { success: false, error: result.error };
  };
}
