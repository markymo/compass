import { z } from "zod";

export const SchemaFieldType = z.enum(["text", "number", "date", "boolean", "select"]);

// Categories structure
export const SchemaCategorySchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    fields: z.array(z.string()).optional(), // original bullet points for reference
});

export const SchemaFieldSchema = z.object({
    id: z.string().uuid(),
    key: z.string().min(1, "Key is required").regex(/^[a-zA-Z0-9_]+$/, "Key must be alphanumeric"),
    label: z.string().min(1, "Label is required"),
    description: z.string().optional(),
    type: SchemaFieldType,
    options: z.array(z.string()).optional(), // Only for 'select'
    required: z.boolean().default(false),

    // Categorization
    categoryId: z.string().optional(), // The accepted category
    proposedCategoryId: z.string().optional(), // The AI proposed category
});

export const MasterSchemaDefinitionSchema = z.object({
    categories: z.array(SchemaCategorySchema).optional(),
    fields: z.array(SchemaFieldSchema),
});

export type SchemaCategory = z.infer<typeof SchemaCategorySchema>;
export type SchemaField = z.infer<typeof SchemaFieldSchema>;
export type MasterSchemaDefinition = z.infer<typeof MasterSchemaDefinitionSchema>;
