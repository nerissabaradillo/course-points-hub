import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface CrudItem {
  id: string;
  name: string;
}

interface Props {
  table: "courses" | "events";
  title: string;
  description: string;
  itemLabel: string;
  placeholder: string;
}

export default function CrudListManager({ table, title, description, itemLabel, placeholder }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: [table],
    queryFn: async (): Promise<CrudItem[]> => {
      const { data, error } = await supabase.from(table).select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [table] });
    qc.invalidateQueries({ queryKey: ["rankings"] });
    qc.invalidateQueries({ queryKey: ["scores-with-relations"] });
  };

  const createMut = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabase.from(table).insert({ name: n.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${itemLabel} added`);
      setName("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, n }: { id: string; n: string }) => {
      const { error } = await supabase.from(table).update({ name: n.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${itemLabel} updated`);
      setEditingId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${itemLabel} deleted`);
      setDeleteId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add new {itemLabel.toLowerCase()}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              createMut.mutate(name);
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholder}
              disabled={createMut.isPending}
            />
            <Button type="submit" disabled={createMut.isPending || !name.trim()}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Add</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All {itemLabel.toLowerCase()}s ({items?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !items || items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No {itemLabel.toLowerCase()}s yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-2 py-3">
                  {editingId === it.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") updateMut.mutate({ id: it.id, n: editName });
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => updateMut.mutate({ id: it.id, n: editName })}
                        disabled={updateMut.isPending || !editName.trim()}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-medium">{it.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(it.id);
                          setEditName(it.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(it.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {itemLabel.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also delete any associated scores. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
