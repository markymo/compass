"use client";

import { useState } from "react";
import { MasterSchemaDefinition, SchemaField } from "@/types/schema";
import { createMasterSchema, publishSchema, updateSchemaDefinition } from "@/actions/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRouter } from "next/navigation";

interface SchemaEditorProps {
    initialSchema: { id: string; version: number; definition: any; isActive: boolean } | null;
}

export function SchemaEditor({ initialSchema }: SchemaEditorProps) {
    const router = useRouter();
    const [schema, setSchema] = useState(initialSchema);
    const [fields, setFields] = useState<SchemaField[]>((initialSchema?.definition as any)?.fields || []);
    const [loading, setLoading] = useState(false);

    // New Field State
    const [newKey, setNewKey] = useState("");
    const [newLabel, setNewLabel] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newType, setNewType] = useState("text");

    async function handleCreateDraft() {
        setLoading(true);
        const res = await createMasterSchema();
        if (res.success && res.data) {
            setSchema(res.data as any);
            setFields((res.data.definition as any)?.fields || []);
            router.refresh();
        }
        setLoading(false);
    }

    function addField() {
        if (!newKey || !newLabel) return;
        const newField: SchemaField = {
            id: crypto.randomUUID(),
            key: newKey,
            label: newLabel,
            description: newDescription,
            type: newType as any,
            required: false,
        };
        setFields([...fields, newField]);
        setNewKey("");
        setNewLabel("");
        setNewDescription("");
    }

    function removeField(id: string) {
        setFields(fields.filter((f) => f.id !== id));
    }

    async function handleSave() {
        if (!schema) return;
        setLoading(true);
        await updateSchemaDefinition(schema.id, { fields });
        setLoading(false);
        alert("Saved!");
        router.refresh();
    }

    async function handlePublish() {
        if (!schema) return;
        if (!confirm("Are you sure? This will be the live schema.")) return;
        setLoading(true);
        await publishSchema(schema.id);
        setLoading(false);
        alert("Published!");
        router.refresh();
    }

    if (!schema) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>No Active Draft</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleCreateDraft} disabled={loading}>
                        Create New Schema Draft
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle>Schema Version {schema.version} {schema.isActive ? "(Live)" : "(Draft)"}</CardTitle>
                        <CardDescription>
                            {schema.isActive
                                ? "This schema is active. Create a new draft to make changes."
                                : "This is a draft. Save changes and publish to go live."}
                        </CardDescription>
                    </div>
                    <div className="space-x-2">
                        {!schema.isActive ? (
                            <>
                                <Button variant="outline" onClick={handleSave} disabled={loading}>
                                    Save Draft
                                </Button>
                                <Button onClick={handlePublish} disabled={loading}>
                                    Publish
                                </Button>
                            </>
                        ) : (
                            <Button onClick={handleCreateDraft} disabled={loading}>
                                Create Version {schema.version + 1}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Add Field Form */}
                    {!schema.isActive && (
                        <div className="grid grid-cols-5 gap-4 p-4 border rounded-md mb-6 bg-muted/50">
                            <div>
                                <Label>Key</Label>
                                <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="e.g. annualTurnover" />
                            </div>
                            <div>
                                <Label>Label</Label>
                                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Display Name" />
                            </div>
                            <div>
                                <Label>Description</Label>
                                <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="AI Context" />
                            </div>
                            <div>
                                <Label>Type</Label>
                                <Select value={newType} onValueChange={setNewType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="text">Text</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="date">Date</SelectItem>
                                        <SelectItem value="boolean">Yes/No</SelectItem>
                                        <SelectItem value="select">Select</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end">
                                <Button onClick={addField} variant="secondary" className="w-full">Add Field</Button>
                            </div>
                        </div>
                    )}

                    {/* Fields Table */}
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Label</TableHead>
                                <TableHead>Key</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field) => (
                                <TableRow key={field.id}>
                                    <TableCell>{field.label}</TableCell>
                                    <TableCell className="font-mono text-xs">{field.key}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{field.description}</TableCell>
                                    <TableCell>{field.type}</TableCell>
                                    <TableCell>
                                        {!schema.isActive && (
                                            <Button variant="ghost" size="sm" onClick={() => removeField(field.id)} className="text-red-500">
                                                Remove
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {fields.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">No fields defined.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
