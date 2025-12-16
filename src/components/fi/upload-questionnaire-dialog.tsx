"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload } from "lucide-react";
import { uploadQuestionnaire } from "@/actions/fi";
import { useRouter } from "next/navigation";

export function UploadQuestionnaireDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);

        // Ensure file is present
        const file = formData.get("file") as File;
        if (!file || file.size === 0) {
            setLoading(false);
            alert("Please select a file.");
            return;
        }

        const res = await uploadQuestionnaire(formData);

        setLoading(false);

        if (res.success) {
            setOpen(false);
            router.refresh();
        } else {
            alert("Failed to upload: " + (res.error || "Unknown error"));
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload New
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle>Upload Questionnaire</DialogTitle>
                        <DialogDescription>
                            Upload a new DOCX or PDF questionnaire. System Admins will review and map it.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Questionnaire Name</Label>
                            <Input id="name" name="name" placeholder="e.g. US Institutional Onboarding" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="file">File</Label>
                            <Input id="file" name="file" type="file" accept=".pdf,.docx,.doc" required />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Upload
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
