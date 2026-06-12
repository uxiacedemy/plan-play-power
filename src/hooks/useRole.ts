import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/staff.functions";
import { useAuth } from "./useAuth";

export type AppRole = "owner" | "manager" | "cashier";

export function useRole() {
  const { session } = useAuth();
  const fetchRole = useServerFn(getMyRole);
  const { data, isLoading } = useQuery({
    queryKey: ["my-role", session?.user?.id],
    queryFn: () => fetchRole(),
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
  });
  return {
    role: (data?.role ?? "owner") as AppRole,
    loading: isLoading,
    canManageInventory: data?.role !== "cashier",
    isOwner: data?.role === "owner" || !data,
  };
}
