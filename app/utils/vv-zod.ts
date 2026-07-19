import type { TypedSchema, TypedSchemaError } from "vee-validate";
import type { z } from "zod";

/**
 * Adapter Zod 4 → TypedSchema vee-validate. Paket resmi @vee-validate/zod
 * masih terkunci di peer zod ^3, sedangkan repo ini (dan shared) memakai
 * Zod 4 — adapter lokal ~25 baris ini setara fungsinya: path error
 * dot-notation persis pemetaan fieldErrors kontrak §1.4.
 */
export function zodTypedSchema<TSchema extends z.ZodType>(
  schema: TSchema,
): TypedSchema<z.input<TSchema>, z.output<TSchema>> {
  return {
    __type: "VVTypedSchema",
    async parse(values) {
      const result = await schema.safeParseAsync(values);
      if (result.success) {
        return { value: result.data, errors: [] };
      }
      const byPath = new Map<string, string[]>();
      for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        const list = byPath.get(path) ?? [];
        list.push(issue.message);
        byPath.set(path, list);
      }
      const errors: TypedSchemaError[] = [...byPath].map(([path, messages]) => ({
        path,
        errors: messages,
      }));
      return { errors };
    },
  };
}
