"use server"

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { AdminTodoStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Fetch all admin todos
 */
export async function getAdminTodos() {
    const { userId } = await auth();
    if (!userId) return []; // Require auth

    // In a real app, check for 'ADMIN' role here.

    try {
        const todos = await prisma.adminTodo.findMany({
            where: {
                isDeleted: false,
                isArchived: false
            },
            orderBy: { createdAt: 'desc' },
            include: {
                assignedToUser: true,
                createdByUser: true,
                comments: {
                    include: { user: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        // Map to frontend friendly shape if needed, or return direct
        // Frontend expects: id, title, status, description, dueDate, assignee..., comments...
        return todos.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description || "",
            status: t.status,
            dueDate: t.dueDate,
            assignedTo: t.assignedToUser ? {
                id: t.assignedToUser.id,
                name: t.assignedToUser.name || t.assignedToUser.email,
                image: null
            } : undefined,
            createdBy: {
                id: t.createdByUser.id,
                name: t.createdByUser.name || t.createdByUser.email
            },
            createdAt: t.createdAt,
            comments: t.comments.map(c => ({
                id: c.id,
                text: c.text,
                author: c.user.name || c.user.email,
                createdAt: c.createdAt,
                userId: c.userId
            }))
        }));

    } catch (e) {
        console.error("Failed to fetch todos", e);
        return [];
    }
}

/**
 * Create a new admin todo
 */
export async function createAdminTodo(data: { title: string; description?: string; dueDate?: Date; assignedToUserId?: string; status?: AdminTodoStatus }) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        const todo = await prisma.adminTodo.create({
            data: {
                title: data.title,
                description: data.description,
                status: data.status || "BACKLOG", // Default to BACKLOG
                dueDate: data.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to +7 days
                assignedToUserId: data.assignedToUserId,
                createdByUserId: userId
            }
        });

        revalidatePath("/(platform)/app/admin/todo", "page");
        return { success: true, todo };
    } catch (e) {
        console.error("Create todo failed", e);
        return { success: false, error: "Failed to create task" };
    }
}

/**
 * Update todo status (Drag and Drop)
 */
export async function updateAdminTodoStatus(id: string, status: AdminTodoStatus) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        await prisma.adminTodo.update({
            where: { id },
            data: { status }
        });

        revalidatePath("/(platform)/app/admin/todo", "page");
        return { success: true };
    } catch (e) {
        console.error("Update status failed", e);
        return { success: false, error: "Failed to update status" };
    }
}

/**
 * Update todo details
 */
export async function updateAdminTodo(id: string, data: { title?: string; description?: string; dueDate?: Date; assignedToUserId?: string }) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        await prisma.adminTodo.update({
            where: { id },
            data: {
                ...data
            }
        });

        revalidatePath("/(platform)/app/admin/todo", "page");
        return { success: true };
    } catch (e) {
        console.error("Update details failed", e);
        return { success: false, error: "Failed to update details" };
    }
}

/**
 * Add comment
 */
export async function addAdminTodoComment(todoId: string, text: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        const comment = await prisma.adminTodoComment.create({
            data: {
                adminTodoId: todoId,
                text,
                userId
            },
            include: { user: true }
        });

        revalidatePath("/(platform)/app/admin/todo", "page");
        return {
            success: true,
            comment: {
                id: comment.id,
                text: comment.text,
                author: comment.user.name || "User",
                createdAt: comment.createdAt,
                userId: comment.userId
            }
        };
    } catch (e) {
        console.error("Add comment failed", e);
        return { success: false, error: "Failed to add comment" };
    }
}

/**
 * Get all system admins for assignment lookup
 */
export async function getSystemAdmins() {
    const { userId } = await auth();
    if (!userId) return [];

    try {
        // 1. Find the System Admin Organization
        const systemOrg = await prisma.organization.findFirst({
            where: {
                types: { has: "SYSTEM" }
            },
            select: { id: true }
        });

        if (!systemOrg) {
            console.warn("No System Admin organization found.");
            return [];
        }

        // 2. Find Members of this Org
        const memberships = await prisma.membership.findMany({
            where: {
                organizationId: systemOrg.id
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        // 3. Map to Users
        const admins = memberships.map(m => ({
            id: m.user.id,
            name: m.user.name || m.user.email
        })).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        return admins;
    } catch (e) {
        console.error("Failed to fetch admins", e);
        return [];
    }
}

/**
 * Soft delete a todo
 */
export async function deleteAdminTodo(id: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        await prisma.adminTodo.update({
            where: { id },
            data: { isDeleted: true }
        });

        revalidatePath("/(platform)/app/admin/todo", "page");
        return { success: true };
    } catch (e) {
        console.error("Delete failed", e);
        return { success: false, error: "Failed to delete task" };
    }
}

/**
 * Archive a todo
 */
export async function archiveAdminTodo(id: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        await prisma.adminTodo.update({
            where: { id },
            data: { isArchived: true }
        });

        revalidatePath("/(platform)/app/admin/todo", "page");
        return { success: true };
    } catch (e) {
        console.error("Archive failed", e);
        return { success: false, error: "Failed to archive task" };
    }
}
