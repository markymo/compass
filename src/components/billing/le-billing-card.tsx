
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Loader2, Edit2, Save, X, Building2, Mail, Hash, MapPin, FileCheck } from "lucide-react";
import { updateLEBilling } from "@/actions/billing";

// Flexible schema - all optional strings since specific requirements weren't detailed
// but we want structure.
const billingSchema = z.object({
    billingName: z.string().optional(),
    taxId: z.string().optional(),
    poNumber: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
    addressLine1: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
});

type BillingFormValues = z.infer<typeof billingSchema>;

interface LEBillingCardProps {
    le: {
        id: string;
        name: string;
        jurisdiction: string;
        billingDetails: any;
        canEdit: boolean;
    };
}

export function LEBillingCard({ le }: LEBillingCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Initial values
    const defaultValues: BillingFormValues = {
        billingName: le.billingDetails?.billingName || le.name, // Default to LE name
        taxId: le.billingDetails?.taxId || "",
        poNumber: le.billingDetails?.poNumber || "",
        contactName: le.billingDetails?.contactName || "",
        contactEmail: le.billingDetails?.contactEmail || "",
        addressLine1: le.billingDetails?.addressLine1 || "",
        city: le.billingDetails?.city || "",
        postalCode: le.billingDetails?.postalCode || "",
        country: le.billingDetails?.country || "",
    };

    const form = useForm<BillingFormValues>({
        resolver: zodResolver(billingSchema),
        defaultValues,
    });

    const onSubmit = async (data: BillingFormValues) => {
        if (!le.canEdit) return;

        setIsSaving(true);
        try {
            const res = await updateLEBilling(le.id, data);
            if (res.success) {
                toast.success("Billing details updated");
                setIsEditing(false);
            } else {
                toast.error(res.error || "Update failed");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        form.reset(defaultValues);
        setIsEditing(false);
    };

    return (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-400" />
                            {le.name}
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">
                            {le.jurisdiction || 'Unknown Jurisdiction'}
                        </CardDescription>
                    </div>
                    {le.canEdit && !isEditing && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                            className="text-slate-500 hover:text-indigo-600"
                        >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {isEditing ? (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="billingName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Billing Name</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="taxId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wide">VAT / Tax ID</FormLabel>
                                        <FormControl><Input placeholder="e.g. GB 123 456 789" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="contactName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Person</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="contactEmail" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Email</FormLabel>
                                        <FormControl><Input type="email" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <FormField control={form.control} name="poNumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wide">PO Number / Reference</FormLabel>
                                    <FormControl><Input placeholder="Optional default PO" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="space-y-3 pt-2">
                                <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Billing Address</FormLabel>
                                <FormField control={form.control} name="addressLine1" render={({ field }) => (
                                    <FormItem>
                                        <FormControl><Input placeholder="Address Line 1" {...field} /></FormControl>
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-3 gap-3">
                                    <FormField control={form.control} name="city" render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input placeholder="City" {...field} /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="postalCode" render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input placeholder="Postal Code" {...field} /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="country" render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input placeholder="Country" {...field} /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                                    <X className="h-4 w-4 mr-2" /> Cancel
                                </Button>
                                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700" disabled={isSaving}>
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </Form>
                ) : (
                    <div className="p-5 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                            <div>
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Company Details</h4>
                                <div className="space-y-3">
                                    <div>
                                        <span className="block text-xs text-slate-500">Billing Name</span>
                                        <div className="text-slate-900 font-medium">{defaultValues.billingName}</div>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-slate-500">Tax / VAT ID</span>
                                        <div className="text-slate-900">{defaultValues.taxId || <span className="text-slate-400 italic">Not set</span>}</div>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-slate-500">PO Ref</span>
                                        <div className="text-slate-900 tracking-wider bg-slate-50 inline-block px-2 py-0.5 rounded border border-slate-100 text-xs">
                                            {defaultValues.poNumber || "N/A"}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Contact & Address</h4>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-2">
                                        <Mail className="h-4 w-4 text-slate-300 mt-0.5" />
                                        <div>
                                            <div className="text-slate-900">{defaultValues.contactName || <span className="text-slate-400 italic">No contact name</span>}</div>
                                            <div className="text-slate-500 text-xs">{defaultValues.contactEmail}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-slate-300 mt-0.5" />
                                        <div className="text-slate-700 space-y-0.5">
                                            {defaultValues.addressLine1 ? (
                                                <>
                                                    <div>{defaultValues.addressLine1}</div>
                                                    <div>
                                                        {[defaultValues.city, defaultValues.postalCode].filter(Boolean).join(", ")}
                                                    </div>
                                                    <div>{defaultValues.country}</div>
                                                </>
                                            ) : (
                                                <span className="text-slate-400 italic">No address provided</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
