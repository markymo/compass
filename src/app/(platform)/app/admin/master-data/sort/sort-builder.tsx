"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { updateCategoryOrder, updateFieldOrder } from "@/actions/master-data-sort";
import { GripVertical, Save, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type FieldDef = {
    fieldNo: number;
    fieldName: string;
    categoryId: string | null;
    order: number;
};

type CategoryDef = {
    id: string;
    key: string;
    displayName: string;
    order: number;
    fields: FieldDef[];
};

export default function MasterDataSortBuilder({ initialData }: { initialData: any }) {
    const router = useRouter();
    const [categories, setCategories] = useState<CategoryDef[]>(initialData.categories || []);
    const [uncategorizedFields, setUncategorizedFields] = useState<FieldDef[]>(initialData.uncategorizedFields || []);

    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    const toggleCollapse = (id: string) => {
        setCollapsedCategories(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const moveCategory = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === categories.length - 1) return;

        const newCategories = [...categories];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const temp = newCategories[index];
        newCategories[index] = newCategories[targetIndex];
        newCategories[targetIndex] = temp;

        newCategories.forEach((cat: any, idx: any) => cat.order = idx);
        setCategories(newCategories);
    };

    const moveField = (catIndex: number, fieldIndex: number, direction: 'up' | 'down') => {
        const category = categories[catIndex];
        if (direction === 'up' && fieldIndex === 0) return;
        if (direction === 'down' && fieldIndex === category.fields.length - 1) return;

        const newCategories = [...categories];
        const newFields = [...category.fields];

        const targetIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
        const temp = newFields[fieldIndex];
        newFields[fieldIndex] = newFields[targetIndex];
        newFields[targetIndex] = temp;

        newFields.forEach((f: any, idx: any) => f.order = idx);
        newCategories[catIndex] = { ...category, fields: newFields };
        setCategories(newCategories);
    };

    const handleDragEnd = (result: DropResult) => {
        const { source, destination, type } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        if (type === "CATEGORY") {
            const newCategories = Array.from(categories);
            const [moved] = newCategories.splice(source.index, 1);
            newCategories.splice(destination.index, 0, moved);
            // Updating internal order
            newCategories.forEach((cat: any, index: any) => {
                cat.order = index;
            });
            setCategories(newCategories);
        } else if (type === "FIELD") {
            // Dragging field within a category
            const sourceCatId = source.droppableId;
            const destCatId = destination.droppableId;

            if (sourceCatId !== destCatId) {
                // Changing category not fully supported here, but can be done if needed. Out of scope according to prompt.
                // Assuming only same category drops for now or moving between categories
                const sourceCatIndex = categories.findIndex(c => c.id === sourceCatId);
                const destCatIndex = categories.findIndex(c => c.id === destCatId);

                if (sourceCatIndex !== -1 && destCatIndex !== -1) {
                    const newCategories = Array.from(categories);
                    const sourceFields = Array.from(newCategories[sourceCatIndex].fields);
                    const destFields = Array.from(newCategories[destCatIndex].fields);
                    const [moved] = sourceFields.splice(source.index, 1);
                    moved.categoryId = destCatId;
                    destFields.splice(destination.index, 0, moved);

                    newCategories[sourceCatIndex].fields = sourceFields;
                    newCategories[destCatIndex].fields = destFields;

                    newCategories[destCatIndex].fields.forEach((f: any, idx: any) => f.order = idx);
                    newCategories[sourceCatIndex].fields.forEach((f: any, idx: any) => f.order = idx);

                    setCategories(newCategories);
                }
            } else {
                const catIndex = categories.findIndex(c => c.id === sourceCatId);
                if (catIndex !== -1) {
                    const newCategories = Array.from(categories);
                    const newFields = Array.from(newCategories[catIndex].fields);
                    const [moved] = newFields.splice(source.index, 1);
                    newFields.splice(destination.index, 0, moved);

                    newFields.forEach((f: any, idx: any) => f.order = idx);
                    newCategories[catIndex].fields = newFields;
                    setCategories(newCategories);
                }
            }
        }
    };

    const handleSaveCategories = async () => {
        setIsSaving(true);
        try {
            const payload = categories.map((c: any) => ({ id: c.id, order: c.order }));
            await updateCategoryOrder(payload);
            toast.success("Category order saved successfully");
            router.refresh();
        } catch (e) {
            toast.error("Failed to save category order");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveFields = async () => {
        setIsSaving(true);
        try {
            const payload = categories.flatMap((c: any) => c.fields.map((f: any) => ({ 
                fieldNo: f.fieldNo, 
                order: f.order,
                categoryId: c.id // Explicitly pass the current parent category ID
            })));
            await updateFieldOrder(payload);
            toast.success("Field order saved successfully");
            router.refresh();
        } catch (e) {
            toast.error("Failed to save field order");
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex gap-4">
                <Button variant="outline" onClick={handleSaveCategories} disabled={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Category Order
                </Button>
                <Button variant="outline" onClick={handleSaveFields} disabled={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Field Order
                </Button>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="categories" type="CATEGORY">
                    {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                            {categories.map((category: any, index: any) => (
                                <Draggable key={category.id} draggableId={category.id} index={index}>
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className="border rounded-md p-4 bg-slate-50 dark:bg-slate-800/50 shadow-sm"
                                        >
                                            <div className="flex items-center gap-3 mb-2 font-semibold text-lg">
                                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-slate-400 p-1">
                                                    <GripVertical />
                                                </div>
                                                <button onClick={() => toggleCollapse(category.id)} className="text-slate-800 dark:text-slate-200 hover:text-slate-600 flex items-center gap-1 transition-colors">
                                                    {collapsedCategories.has(category.id) ? <ChevronRight className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                                                    {category.displayName}
                                                </button>
                                                <span className="text-slate-500 text-sm ml-2 font-normal">({category.fields.length} fields)</span>
                                                <div className="flex items-center gap-1 ml-auto">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveCategory(index, 'up')} disabled={index === 0}>
                                                        <ArrowUp className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveCategory(index, 'down')} disabled={index === categories.length - 1}>
                                                        <ArrowDown className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {!collapsedCategories.has(category.id) && (
                                                <Droppable droppableId={category.id} type="FIELD">
                                                    {(provided) => (
                                                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 pl-8 pt-2">
                                                            {category.fields.map((field: any, fieldIndex: any) => (
                                                                <Draggable key={field.fieldNo.toString()} draggableId={field.fieldNo.toString()} index={fieldIndex}>
                                                                    {(provided) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border rounded-md shadow-sm"
                                                                        >
                                                                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600">
                                                                                <GripVertical className="w-4 h-4" />
                                                                            </div>
                                                                            <span className="font-mono text-xs text-slate-500 w-10">{field.fieldNo}</span>
                                                                            <span>{field.fieldName}</span>

                                                                            <div className="flex items-center gap-1 ml-auto">
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveField(index, fieldIndex, 'up')} disabled={fieldIndex === 0}>
                                                                                    <ArrowUp className="w-3 h-3" />
                                                                                </Button>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveField(index, fieldIndex, 'down')} disabled={fieldIndex === category.fields.length - 1}>
                                                                                    <ArrowDown className="w-3 h-3" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            ))}
                                                            {provided.placeholder}
                                                        </div>
                                                    )}
                                                </Droppable>
                                            )}
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            <div className="mt-12 opacity-75">
                <h3 className="font-semibold text-lg mb-4 pl-4 border-l-4 border-orange-400">Uncategorized Fields</h3>
                <div className="space-y-2 pl-8">
                    {uncategorizedFields.map((field: any) => (
                        <div key={field.fieldNo} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border rounded-md shadow-sm opacity-60">
                            <span className="font-mono text-xs text-slate-500 w-10">{field.fieldNo}</span>
                            <span>{field.fieldName}</span>
                        </div>
                    ))}
                    {uncategorizedFields.length === 0 && <div className="text-sm text-slate-500">None</div>}
                </div>
            </div>
        </div>
    );
}
