"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QuestionnaireExportButtonProps {
    engagementId: string;
    questionnaireId?: string; // Optional filter
    className?: string;
    variant?: "default" | "outline" | "ghost" | "secondary";
}

export function QuestionnaireExportButton({ engagementId, questionnaireId, className, variant = "outline" }: QuestionnaireExportButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleExport = async (format: 'PDF' | 'EXCEL') => {
        setLoading(true);
        try {
            const response = await fetch('/api/export/questionnaire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    engagementId,
                    format,
                    questionnaireId: questionnaireId === 'all' ? undefined : questionnaireId
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Export failed");
            }

            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Content-Disposition usually handles filename, but we can falback
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `questionnaire_export.${format === 'EXCEL' ? 'xlsx' : 'pdf'}`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/);
                if (match) filename = match[1];
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast.success(`${format} export complete`);

        } catch (error: any) {
            console.error("Export Error:", error);
            toast.error(error.message || "Failed to export");
        } finally {
            setLoading(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant={variant} size="sm" className={className} disabled={loading}>
                    {loading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-2" />}
                    Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('EXCEL')}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Excel Report (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('PDF')}>
                    <FileText className="w-4 h-4 mr-2" />
                    PDF Document (.pdf)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
