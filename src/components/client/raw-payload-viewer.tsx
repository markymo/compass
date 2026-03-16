"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileJson } from "lucide-react";

interface RawPayloadViewerProps {
    data: any;
    title?: string;
    description?: string;
}

export function RawPayloadViewer({ data, title = "Raw Payload Data", description = "Underlying JSON context for this record." }: RawPayloadViewerProps) {
    const [open, setOpen] = useState(false);

    if (!data) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-slate-400 hover:text-indigo-600 gap-1.5 px-2">
                    <FileJson className="h-4 w-4" />
                    <span className="text-xs font-medium">View Raw JSON</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <p className="text-sm text-slate-500">{description}</p>
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
