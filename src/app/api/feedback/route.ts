import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST /api/feedback – Save a new note
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { pageUrl, note, category, authorEmail, authorName, assignedToId, sessionTag } = body;

        console.log(`[FEEDBACK_POST] Creating note for ${pageUrl}`);

        if (!pageUrl || !note) {
            return NextResponse.json({ error: "pageUrl and note are required" }, { status: 400 });
        }

        const feedbackNote = await prisma.feedbackNote.create({
            data: {
                pageUrl,
                note,
                category: category || "general",
                authorEmail: authorEmail || null,
                authorName: authorName || null,
                assignedToId: assignedToId || null,
                sessionTag: sessionTag || null,
            }
        });

        return NextResponse.json({ ok: true, id: feedbackNote.id });
    } catch (error: any) {
        console.error(`[FEEDBACK_POST] Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET /api/feedback – Fetch all notes (optionally filtered by sessionTag)
export async function GET(req: NextRequest) {
    try {
        const sessionTag = req.nextUrl.searchParams.get("sessionTag") || undefined;

        const notes = await prisma.feedbackNote.findMany({
            where: sessionTag ? { sessionTag } : {},
            orderBy: { createdAt: "asc" }
        });

        return NextResponse.json({ notes });
    } catch (error: any) {
        console.error(`[FEEDBACK_GET] Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/feedback?id=xxx – Delete a single note
export async function DELETE(req: NextRequest) {
    try {
        const id = req.nextUrl.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

        console.log(`[FEEDBACK_DELETE] Deleting ${id}`);
        await prisma.feedbackNote.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error(`[FEEDBACK_DELETE] Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH /api/feedback – Update note (status)
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, status } = body;

        console.log(`[FEEDBACK_PATCH] Updating ${id} to ${status}`);

        if (!id || !status) {
            return NextResponse.json({ error: "id and status are required" }, { status: 400 });
        }

        await prisma.feedbackNote.update({
            where: { id },
            data: {
                status,
                closedAt: status === 'closed' ? new Date() : null
            }
        });

        console.log(`[FEEDBACK_PATCH] Success for ${id}`);
        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error(`[FEEDBACK_PATCH] Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
