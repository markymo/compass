const fs = require('fs');
const file = '/opt/code/coparity/src/components/client/inspection/field-detail-panel.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add imports
code = code.replace(
    /import { getFieldDetail, FieldDetailData } from "@\/actions\/kyc-query";/,
    `import { getFieldDetail, FieldDetailData } from "@/actions/kyc-query";\nimport { checkCustomFieldDependencies, softDeleteCustomField, DependencyReport } from "@/actions/master-data-governance";\nimport { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";\nimport { useRouter } from "next/navigation";`
);

// 2. Add state for delete dialog
const stateAnchor = "const [candidateToApply, setCandidateToApply] = useState<any | null>(null);";
const stateToAdd = `
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isCheckingDependencies, setIsCheckingDependencies] = useState(false);
    const [dependencyReport, setDependencyReport] = useState<DependencyReport | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const openDeleteDialog = async () => {
        if (!customFieldId) return;
        setIsDeleteDialogOpen(true);
        setIsCheckingDependencies(true);
        setDependencyReport(null);
        try {
            const report = await checkCustomFieldDependencies(customFieldId);
            setDependencyReport(report);
        } catch (e) {
            toast.error("Failed to check dependencies");
            setIsDeleteDialogOpen(false);
        } finally {
            setIsCheckingDependencies(false);
        }
    };

    const confirmDelete = async () => {
        if (!customFieldId) return;
        setIsDeleting(true);
        try {
            const res = await softDeleteCustomField(customFieldId);
            if (res.success) {
                toast.success("Field deleted");
                setIsDeleteDialogOpen(false);
                onOpenChange(false);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to delete field");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
        }
    };
`;
code = code.replace(stateAnchor, stateAnchor + "\n" + stateToAdd);

// 3. Add Delete button in header
const headerBadgeAnchor = `<h2 className="text-xl font-bold text-slate-900 leading-tight">
                                    {fieldName} <span className="text-slate-400 font-medium text-lg">({fieldNo || customFieldId})</span>
                                </h2>`;
const deleteButtonCode = `\n                                {customFieldId && fieldNo === 0 && (
                                    <Button variant="ghost" size="icon" onClick={openDeleteDialog} className="text-slate-400 hover:text-red-600 hover:bg-red-50 ml-2" title="Delete Custom Field">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}`;
code = code.replace(headerBadgeAnchor, headerBadgeAnchor + deleteButtonCode);

// 4. Add Dialog component
const dialogAnchor = "<ConfirmDeleteDialog open={!!candidateToApply}";
const dialogCode = `
            <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
                if (!isDeleting) setIsDeleteDialogOpen(open);
            }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Delete Custom Field</DialogTitle>
                        <DialogDescription className="sr-only">Confirm deletion of custom field</DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                        {isCheckingDependencies ? (
                            <div className="flex flex-col items-center justify-center py-6 text-slate-500">
                                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                                <p className="text-sm">Checking dependencies...</p>
                            </div>
                        ) : dependencyReport ? (
                            dependencyReport.canDelete ? (
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Are you sure you want to delete this custom field? <br/><br/>
                                    Deleting it will remove it from normal views and prevent it from being used in future questionnaires or mappings.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                                        <p className="font-semibold mb-2">This field cannot be deleted because it is currently in use.</p>
                                        <p>You must manually remove it from the following areas before deleting:</p>
                                    </div>
                                    <ul className="space-y-1 text-sm text-slate-700 pl-2">
                                        {dependencyReport.dependencies.referenceQuestionnaires > 0 && <li>• Used in <strong>{dependencyReport.dependencies.referenceQuestionnaires} Reference Questionnaire{dependencyReport.dependencies.referenceQuestionnaires === 1 ? '' : 's'}</strong></li>}
                                        {dependencyReport.dependencies.workingQuestionnaires > 0 && <li>• Used in <strong>{dependencyReport.dependencies.workingQuestionnaires} Working Questionnaire{dependencyReport.dependencies.workingQuestionnaires === 1 ? '' : 's'}</strong></li>}
                                        {dependencyReport.dependencies.engagementQuestionnaires > 0 && <li>• Mapped in <strong>{dependencyReport.dependencies.engagementQuestionnaires} Active Engagement{dependencyReport.dependencies.engagementQuestionnaires === 1 ? '' : 's'}</strong></li>}
                                        {dependencyReport.dependencies.clientProfilesWithData > 0 && <li>• Contains recorded data for <strong>{dependencyReport.dependencies.clientProfilesWithData} Client Profile{dependencyReport.dependencies.clientProfilesWithData === 1 ? '' : 's'}</strong></li>}
                                        {dependencyReport.dependencies.fiSchemaOverlays > 0 && <li>• Used in <strong>{dependencyReport.dependencies.fiSchemaOverlays} FI Schema Overlay{dependencyReport.dependencies.fiSchemaOverlays === 1 ? '' : 's'}</strong></li>}
                                    </ul>
                                </div>
                            )
                        ) : null}
                    </div>

                    <DialogFooter>
                        {!isCheckingDependencies && dependencyReport && (
                            dependencyReport.canDelete ? (
                                <>
                                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
                                    <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
                                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Delete Field
                                    </Button>
                                </>
                            ) : (
                                <Button onClick={() => setIsDeleteDialogOpen(false)}>Close</Button>
                            )
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
`;
code = code.replace(dialogAnchor, dialogCode + "\n" + dialogAnchor);

fs.writeFileSync(file, code);
