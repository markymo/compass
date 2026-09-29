import { revalidatePath } from "next/cache";

/** Call after the membership write/transaction has committed. */
export function revalidateOrganizationMembership(orgId?: string | null) {
    if (!orgId) return;
    revalidatePath("/app/admin/organizations");
    revalidatePath(`/app/admin/organizations/${orgId}`);
    revalidatePath("/app/admin/users");
    revalidatePath(`/app/clients/${orgId}/team`);
    revalidatePath(`/app/s/${orgId}/team`);
}
