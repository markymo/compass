"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { GroupEditDialog } from "./group-edit-dialog";

export function GroupListHeader() {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    return (
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold font-serif text-slate-900 dark:text-slate-100">Virtual Field Groups</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Logic-only containers for streamlining field collection in the UI.</p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Group
            </Button>

            <GroupEditDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
            />
        </div>
    );
}
