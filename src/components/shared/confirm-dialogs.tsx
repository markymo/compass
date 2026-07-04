import * as React from "react";
import { Loader2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BaseConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string | React.ReactNode;
    onConfirm: () => Promise<void> | void;
    isLoading?: boolean;
    confirmDisabled?: boolean;
    itemName?: string;
    confirmLabel?: string;
    buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function ConfirmDeleteDialog({
    open,
    onOpenChange,
    title,
    description,
    onConfirm,
    isLoading,
    confirmDisabled,
    itemName,
    confirmLabel = "Delete",
    buttonVariant = "destructive",
}: BaseConfirmDialogProps) {
    const defaultTitle = "Are you sure you want to delete this?";
    const defaultDescription = itemName 
        ? `This will delete "${itemName}". This action cannot be undone.`
        : "This action cannot be undone.";

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title || defaultTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{description || defaultDescription}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                    <Button
                        variant={buttonVariant}
                        disabled={isLoading || confirmDisabled}
                        onClick={async (e) => {
                            e.preventDefault();
                            await onConfirm();
                            onOpenChange(false);
                        }}
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {confirmLabel}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function ConfirmArchiveDialog({
    open,
    onOpenChange,
    title,
    description,
    onConfirm,
    isLoading,
    itemName,
}: BaseConfirmDialogProps) {
    const defaultTitle = "Archive this item?";
    const defaultDescription = itemName
        ? `"${itemName}" will be archived and hidden from primary views. You can restore it later.`
        : "This item will be archived and hidden from primary views. You can restore it later.";

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title || defaultTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{description || defaultDescription}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                    <Button
                        variant="default"
                        disabled={isLoading}
                        onClick={async (e) => {
                            e.preventDefault();
                            await onConfirm();
                            onOpenChange(false);
                        }}
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Archive
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

interface ConfirmHardDeleteDialogProps extends BaseConfirmDialogProps {
    confirmationString: string;
}

export function ConfirmHardDeleteDialog({
    open,
    onOpenChange,
    title,
    description,
    onConfirm,
    isLoading,
    itemName,
    confirmationString,
}: ConfirmHardDeleteDialogProps) {
    const [input, setInput] = React.useState("");

    // Reset input when dialog closes
    React.useEffect(() => {
        if (!open) setInput("");
    }, [open]);

    const defaultTitle = "Permanently delete this item?";
    const defaultDescription = itemName
        ? `This will permanently and irreversibly destroy "${itemName}" from the database. All related records may also be affected.`
        : "This will permanently and irreversibly destroy this item from the database.";

    const isMatch = input === confirmationString;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title || defaultTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{description || defaultDescription}</AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="my-4">
                    <label className="text-sm font-medium mb-2 block text-slate-700">
                        Please type <strong>{confirmationString}</strong> to confirm.
                    </label>
                    <Input 
                        value={input} 
                        onChange={(e) => setInput(e.target.value)} 
                        disabled={isLoading}
                        className="w-full"
                    />
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                    <Button
                        variant="destructive"
                        disabled={!isMatch || isLoading}
                        onClick={async (e) => {
                            e.preventDefault();
                            await onConfirm();
                            onOpenChange(false);
                        }}
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Permanently Delete
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
