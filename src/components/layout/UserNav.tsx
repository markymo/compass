"use client";

import dynamic from "next/dynamic";
const UserButton = dynamic(() => import("@clerk/nextjs").then((mod) => mod.UserButton), {
    ssr: false,
    loading: () => <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse" />,
});

export function UserNav() {
    return <UserButton afterSignOutUrl="/" />;
}
