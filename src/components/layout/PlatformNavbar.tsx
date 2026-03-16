import Link from "next/link";
import { Settings, ClipboardCheck } from "lucide-react";
import { UserNav } from "./UserNav";
import { Button } from "@/components/ui/button";
import { DemoSwitcher } from "./DemoSwitcher";
import { AuthSessionProvider } from "@/components/providers/session-provider";

interface PlatformNavbarProps {
    isSystemAdmin?: boolean;
    assignmentCount?: number;
}

export function PlatformNavbar({ isSystemAdmin = false, assignmentCount = 0 }: PlatformNavbarProps) {
    return (
        <header className="sticky top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-1">
                        <span className="text-xl font-bold tracking-tight text-slate-900 font-sans flex items-baseline gap-1">
                            ONpro<span className="inline-block w-2.5 h-2.5 bg-amber-500" />
                        </span>
                    </Link>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" asChild className="text-slate-500 hover:text-slate-900 shrink-0 relative" title="My assigned tasks">
                        <Link href="/app/assignments">
                            <ClipboardCheck className="h-5 w-5" />
                            {assignmentCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-[3px] text-[10px] font-bold leading-none bg-red-500 text-white rounded-full flex items-center justify-center">
                                    {assignmentCount > 99 ? '99+' : assignmentCount}
                                </span>
                            )}
                        </Link>
                    </Button>
                    {isSystemAdmin && (
                        <Button variant="ghost" size="icon" asChild className="text-slate-500 hover:text-slate-900">
                            <Link href="/app/admin">
                                <Settings className="h-5 w-5" />
                            </Link>
                        </Button>
                    )}
                    {isSystemAdmin && <DemoSwitcher />}
                    <UserNav />
                </div>
            </div>
        </header>
    );
}
