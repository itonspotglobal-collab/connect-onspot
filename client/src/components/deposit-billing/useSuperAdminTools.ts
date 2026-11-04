import { useHiringOverrideCapability } from "@/components/admin-hiring-overrides/OverrideControls";
import { ApiRequestError } from "@/lib/queryClient";

export function useSuperAdminTools() {
  // canRevert is issued only for database-confirmed Admins with a NULL sub-role.
  // canManage deliberately includes all Admins and must not grant financial tools.
  const capability = useHiringOverrideCapability();
  return capability.data?.canRevert === true;
}

export function depositToolError(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError && error.code === "SUPER_ADMIN_REQUIRED")
    return error.data?.message || error.message;
  return fallback;
}
