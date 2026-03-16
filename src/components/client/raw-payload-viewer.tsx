"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileJson, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface RawPayloadViewerProps {
    data: any;
    title?: string;
    description?: string;
}

export function RawPayloadViewer({ data, title = "Raw Payload Data", description = "Underlying JSON context for this record." }: RawPayloadViewerProps) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!data) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopied(true);
        toast.success("JSON copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-slate-400 hover:text-indigo-600 gap-1 px-1 opacity-60 hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-mono font-bold">{`{ }`}</span>
                    <span className="text-[9px] uppercase tracking-wider font-semibold">Raw Data</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader className="relative pr-20">
                    <DialogTitle>{title}</DialogTitle>
                    <p className="text-sm text-slate-500">{description}</p>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="absolute right-0 top-0 h-8 gap-1.5 text-xs font-semibold border-slate-200"
                        onClick={handleCopy}
                    >
                        {copied ? (
                            <>
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                                <span>Copied</span>
                            </>
                        ) : (
                            <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy</span>
                            </>
                        )}
                    </Button>
                </DialogHeader>
                <div className="flex-1 overflow-auto mt-4 bg-slate-950 rounded-md p-4">
                    <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap break-words">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            </DialogContent>
        </Dialog>
    );
}
