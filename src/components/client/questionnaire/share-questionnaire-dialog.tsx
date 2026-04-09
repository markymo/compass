"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Share2, Building2 } from "lucide-react";
import { getOtherEngagements, shareQuestionnaireLaterally } from "@/actions/questionnaire";
import { toast } from "sonner";

interface ShareQuestionnaireDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientLEId: string;
    currentEngagementId: string;
    questionnaireId: string;
    questionnaireName: string;
}

export function ShareQuestionnaireDialog({ open, onOpenChange, clientLEId, currentEngagementId, questionnaireId, questionnaireName }: ShareQuestionnaireDialogProps) {
    const [engagements, setEngagements] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [sharing, setSharing] = useState(false);

    useEffect(() => {
        if (open) {
            loadEngagements();
        } else {
            setSelectedIds([]); // reset when closed
        }
    }, [open]);

    async function loadEngagements() {
        setLoading(true);
        try {
            const res = await getOtherEngagements(clientLEId, currentEngagementId);
            if (res.success && res.data) {
                setEngagements(res.data);
            } else {
                toast.error(res.error || "Failed to load engagements");
            }
        } catch (e) {
            toast.error("Error loading engagements");
        } finally {
            setLoading(false);
        }
    }

    const handleToggle = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleShare = async () => {
        if (selectedIds.length === 0) return;

        setSharing(true);
        toast.loading(`Sharing "${questionnaireName}" with ${selectedIds.length} engagement(s)...`, { id: 'share-q' });

        try {
            const res = await shareQuestionnaireLaterally(questionnaireId, selectedIds);
            if (res.success) {
                toast.success(`Successfully shared questionnaire with ${res.count} engagement(s).`, { id: 'share-q' });
                onOpenChange(false);
            } else {
                toast.error(res.error || "Failed to share questionnaire", { id: 'share-q' });
            }
        } catch (e) {
            toast.error("Error sharing questionnaire", { id: 'share-q' });
        } finally {
            setSharing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-indigo-600" />
                        Share Lateral Copies
                    </DialogTitle>
                    <DialogDescription>
                        Duplicate this completed profile into other active engagements. The clone will share the same master data mappings, but status and comments will be reset.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        </div>
                    ) : engagements.length === 0 ? (
                        <div className="text-center p-4 text-slate-500 text-sm bg-slate-50 rounded-lg">
                            No other active engagements found for this LE.
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                            {engagements.map((eng) => (
                                <div key={eng.id} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleToggle(eng.id)}>
                                    <Checkbox 
                                        id={eng.id} 
                                        checked={selectedIds.includes(eng.id)}
                                        onCheckedChange={() => handleToggle(eng.id)}
                                        className="mt-0.5"
                                    />
                                    <div className="flex flex-col">
                                        <label htmlFor={eng.id} className="text-sm font-medium leading-none cursor-pointer">
                                            {eng.org.name}
                                        </label>
                                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                                            <Building2 className="w-3 h-3" />
                                            <span>Engagement ID: {eng.id.slice(0,8)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sharing}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleShare} 
                        disabled={sharing || selectedIds.length === 0 || loading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {sharing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sharing...
                            </>
                        ) : (
                            <>
                                <Share2 className="w-4 h-4 mr-2" />
                                Share with {selectedIds.length > 0 ? selectedIds.length : ''} Engagement{selectedIds.length !== 1 ? 's' : ''}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
