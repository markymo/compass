import { getFullMasterData } from "@/actions/client-le";
import { getCategoriesWithFields } from "@/actions/master-data-sort";
import { notFound } from "next/navigation";
import { DataSchemaTab } from "@/components/client/data-schema-tab";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import { EnrichmentGate } from "@/components/client/kyc/enrichment-gate";
import * as Sentry from "@sentry/nextjs";

export default async function MasterRecordPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return await Sentry.startSpan(
        {
            name: "master.total",
            op: "function.page",
            attributes: { "le.id_hashed": id ? "present" : "missing" }
        },
        async (totalSpan) => {
            // Diagnostic Span: getFullMasterData
            const result = await Sentry.startSpan(
                { name: "master.getFullMasterData", op: "function.action" },
                async () => getFullMasterData(id)
            );

            // Diagnostic Span: getCategoriesWithFields
            const dataSort = await Sentry.startSpan(
                { name: "master.getCategoriesWithFields", op: "function.action" },
                async () => getCategoriesWithFields()
            );

            if (!result.success) return notFound();

            const { 
                data: masterData, 
                customData, 
                customDefinitions, 
                gleifLastSynced, 
                nationalRegistryData, 
                masterFields, 
                masterGroups,
                enrichmentStatus,
                lei,
                registrationAuthorityId
            } = result as any;

            // Diagnostic Span: deepClone.total & payload size measurements
            const serializedProps = await Sentry.startSpan(
                { name: "master.deepClone.total", op: "function.serialization" },
                async (cloneSpan) => {
                    const strMasterData = JSON.stringify(masterData || {});
                    const strCustomData = JSON.stringify(customData || {});
                    const strCustomDefinitions = JSON.stringify(customDefinitions || []);
                    const strNationalRegistryData = nationalRegistryData ? JSON.stringify(nationalRegistryData) : "";
                    const strMasterFields = JSON.stringify(masterFields || []);
                    const strMasterGroups = JSON.stringify(masterGroups || []);

                    const cleanMasterData = JSON.parse(strMasterData);
                    const cleanCustomData = JSON.parse(strCustomData);
                    const cleanCustomDefinitions = JSON.parse(strCustomDefinitions);
                    const cleanNationalRegistryData = strNationalRegistryData ? JSON.parse(strNationalRegistryData) : undefined;
                    const cleanMasterFields = JSON.parse(strMasterFields);
                    const cleanMasterGroups = JSON.parse(strMasterGroups);

                    const bytesMasterData = Buffer.byteLength(strMasterData, 'utf8');
                    const bytesCustomData = Buffer.byteLength(strCustomData, 'utf8');
                    const bytesCustomDefinitions = Buffer.byteLength(strCustomDefinitions, 'utf8');
                    const bytesNationalRegistryData = Buffer.byteLength(strNationalRegistryData, 'utf8');
                    const bytesMasterFields = Buffer.byteLength(strMasterFields, 'utf8');
                    const bytesMasterGroups = Buffer.byteLength(strMasterGroups, 'utf8');
                    const aggregateBytes = bytesMasterData + bytesCustomData + bytesCustomDefinitions + bytesNationalRegistryData + bytesMasterFields + bytesMasterGroups;

                    cloneSpan?.setAttribute("payload.masterData.bytes", bytesMasterData);
                    cloneSpan?.setAttribute("payload.customData.bytes", bytesCustomData);
                    cloneSpan?.setAttribute("payload.customDefinitions.bytes", bytesCustomDefinitions);
                    cloneSpan?.setAttribute("payload.nationalRegistryData.bytes", bytesNationalRegistryData);
                    cloneSpan?.setAttribute("payload.masterFields.bytes", bytesMasterFields);
                    cloneSpan?.setAttribute("payload.masterGroups.bytes", bytesMasterGroups);
                    cloneSpan?.setAttribute("payload.aggregate.bytes", aggregateBytes);

                    totalSpan?.setAttribute("payload.aggregate.bytes", aggregateBytes);
                    totalSpan?.setAttribute("categories.count", dataSort.categories?.length || 0);

                    return {
                        cleanMasterData,
                        cleanCustomData,
                        cleanCustomDefinitions,
                        cleanNationalRegistryData,
                        cleanMasterFields,
                        cleanMasterGroups
                    };
                }
            );

            return (
                <div className="p-6 max-w-[1600px] mx-auto">
                    <SetPageBreadcrumbs items={[]} />

                    <EnrichmentGate 
                        leId={id} 
                        status={enrichmentStatus} 
                        lei={lei} 
                        raId={registrationAuthorityId}
                    >
                        <DataSchemaTab
                            leId={id}
                            masterData={serializedProps.cleanMasterData}
                            customData={serializedProps.cleanCustomData}
                            customDefinitions={serializedProps.cleanCustomDefinitions}
                            gleifLastSynced={gleifLastSynced ?? undefined}
                            nationalRegistryData={serializedProps.cleanNationalRegistryData}
                            masterFields={serializedProps.cleanMasterFields}
                            masterGroups={serializedProps.cleanMasterGroups}
                            categories={dataSort.categories}
                            uncategorizedFields={dataSort.uncategorizedFields}
                            registrationAuthorityId={registrationAuthorityId ?? undefined}
                        />
                    </EnrichmentGate>
                </div>
            );
        }
    );
}


