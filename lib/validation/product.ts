import { z } from "zod";

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, "Required").max(80),
  url: z
    .string()
    .trim()
    .min(1, "Required")
    .url("Must be a valid URL (include https://)")
    .refine((u) => /^https?:/i.test(u), "Only http/https URLs are allowed"),
  logoUrl: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = productCreateSchema.partial();
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
