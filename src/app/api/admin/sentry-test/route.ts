import { NextRequest, NextResponse } from "next/server";
import { getIdentity } from "@/lib/auth";
import { Action, ensureAuthorization } from "@/lib/auth/permissions";
import * as Sentry from "@sentry/nextjs";

/**
 * Protected diagnostic endpoint for Phase 0 Sentry error & trace verification.
 * Restricted to Staging / Dev by default. Requires ENABLE_SENTRY_DIAGNOSTICS=true in Prod.
 * Strictly restricted to System Admin users (Action.SYSTEM_VIEW_TELEMETRY).
 */
export async function POST(req: NextRequest) {
    try {
        const isStaging = process.env.APP_ENV === "staging" || process.env.NODE_ENV === "development";
        const isDiagnosticsEnabled = process.env.ENABLE_SENTRY_DIAGNOSTICS === "true";

        if (!isStaging && !isDiagnosticsEnabled) {
            return NextResponse.json(
                { error: "Forbidden: Sentry diagnostic endpoint is disabled in production. Set ENABLE_SENTRY_DIAGNOSTICS=true to enable." },
                { status: 403 }
            );
        }

        try {
            await ensureAuthorization(Action.SYSTEM_VIEW_TELEMETRY, {});
        } catch {
            return NextResponse.json({ error: "Forbidden: System Admin required" }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const testType = body.type || "server";

        if (testType === "server") {
            const err = new Error("[Sentry Verification] Controlled Staging Server Exception");
            Sentry.captureException(err);
            return NextResponse.json({
                status: "captured",
                type: "server_error",
                message: "Controlled server exception emitted to Sentry",
            });
        }

        if (testType === "probe") {
            return await Sentry.startSpan(
                {
                    name: "probe.sentry_test.verification",
                    op: "test.probe",
                    attributes: {
                        "probe.name": "sentry_test.verification",
                        "probe.type": "verification",
                    },
                },
                async (span) => {
                    span.setStatus({ code: 1, message: "ok" });
                    return NextResponse.json({
                        status: "captured",
                        type: "probe_span",
                        message: "Controlled test span emitted to Sentry",
                    });
                }
            );
        }

        return NextResponse.json({
            status: "ready",
            usage: "POST { \"type\": \"server\" | \"probe\" } (System Admin only)",
        });
    } catch (e: unknown) {
        Sentry.captureException(e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
