"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle, Search } from "lucide-react";
import { fetchGLEIFData, searchGLEIFByName, GLEIFFetchResult } from "@/actions/gleif";

interface LEILookupProps {
    onDataFetched: (data: any, summary: any) => void;
    initialLei?: string;
}

export function LEILookup({ onDataFetched, initialLei = "" }: LEILookupProps) {
    const [mode, setMode] = useState<"LEI" | "SEARCH">("LEI");

    // LEI Mode State
    const [lei, setLei] = useState(initialLei);

    // Search Mode State
    const [searchName, setSearchName] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // Shared State
    const [status, setStatus] = useState<"IDLE" | "LOADING" | "SUCCESS" | "ERROR">("IDLE");
    const [errorMsg, setErrorMsg] = useState("");
    const [summary, setSummary] = useState<any>(null);

    // FETCH BY LEI
    async function handleFetch(leiToFetch?: string) {
        const targetLei = leiToFetch || lei;
        if (!targetLei) return;

        setStatus("LOADING");
        setErrorMsg("");
        setSummary(null);

        const result = await fetchGLEIFData(targetLei);

        if (result.success) {
            setStatus("SUCCESS");
            setSummary(result.summary);
            setLei(targetLei); // Ensure input shows the LEI
            onDataFetched(result.data, result.summary);
            // If we were in search mode, switch back to LEI mode to show the "Verified" panel cleanly
            setMode("LEI");
            setSearchResults([]); // Clear results
        } else {
            setStatus("ERROR");
            setErrorMsg(result.error);
        }
    }

    // SEARCH BY NAME
    async function handleSearch() {
        if (!searchName) return;
        setStatus("LOADING");
        setErrorMsg("");
        setSearchResults([]);

        const result = await searchGLEIFByName(searchName);

        if (result.success) {
            setStatus("IDLE"); // We are idle, just showing results
            setSearchResults(result.results || []);
        } else {
            setStatus("ERROR");
            setErrorMsg(result.error || "Search failed");
        }
    }

    // RESET / TOGGLE
    function toggleMode() {
        setMode(prev => prev === "LEI" ? "SEARCH" : "LEI");
        setErrorMsg("");
        setSearchResults([]);
        setStatus("IDLE");
    }

    return (
        <div className="space-y-3 p-4 border rounded-md bg-slate-50 dark:bg-slate-900/50">
            <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                    <Label>
                        {mode === "LEI" ? "Legal Entity Identifier (LEI)" : "Search Company Name"}
                    </Label>
                    <button
                        onClick={toggleMode}
                        className="text-xs text-blue-600 hover:text-blue-500 underline"
                    >
                        {mode === "LEI" ? "Search by name" : "Back to LEI input"}
                    </button>
                </div>

                <div className="flex gap-2">
                    {mode === "LEI" ? (
                        <Input
                            value={lei}
                            onChange={(e) => setLei(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                            placeholder="e.g. 5493006MHB84DD0ZWV18"
                            className="uppercase font-mono"
                            maxLength={20}
                        />
                    ) : (
                        <Input
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            placeholder="Search company name..."
                        />
                    )}

                    <Button
                        onClick={() => mode === "LEI" ? handleFetch() : handleSearch()}
                        disabled={status === "LOADING" || (mode === "LEI" ? !lei : !searchName)}
                        variant="secondary"
                    >
                        {status === "LOADING" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        <span className="ml-2">{mode === "LEI" ? "Fetch" : "Search"}</span>
                    </Button>
                </div>
            </div>

            {/* ERROR MESSAGE */}
            {status === "ERROR" && (
                <div className="text-sm text-red-500 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {errorMsg}
                </div>
            )}

            {/* SEARCH RESULTS LIST */}
            {mode === "SEARCH" && searchResults.length > 0 && (
                <div className="border rounded-md bg-white dark:bg-slate-950 overflow-hidden text-sm shadow-sm max-h-[300px] overflow-y-auto">
                    <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-500 border-b">
                        Select an entity to verify
                    </div>
                    {searchResults.map((res) => (
                        <button
                            key={res.id}
                            onClick={() => handleFetch(res.id)} // Fetch the full record for this LEI
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 border-b last:border-0 transition-colors flex justify-between items-center group"
                        >
                            <div>
                                <div className="font-semibold group-hover:text-blue-600">{res.name}</div>
                                <div className="text-xs text-slate-500 flex gap-2">
                                    <span className="font-mono">{res.id}</span>
                                    <span>•</span>
                                    <span>{res.jurisdiction}</span>
                                </div>
                            </div>
                            <div className={`text-[10px] px-1.5 py-0.5 rounded border ${res.status === 'ISSUED' ? 'bg-green-50 text-green-700 border-green-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                {res.status}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* EMPTY SEARCH STATE */}
            {mode === "SEARCH" && status === "IDLE" && searchResults.length === 0 && searchName.length > 2 && (
                <div className="text-sm text-slate-400 italic px-1">
                    No matches found. Try accurate spelling or switch to manual entry.
                </div>
            )}


            {/* VERIFIED PANEL (Success State) */}
            {status === "SUCCESS" && summary && (
                <div className="text-sm border-l-2 border-green-500 pl-3 py-1 space-y-1 bg-green-50 dark:bg-green-900/10 rounded-r animate-in fade-in slide-in-from-top-1">
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
