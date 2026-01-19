
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface FIBreadcrumbProps {
    items: BreadcrumbItem[];
    className?: string;
}

export function FIBreadcrumb({ items, className }: FIBreadcrumbProps) {
    return (
        <nav className={cn("flex items-center text-sm text-slate-500 mb-4", className)} aria-label="Breadcrumb">
            <Link href="/app/fi" className="hover:text-indigo-600 transition-colors">
                FI Dashboard
            </Link>

            {items.map((item, index) => (
                <div key={index} className="flex items-center">
                    <ChevronRight className="w-4 h-4 mx-2 text-slate-400" />
                    {item.href ? (
                        <Link
                            href={item.href}
                            className="hover:text-indigo-600 transition-colors"
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span className="font-medium text-slate-900">
                            {item.label}
                        </span>
                    )}
                </div>
            ))}
        </nav>
    );
}
