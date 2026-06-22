import React from "react";
import ReactCountryFlag from "react-country-flag";
import * as i18nIsoCountries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

i18nIsoCountries.registerLocale(enLocale);

interface JurisdictionBadgeProps {
    jurisdiction?: string | null;
}

export function JurisdictionBadge({ jurisdiction }: JurisdictionBadgeProps) {
    if (!jurisdiction || typeof jurisdiction !== "string" || jurisdiction.trim() === "") {
        return (
            <Badge variant="outline" className="text-xs font-normal text-slate-600 bg-slate-50 shrink-0">
                Unknown
            </Badge>
        );
    }

    const trimmed = jurisdiction.trim();
    // Match either exactly 2 letters, or 2 letters followed by a hyphen and alphanumeric characters.
    const isIsoLike = /^[A-Z]{2}(-[A-Z0-9]+)?$/i.test(trimmed);

    if (isIsoLike) {
        const codeUpper = trimmed.toUpperCase();
        const countryCode = codeUpper.substring(0, 2);
        const countryName = i18nIsoCountries.getName(countryCode, "en");

        if (countryName) {
            const isSubdivision = codeUpper.length > 2 && codeUpper.includes("-");
            const tooltipText = isSubdivision ? `${countryName} — ${codeUpper}` : countryName;

            return (
                <TooltipProvider>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-xs font-normal text-slate-600 shrink-0 cursor-default hover:bg-slate-100 transition-colors">
                                <ReactCountryFlag 
                                    countryCode={countryCode} 
                                    svg 
                                    style={{
                                        width: '1.2em',
                                        height: '1.2em',
                                        borderRadius: '2px',
                                        objectFit: 'cover'
                                    }}
                                />
                                <span>{codeUpper}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="text-[13px] font-medium">{tooltipText}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }
    }

    // Fallback for non-ISO strings or missing country name
    return (
        <Badge variant="outline" className="text-xs font-normal text-slate-600 bg-slate-50 shrink-0">
            {jurisdiction}
        </Badge>
    );
}
