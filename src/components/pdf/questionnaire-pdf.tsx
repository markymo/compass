import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, Svg, Path, Polyline } from "@react-pdf/renderer";

// --- Icons ---
const LandmarkIcon = () => (
    <Svg viewBox="0 0 24 24" width={12} height={12} fill="none">
        <Path d="M3 22h18 M6 18v-7 M10 18v-7 M14 18v-7 M18 18v-7 M12 2l8 5H4z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const BuildingIcon = () => (
    <Svg viewBox="0 0 24 24" width={12} height={12} fill="none">
        <Path d="M4 10h16 M4 14h16 M4 18h16 M4 6h16 M4 2v20 M20 2v20 M8 22v-4 M16 22v-4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const GlobeIcon = () => (
    <Svg viewBox="0 0 24 24" width={12} height={12} fill="none">
        <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const OnProLogo = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Svg viewBox="0 0 120 120" width={28} height={28} style={{ marginRight: 6 }}>
            <Polyline points="80,20 20,20 20,105 105,105 105,65" fill="none" stroke="#f97316" strokeWidth={11} />
            <Polyline points="40,65 65,90 100,20" fill="none" stroke="#f97316" strokeWidth={14} />
        </Svg>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#f97316', letterSpacing: -1 }}>On</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#000000', letterSpacing: -1 }}>Pro</Text>
        </View>
    </View>
);

// --- PDF Styles (OnPro Theme) ---
const styles = StyleSheet.create({
    page: { 
        padding: 30, 
        fontSize: 10, 
        fontFamily: 'Helvetica', 
        color: '#0f172a',
        backgroundColor: '#ffffff'
    },
    
    // Top Header Block
    headerBlock: { 
        marginBottom: 10,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20
    },
    headerLeft: {
        flex: 1,
        paddingRight: 20
    },
    headerRight: {
        width: 150,
        alignItems: 'flex-end'
    },
    logo: {
        width: 100,
        height: 'auto',
        marginBottom: 10
    },
    questionnaireTitle: { 
        fontSize: 16, 
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4
    },
    coverSubtitle: {
        fontSize: 11,
        color: '#64748b'
    },
    
    // Header Right Meta
    metaText: {
        fontSize: 8,
        color: '#64748b',
        marginBottom: 4
    },

    // Identity Card
    identityCard: {
        backgroundColor: '#f8fafc',
        padding: 12,
        borderLeft: '4px solid #f59e0b', // Amber 500 accent
        marginBottom: 10
    },
    coverRow: { 
        flexDirection: 'row', 
        marginBottom: 6,
        alignItems: 'center'
    },
    iconContainer: {
        marginRight: 6
    },
    coverLabel: { 
        width: 100, 
        fontSize: 9, 
        color: '#64748b', 
        fontWeight: 'bold' 
    },
    coverValue: { 
        flex: 1, 
        fontSize: 10, 
        color: '#0f172a', 
        fontWeight: 'bold' 
    },

    // Summary Card
    summaryCard: {
        backgroundColor: '#ffffff',
        padding: 12,
        border: '1px solid #e2e8f0',
        marginBottom: 20,
        flexDirection: 'row'
    },
    summaryColumn: {
        flex: 1,
        paddingRight: 10
    },
    summaryTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    summaryRow: {
        flexDirection: 'row',
        marginBottom: 4,
        justifyContent: 'space-between'
    },
    summaryLabel: {
        fontSize: 9,
        color: '#64748b'
    },
    summaryValue: {
        fontSize: 9,
        color: '#0f172a',
        fontWeight: 'bold'
    },

    // Questions
    questionBlock: { 
        marginBottom: 20, 
        paddingBottom: 15, 
        borderBottom: '1px solid #e2e8f0' 
    },
    questionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8
    },
    question: { 
        fontSize: 11, 
        fontWeight: 'bold', 
        color: '#0f172a',
        lineHeight: 1.4,
        flex: 1
    },
    answer: { 
        fontSize: 10, 
        marginBottom: 8, 
        color: '#0f172a',
        lineHeight: 1.4,
        paddingLeft: 4
    },
    
    // Provenance / Meta Row
    provenanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
        paddingLeft: 4
    },
    statusBadge: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        marginRight: 8
    },
    statusBadgeText: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#475569',
        textTransform: 'uppercase'
    },
    provenanceText: {
        fontSize: 9,
        color: '#64748b',
        marginRight: 10
    },
    
    // Notes & Evidence
    commentHeader: { 
        fontSize: 9, 
        fontStyle: 'italic', 
        marginTop: 8, 
        color: '#64748b' 
    },
    comment: { 
        fontSize: 9, 
        color: '#64748b', 
        marginLeft: 10,
        marginTop: 2
    },
    evidenceBlock: { 
        marginTop: 8, 
        padding: 8, 
        backgroundColor: '#f8fafc', 
        borderLeft: '2px solid #cbd5e1' 
    },
    evidenceLabel: { 
        fontSize: 8, 
        fontStyle: 'italic', 
        color: '#64748b', 
        marginBottom: 4 
    },
    evidencePath: { 
        fontSize: 8, 
        color: '#f59e0b', // Amber 500
        marginBottom: 2
    },
    
    // Footer / Small meta
    metaFooter: {
        marginTop: 30,
        paddingTop: 10,
        borderTop: '1px solid #e2e8f0',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    metaFooterText: {
        fontSize: 8,
        color: '#94a3b8'
    },

    // Group Layouts
    groupContainerList: {
        marginTop: 4,
        marginBottom: 8,
        borderTop: '1px solid #f1f5f9'
    },
    groupRowList: {
        paddingVertical: 6,
        borderBottom: '1px solid #f1f5f9'
    },
    groupLabelList: {
        fontSize: 9,
        color: '#64748b',
        marginBottom: 2
    },
    groupValueList: {
        fontSize: 10,
        color: '#0f172a',
        fontWeight: 'bold'
    },
    
    groupContainerCompact: {
        marginTop: 4,
        marginBottom: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    groupItemCompact: {
        width: '45%',
        marginBottom: 6
    },
    groupLabelCompact: {
        fontSize: 8,
        color: '#64748b',
        marginBottom: 2
    },
    groupValueCompact: {
        fontSize: 9,
        color: '#0f172a',
        fontWeight: 'bold'
    },

    groupContainerGrid: {
        marginTop: 6,
        marginBottom: 8,
        border: '1px solid #e2e8f0',
        borderRadius: 4,
        overflow: 'hidden'
    },
    groupRowGrid: {
        flexDirection: 'row',
        borderBottom: '1px solid #e2e8f0',
        paddingVertical: 6,
        paddingHorizontal: 8,
        alignItems: 'center'
    },
    groupRowGridHeader: {
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0'
    },
    groupCol1: { width: '40%', paddingRight: 4 },
    groupCol2: { width: '40%', paddingRight: 4 },
    groupCol3: { width: '20%', alignItems: 'flex-end' },
    groupTextGridLabel: {
        fontSize: 8,
        color: '#475569',
        fontWeight: 'bold'
    },
    groupTextGridValue: {
        fontSize: 8,
        color: '#0f172a',
        fontWeight: 'bold'
    },
    groupBadgeGrid: {
        backgroundColor: '#fdf4ff',
        color: '#a21caf',
        fontSize: 7,
        paddingVertical: 1,
        paddingHorizontal: 4,
        borderRadius: 4,
        fontWeight: 'bold'
    }
});

export interface QuestionnairePDFProps {
    title: string;
    exportMetadata?: {
        exportId: string;
        generatedAt: string;
        generatedBy: string;
        clientParentName?: string;
        clientDisplayName?: string;
        supplierDisplayName?: string;
        clientLogoUrl?: string;
        supplierLogoUrl?: string;
        onProLogoUrl?: string;
        exportFormatVersion: string;
        applicationVersion: string;
        summaryStats?: {
            totalQuestions: number;
            answered: number;
            registrySourced: number;
            userSupplied: number;
            noResponse: number;
            dueDate?: string;
        };
    };
    data: {
        id: string;
        status: string;
        question: string;
        answer: string;
        sourceLabel?: string;
        sourceTimestamp?: string;
        notes?: string;
        evidencePaths?: string[];
        groupFields?: {
            fieldNo: number;
            label: string;
            displayValue: string;
            order: number;
            sourceLabel?: string;
        }[];
        groupDisplayStyle?: 'LIST' | 'COMPACT' | 'GRID';
    }[];
}

// --- PDF Component ---
export const QuestionnairePDF = ({ data, title, exportMetadata }: QuestionnairePDFProps) => {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header & Branding */}
                <View style={styles.headerBlock}>
                    <View style={styles.headerTopRow}>
                        <View style={styles.headerLeft}>
                            {exportMetadata?.onProLogoUrl ? (
                                <Image src={exportMetadata.onProLogoUrl} style={styles.logo} />
                            ) : (
                                <OnProLogo />
                            )}
                            <Text style={styles.questionnaireTitle}>{title}</Text>
                            <Text style={styles.coverSubtitle}>Supplier Questionnaire Response</Text>
                        </View>
                        
                        <View style={styles.headerRight}>
                            {exportMetadata && (
                                <>
                                    {exportMetadata.summaryStats?.dueDate && (
                                        <Text style={styles.metaText}>Due Date: {new Date(exportMetadata.summaryStats.dueDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                                    )}
                                    <Text style={styles.metaText}>Generated: {new Date(exportMetadata.generatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                                    <Text style={styles.metaText}>By: {exportMetadata.generatedBy}</Text>
                                    <Text style={styles.metaText}>Ref: {exportMetadata.exportId.split('-')[0]}</Text>
                                </>
                            )}
                        </View>
                    </View>

                    {exportMetadata && (
                        <>
                            <View style={styles.identityCard}>
                                {exportMetadata.clientParentName ? (
                                    <View style={styles.coverRow}>
                                        <View style={styles.iconContainer}><LandmarkIcon /></View>
                                        <Text style={styles.coverLabel}>Client</Text>
                                        <Text style={styles.coverValue}>{exportMetadata.clientParentName}</Text>
                                    </View>
                                ) : (
                                    <View style={styles.coverRow}>
                                        <View style={styles.iconContainer}><LandmarkIcon /></View>
                                        <Text style={styles.coverLabel}>Client</Text>
                                        <Text style={styles.coverValue}>—</Text>
                                    </View>
                                )}
                                <View style={styles.coverRow}>
                                    <View style={styles.iconContainer}><BuildingIcon /></View>
                                    <Text style={styles.coverLabel}>Client Legal Entity</Text>
                                    <Text style={styles.coverValue}>{exportMetadata.clientDisplayName || "Unknown"}</Text>
                                </View>
                                <View style={styles.coverRow}>
                                    <View style={styles.iconContainer}><GlobeIcon /></View>
                                    <Text style={styles.coverLabel}>Supplier</Text>
                                    <Text style={styles.coverValue}>{exportMetadata.supplierDisplayName || "Unknown"}</Text>
                                </View>
                            </View>

                            {exportMetadata.summaryStats && (
                                <View style={styles.summaryCard}>
                                    <View style={styles.summaryColumn}>
                                        <Text style={styles.summaryTitle}>Response Summary</Text>
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>Total Questions</Text>
                                            <Text style={styles.summaryValue}>{exportMetadata.summaryStats.totalQuestions}</Text>
                                        </View>
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>Answered</Text>
                                            <Text style={styles.summaryValue}>{exportMetadata.summaryStats.answered}</Text>
                                        </View>
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>No Response Recorded</Text>
                                            <Text style={styles.summaryValue}>{exportMetadata.summaryStats.noResponse}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.summaryColumn}>
                                        <Text style={styles.summaryTitle}>Data Sources</Text>
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>Sourced from Registries</Text>
                                            <Text style={styles.summaryValue}>{exportMetadata.summaryStats.registrySourced}</Text>
                                        </View>
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>User Supplied / Released</Text>
                                            <Text style={styles.summaryValue}>{exportMetadata.summaryStats.userSupplied}</Text>
                                        </View>
                                        {exportMetadata.summaryStats.dueDate && (
                                            <View style={[styles.summaryRow, { marginTop: 8 }]}>
                                                <Text style={styles.summaryLabel}>Due Date</Text>
                                                <Text style={styles.summaryValue}>{new Date(exportMetadata.summaryStats.dueDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                </View>

                {/* Data */}
                {data.map((item: any, i: any) => (
                    <View key={i} style={styles.questionBlock} wrap={false}>
                        <View style={styles.questionHeaderRow}>
                            <Text style={styles.question}>Q{i + 1}: {item.question}</Text>
                        </View>
                        
                        {item.groupFields ? (
                            item.groupDisplayStyle === 'COMPACT' ? (
                                <View style={styles.groupContainerCompact}>
                                    {item.groupFields.map((f: any, idx: number) => (
                                        <View key={idx} style={styles.groupItemCompact} wrap={false}>
                                            <Text style={styles.groupLabelCompact}>{f.label}</Text>
                                            <Text style={styles.groupValueCompact}>{f.displayValue}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : item.groupDisplayStyle === 'GRID' ? (
                                <View style={styles.groupContainerGrid}>
                                    <View style={[styles.groupRowGrid, styles.groupRowGridHeader]} wrap={false}>
                                        <View style={styles.groupCol1}><Text style={styles.groupTextGridLabel}>Field</Text></View>
                                        <View style={styles.groupCol2}><Text style={styles.groupTextGridLabel}>Value</Text></View>
                                        <View style={styles.groupCol3}><Text style={styles.groupTextGridLabel}>Source</Text></View>
                                    </View>
                                    {item.groupFields.map((f: any, idx: number) => (
                                        <View key={idx} style={styles.groupRowGrid} wrap={false}>
                                            <View style={styles.groupCol1}><Text style={styles.groupTextGridLabel}>{f.label}</Text></View>
                                            <View style={styles.groupCol2}><Text style={styles.groupTextGridValue}>{f.displayValue}</Text></View>
                                            <View style={styles.groupCol3}>
                                                {f.sourceLabel && (
                                                    <View style={styles.groupBadgeGrid}>
                                                        <Text style={{ color: '#a21caf', fontSize: 7 }}>{f.sourceLabel}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.groupContainerList}>
                                    {item.groupFields.map((f: any, idx: number) => (
                                        <View key={idx} style={styles.groupRowList} wrap={false}>
                                            <Text style={styles.groupLabelList}>{f.label}</Text>
                                            <Text style={styles.groupValueList}>{f.displayValue}</Text>
                                        </View>
                                    ))}
                                </View>
                            )
                        ) : (
                            <Text style={styles.answer}>Answer: {item.answer || "No response recorded"}</Text>
                        )}
                        
                        <View style={styles.provenanceRow}>
                            <View style={styles.statusBadge}>
                                <Text style={styles.statusBadgeText}>{item.status}</Text>
                            </View>
                            {item.sourceLabel && <Text style={styles.provenanceText}>Source: {item.sourceLabel}</Text>}
                            {item.sourceTimestamp && <Text style={styles.provenanceText}>Last validated: {new Date(item.sourceTimestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}</Text>}
                        </View>
                        
                        {item.evidencePaths && item.evidencePaths.length > 0 && (
                            <View style={styles.evidenceBlock}>
                                <Text style={styles.evidenceLabel}>Evidence Attached:</Text>
                                {item.evidencePaths.map((path: string, j: number) => (
                                    <Text key={j} style={styles.evidencePath}>📄 {path}</Text>
                                ))}
                            </View>
                        )}

                        {item.notes && item.notes.length > 0 && (
                            <View>
                                <Text style={styles.commentHeader}>Notes:</Text>
                                {item.notes.split('\n').map((note: string, j: number) => (
                                    <Text key={j} style={styles.comment}>• {note}</Text>
                                ))}
                            </View>
                        )}
                    </View>
                ))}

                {/* Meta Footer */}
                {exportMetadata && (
                    <View style={styles.metaFooter} fixed>
                        <View>
                            <Text style={styles.metaFooterText}>OnPro | Single Source of Truth for Company Data</Text>
                        </View>
                        <Text style={styles.metaFooterText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                    </View>
                )}
            </Page>
        </Document>
    );
};
