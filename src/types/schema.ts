import { z } from "zod";

export const SchemaFieldType = z.enum(["text", "number", "date", "boolean", "select"]);

export const SchemaFieldSchema = z.object({
    id: z.string().uuid(),
    key: z.string().min(1, "Key is required").regex(/^[a-zA-Z0-9_]+$/, "Key must be alphanumeric"),
    label: z.string().min(1, "Label is required"),
    description: z.string().optional(),
    type: SchemaFieldType,
    options: z.array(z.string()).optional(), // Only for 'select'
    required: z.boolean().default(false),
});

export const MasterSchemaDefinitionSchema = z.object({
    fields: z.array(SchemaFieldSchema),
});

export type SchemaField = z.infer<typeof SchemaFieldSchema>;
export type MasterSchemaDefinition = z.infer<typeof MasterSchemaDefinitionSchema>;
