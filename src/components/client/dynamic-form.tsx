"use client";

import { useForm, ControllerRenderProps } from "react-hook-form";
import { MasterSchemaDefinition, SchemaField } from "@/types/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveClientLEData } from "@/actions/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface DynamicFormProps {
    leId: string;
    schemaId: string;
    definition: MasterSchemaDefinition;
    initialData: any;
}

export function DynamicForm({ leId, schemaId, definition, initialData }: DynamicFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Initialize form with existing data or default empty string for all fields
    const defaultValues = definition.fields.reduce((acc, field) => {
        acc[field.key] = initialData?.[field.key] ?? "";
        return acc;
    }, {} as Record<string, any>);

    const form = useForm({
        defaultValues,
    });

    async function onSubmit(data: any) {
        setLoading(true);
        const res = await saveClientLEData(leId, schemaId, data);
        setLoading(false);

        if (res.success) {
            alert("Data Saved Successfully!");
            router.refresh();
        } else {
            alert("Error saving data");
        }
    }

    // Helper to render field based on type
    const renderFieldInput = (field: SchemaField, fieldProps: ControllerRenderProps<any, string>) => {
        switch (field.type) {
            case "boolean":
                return (
                    <Switch
                        checked={fieldProps.value}
                        onCheckedChange={fieldProps.onChange}
                    />
                );
            case "select":
                return (
                    <Select onValueChange={fieldProps.onChange} defaultValue={fieldProps.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {field.options?.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            case "date":
                return <Input type="date" {...fieldProps} />;
            case "number":
                return <Input type="number" {...fieldProps} onChange={(e) => fieldProps.onChange(e.target.valueAsNumber)} />;
            default: // text
                return <Input {...fieldProps} />;
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                    {(definition.fields || []).map((field) => (
                        <FormField
                            key={field.id}
                            control={form.control}
                            name={field.key}
                            render={({ field: fieldProps }) => (
                                <FormItem className="flex flex-col space-y-2 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                                    <FormLabel className="text-base font-semibold">{field.label}</FormLabel>
                                    {field.description && (
                                        <FormDescription>{field.description}</FormDescription>
                                    )}
                                    <FormControl>
                                        {renderFieldInput(field, fieldProps)}
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    ))}
                </div>

                <div className="flex justify-end sticky bottom-4 bg-background/80 backdrop-blur p-4 border-t">
                    <Button type="submit" disabled={loading} size="lg">
                        {loading ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
