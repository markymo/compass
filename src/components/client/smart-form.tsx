"use client";

import { useForm, ControllerRenderProps } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateClientLEData } from "@/actions/client-le"; // Updated import
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MASTER_SCHEMA_CATEGORIES } from "@/data/master-schema-categories";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
// import { toast } from "sonner";

interface SmartFormField {
    key: string;
    label: string;
    type: string;
    requiredBy: string[];
    currentValue: any;
    categoryId?: string;
    options?: string[];
    description?: string;
}

interface SmartFormProps {
    clientLEId: string;
    requirements: SmartFormField[];
}

export function SmartForm({ clientLEId, requirements }: SmartFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Group fields by Category
    const groupedFields: Record<string, SmartFormField[]> = {};
    const uncategorized: SmartFormField[] = [];

    requirements.forEach(f => {
        if (f.categoryId) {
            if (!groupedFields[f.categoryId]) groupedFields[f.categoryId] = [];
            groupedFields[f.categoryId].push(f);
        } else {
            uncategorized.push(f);
        }
    });

    // Default Values
    const defaultValues = requirements.reduce((acc, field) => {
        acc[field.key] = field.currentValue ?? "";
        return acc;
    }, {} as Record<string, any>);

    const form = useForm({
        defaultValues,
    });

    async function onSubmit(data: any) {
        startTransition(async () => {
            const res = await updateClientLEData(clientLEId, data);
            if (res.success) {
                // toast.success("Data saved");
                alert("Saved!");
                router.refresh();
            } else {
                alert("Error saving data");
            }
        });
    }

    // Helper to render field input
    const renderFieldInput = (field: SmartFormField, fieldProps: ControllerRenderProps<any, string>) => {
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
            case "currency":
                return <Input type="number" {...fieldProps} onChange={(e) => fieldProps.onChange(e.target.valueAsNumber)} />;
            default: // text
                return <Input {...fieldProps} />;
        }
    };

    const RenderField = ({ field }: { field: SmartFormField }) => (
        <FormField
            key={field.key}
            control={form.control}
            name={field.key}
            render={({ field: fieldProps }) => (
                <FormItem className="flex flex-col space-y-2 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <FormLabel className="text-base font-semibold">{field.label}</FormLabel>
                            {field.description && (
                                <FormDescription className="mt-1">{field.description}</FormDescription>
                            )}
                        </div>
                        {field.requiredBy.length > 0 && (
                            <div className="flex flex-wrap gap-1 justify-end max-w-[40%]">
                                <span className="text-[10px] text-muted-foreground mr-1 uppercase tracking-wider py-1">Req. by:</span>
                                {field.requiredBy.map(fi => (
                                    <Badge key={fi} variant="outline" className="text-[10px] h-5 px-1.5 whitespace-nowrap">
                                        {fi}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <FormControl>
                        {renderFieldInput(field, fieldProps)}
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-20">

                <Accordion type="multiple" defaultValue={MASTER_SCHEMA_CATEGORIES.map(c => c.id)} className="space-y-4">
                    {/* Render Categories First */}
                    {MASTER_SCHEMA_CATEGORIES.map(category => {
                        const fields = groupedFields[category.id];
                        if (!fields || fields.length === 0) return null;

                        return (
                            <AccordionItem key={category.id} value={category.id} className="border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 px-4">
                                <AccordionTrigger className="hover:no-underline">
                                    <div className="flex flex-col items-start text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-lg">{category.title}</span>
                                            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                                                {fields.length}
                                            </Badge>
                                        </div>
                                        <span className="text-sm text-muted-foreground font-normal">{category.description}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-4 pb-4 grid gap-6 md:grid-cols-2">
                                    {fields.map(field => <RenderField key={field.key} field={field} />)}
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}

                    {/* Uncategorized */}
                    {uncategorized.length > 0 && (
                        <AccordionItem value="uncategorized" className="border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 px-4">
                            <AccordionTrigger className="hover:no-underline font-semibold text-lg">
                                Other Information
                            </AccordionTrigger>
                            <AccordionContent className="pt-4 pb-4 grid gap-6 md:grid-cols-2">
                                {uncategorized.map(field => <RenderField key={field.key} field={field} />)}
                            </AccordionContent>
                        </AccordionItem>
                    )}
                </Accordion>

                {requirements.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                        <p>No requirements found. Connect with Financial Institutions to get started.</p>
                    </div>
                )}

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur border-t z-50 flex justify-end md:pr-8">
                    <Button type="submit" disabled={isPending} size="lg" className="shadow-lg">
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Changes
                    </Button>
                </div>
            </form>
        </Form>
    );
}
