"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle, Search } from "lucide-react";
import { fetchGLEIFData, GLEIFFetchResult } from "@/actions/gleif";

interface LEILookupProps {
    onDataFetched: (data: any, summary: any) => void;
    initialLei?: string;
}

export function LEILookup({ onDataFetched, initialLei = "" }: LEILookupProps) {
    const [lei, setLei] = useState(initialLei);
    const [status, setStatus] = useState<"IDLE" | "LOADING" | "SUCCESS" | "ERROR">("IDLE");
    const [errorMsg, setErrorMsg] = useState("");
    const [summary, setSummary] = useState<any>(null);

    async function handleFetch() {
        if (!lei) return;
        setStatus("LOADING");
        setErrorMsg("");
        setSummary(null);

        const result = await fetchGLEIFData(lei);

        if (result.success) {
            setStatus("SUCCESS");
            setSummary(result.summary);
            onDataFetched(result.data, result.summary);
        } else {
            setStatus("ERROR");
            setErrorMsg(result.error);
        }
    }

    return (
        <div className="space-y-3 p-4 border rounded-md bg-slate-50 dark:bg-slate-900/50">
            <div className="space-y-2">
                <Label>Legal Entity Identifier (LEI)</Label>
                <div className="flex gap-2">
                    <Input
                        value={lei}
                        onChange={(e) => setLei(e.target.value)}
                        placeholder="e.g. 5493006MHB84DD0ZWV18"
                        className="uppercase font-mono"
                        maxLength={20}
                    />
                    <Button onClick={handleFetch} disabled={!lei || status === "LOADING"} variant="secondary">
                        {status === "LOADING" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        <span className="ml-2">Fetch</span>
                    </Button>
                </div>
            </div>

            {status === "ERROR" && (
                <div className="text-sm text-red-500 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {errorMsg}
                </div>
            )}

            {status === "SUCCESS" && summary && (
                <div className="text-sm border-l-2 border-green-500 pl-3 py-1 space-y-1 bg-green-50 dark:bg-green-900/10 rounded-r">
                    <div className="flex items-center gap-2 text-green-700 font-medium pb-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>Verified with GLEIF</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-x-2">
                        <span className="text-slate-500">Legal Name:</span>
                        <span className="font-medium">{summary.name}</span>

                        <span className="text-slate-500">Jurisdiction:</span>
                        <span>{summary.jurisdiction}</span>

                        <span className="text-slate-500">Address:</span>
                        <span className="truncate" title={summary.address}>{summary.address}</span>

                        <span className="text-slate-500">Status:</span>
                        <span>{summary.status}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
