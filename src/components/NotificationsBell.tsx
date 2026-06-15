import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function NotificationsBell() {
  const qc = useQueryClient();
  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const unread = notifs.filter((n) => !n.read).length;

  const markAll = useMutation({
    mutationFn: async () => {
      const ids = notifs.filter((n) => !n.read).map((n) => n.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from("notifications").update({ read: true }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="font-semibold text-sm">Notifications</div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAll.mutate()}>
              <Check className="h-3 w-3 mr-1" />Mark all
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-auto">
          {notifs.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">No notifications</p>
          ) : notifs.map((n) => (
            <div key={n.id} className={`px-3 py-2 border-b border-border last:border-0 ${n.read ? "" : "bg-muted/40"}`}>
              <div className="text-sm font-medium">{n.title}</div>
              {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
              <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
