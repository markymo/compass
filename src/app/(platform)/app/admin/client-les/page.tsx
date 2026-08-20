"use client";

import { useState, useEffect } from "react";
import { getAllClientLEsForAdmin } from "@/actions/admin";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { AdminClientLEItem } from "@/types/admin-client-le";
import { ClientLETable } from "@/components/admin/ClientLETable";

export default function ClientLEsAdminPage() {
    const [clientLEs, setClientLEs] = useState<AdminClientLEItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const data = await getAllClientLEsForAdmin();
            setClientLEs(data);
        } catch (e) {
            console.error("Failed to load Client Legal Entities:", e);
        } finally {
            setLoading(false);
        }
    }

    const filteredLEs = clientLEs.filter((le) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchesName = le.name.toLowerCase().includes(q);
        const matchesShortCode = le.shortCode?.toLowerCase().includes(q) ?? false;
        const matchesJurisdiction = le.jurisdiction?.toLowerCase().includes(q) ?? false;
        const matchesLei = le.lei?.toLowerCase().includes(q) ?? false;
        const matchesParent = le.parentOrgs.some((p) =>
            p.name.toLowerCase().includes(q) || (p.shortCode?.toLowerCase().includes(q) ?? false)
        );
        return matchesName || matchesShortCode || matchesJurisdiction || matchesLei || matchesParent;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Client Legal Entities</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Administrative directory of all Client Legal Entities ($A \to Z$).
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex-1 max-w-sm relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search legal entities or parent organizations..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <ClientLETable
                        les={filteredLEs}
                        loading={loading}
                        emptyMessage={searchQuery ? "No legal entities matching search." : "No Client Legal Entities found."}
                        onRestoreSuccess={loadData}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
