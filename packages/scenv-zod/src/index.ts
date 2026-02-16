import type { z } from "zod";

/**
 * Returns a validator function for use with scenv(), using a Zod schema.
 * Values from env/context/--set are strings; the schema can coerce (e.g. z.coerce.number()).
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
