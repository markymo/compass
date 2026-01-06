import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";

export default async function LEDashboardV2Page({ params }: { params: { id: string } }) {
    const data = await getClientLEData(params.id);

    if (!data) {
        return notFound();
    }

    const { le } = data;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Client Dashboard</span>
                    <span>/</span>
                    <span>{le.name}</span>
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">V2 PROTOTYPE</span>
                </div>

                <h1 className="text-4xl font-bold tracking-tight font-serif text-slate-900 border-b pb-4">
                    {le.name}
                </h1>
            </div>

            <div className="min-h-[400px] flex items-center justify-center border-2 border-dashed rounded-xl bg-slate-50/50">
                <div className="text-center space-y-2">
                    <p className="text-slate-500 font-medium text-lg">V2 Prototype Workbench</p>
                    <p className="text-slate-400 text-sm italic">"Growing the Standing Data vision from here..."</p>
                </div>
            </div>
        </div>
    );
}
