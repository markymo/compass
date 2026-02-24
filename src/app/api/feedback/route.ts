import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST /api/feedback – Save a new note
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { pageUrl, note, category, authorEmail, sessionTag } = body;

    if (!pageUrl || !note) {
        return NextResponse.json({ error: "pageUrl and note are required" }, { status: 400 });
    }

    const feedbackNote = await prisma.feedbackNote.create({
        data: {
            pageUrl,
            note,
            category: category || "general",
            authorEmail: authorEmail || null,
            sessionTag: sessionTag || null,
        }
    });

    return NextResponse.json({ ok: true, id: feedbackNote.id });
}

// GET /api/feedback – Fetch all notes (optionally filtered by sessionTag)
export async function GET(req: NextRequest) {
    const sessionTag = req.nextUrl.searchParams.get("sessionTag") || undefined;

    const notes = await prisma.feedbackNote.findMany({
        where: sessionTag ? { sessionTag } : {},
        orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({ notes });
}

// DELETE /api/feedback?id=xxx – Delete a single note
export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await prisma.feedbackNote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
