import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface RowAction {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: "default" | "destructive";
    disabled?: boolean;
}

interface RowActionsMenuProps {
    actions: RowAction[];
    buttonSize?: "default" | "sm" | "icon";
    className?: string;
}

export function RowActionsMenu({ actions, buttonSize = "icon", className }: RowActionsMenuProps) {
    if (!actions || actions.length === 0) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size={buttonSize} className={className}>
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {actions.map((action, index) => (
                    <DropdownMenuItem
                        key={index}
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className={cn(
                            "cursor-pointer",
                            action.variant === "destructive" && "text-destructive focus:bg-destructive focus:text-destructive-foreground"
                        )}
                    >
                        {action.icon && <span className="mr-2 h-4 w-4">{action.icon}</span>}
                        {action.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
