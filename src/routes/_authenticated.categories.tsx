import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categories — MboaPOS" }] }),
  component: CategoriesPage,
});

type Cat = { id: string; name: string };

function CategoriesPage() {
  const qc = useQueryClient();
  const { canManageInventory } = useRole();
  const [name, setName] = useState("");

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name").order("name");
      if (error) throw error;
      return data as Cat[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const v = name.trim();
      if (!v) throw new Error("Name required");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("categories").insert({ user_id: u.user.id, name: v });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e) => {
      const m = e instanceof Error ? e.message : "Failed";
      toast.error(/duplicate|unique/i.test(m) ? "Category already exists" : m);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-sm text-muted-foreground">{cats.length} categories</p>
      </div>

      {canManageInventory && (
        <form
          onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
          className="flex gap-2"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category name…"
          />
          <Button type="submit" disabled={add.isPending}><Plus className="h-4 w-4" /></Button>
        </form>
      )}

      {cats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No categories yet.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {cats.map((c) => (
            <div key={c.id} className="flex items-center gap-2 p-3 border-b border-border last:border-0">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{c.name}</span>
              {canManageInventory && (
                <Button
                  variant="ghost" size="icon" className="text-destructive h-7 w-7"
                  onClick={() => { if (confirm(`Delete ${c.name}?`)) remove.mutate(c.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
