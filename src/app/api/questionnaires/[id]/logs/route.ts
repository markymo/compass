import { NextRequest } from "next/server";
import { getQuestionnaireById } from "@/actions/questionnaire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    // URL is /api/questionnaires/[id]/logs
    const id = pathParts[pathParts.length - 2];

    console.log(`[SSE-LOGS] NEW REQUEST: URL=${url.pathname}, Extracted ID=${id}`);

    if (!id || id === 'logs' || id === 'questionnaires') {
        console.error("[SSE-LOGS] Failed to extract valid ID from path:", url.pathname);
        return new Response("Invalid ID", { status: 400 });
    }

    const { searchParams } = url;
    const lastIndexParam = searchParams.get("lastIndex");
    let lastIndex = lastIndexParam ? parseInt(lastIndexParam, 10) : 0;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            let isClosed = false;

            const sendEvent = (event: string, data: any) => {
                if (isClosed) return;
                try {
                    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(payload));
                } catch (e) {
                    isClosed = true;
                }
            };

            const sendComment = (comment: string) => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(`: ${comment}\n\n`));
                } catch (e) {
                    isClosed = true;
                }
            };

            sendComment("connection established");
            let lastHeartbeat = Date.now();

            const poll = async () => {
                while (!isClosed && !request.signal.aborted) {
                    try {
                        const fresh = await getQuestionnaireById(id, Date.now());
                        if (!fresh) {
                            console.warn(`[SSE-LOGS] Questionnaire ${id} not found in poll.`);
                            isClosed = true;
                            break;
                        }

                        const logs = (fresh.processingLogs as any[]) || [];
                        if (logs.length > lastIndex) {
                            console.log(`[SSE-LOGS] Sending ${logs.length - lastIndex} logs for ${id}`);
                            sendEvent("log_appended", logs.slice(lastIndex));
                            lastIndex = logs.length;
                        }

                        if (Date.now() - lastHeartbeat > 15000) {
                            sendComment("heartbeat");
                            lastHeartbeat = Date.now();
                        }
                    } catch (e) {
                        console.error("[SSE-LOGS] Poll error:", e);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                console.log(`[SSE-LOGS] Closing stream for ${id}`);
                try { controller.close(); } catch (e) {}
            };

            poll();

            request.signal.addEventListener("abort", () => {
                isClosed = true;
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    });
}
