
"use client";

import { LEBillingCard } from "@/components/billing/le-billing-card";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function BillingPageClient({ data }: { data: any }) {
    const { orgName, les, isOrgAdmin } = data;
    const [search, setSearch] = useState("");

    const filteredLes = les.filter((le: any) =>
        le.name.toLowerCase().includes(search.toLowerCase()) ||
        le.jurisdiction?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Billing & Invoicing</h1>
                    <p className="text-slate-500 mt-1">Manage invoicing details for {orgName} entities.</p>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search entities..."
                        className="pl-9 bg-white"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {filteredLes.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <p className="text-slate-500">No entities found matching your search.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {filteredLes.map((le: any) => (
                        <LEBillingCard key={le.id} le={le} />
                    ))}
                </div>
            )}
        </div>
    );
}
