import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Course {
  id: string;
  name: string;
  image_url: string | null;
  color: string | null;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#64748b", "#0f172a", "#ffffff",
];

export default function AdminCourses() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async (): Promise<Course[]> => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, image_url, color")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["rankings"] });
    qc.invalidateQueries({ queryKey: ["scores-with-relations"] });
    qc.invalidateQueries({ queryKey: ["event-leaderboards"] });
  };

  const createMut = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabase.from("courses").insert({ name: n.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Course added");
      setName("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Course deleted");
      setDeleteId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Manage Courses</h1>
        <p className="text-muted-foreground mt-1">
          Add, rename, or remove courses. Set an image and a color for each.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add new course</CardTitle>
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
              placeholder="e.g. BSIT"
              disabled={createMut.isPending}
            />
            <Button type="submit" disabled={createMut.isPending || !name.trim()}>
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Add</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All courses ({courses?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !courses || courses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No courses yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {courses.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <div
                    className="h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-border grid place-items-center text-xs font-bold"
                    style={{
                      background: c.color ?? "hsl(var(--secondary))",
                      color: c.color ? "#fff" : undefined,
                    }}
                  >
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                    ) : (
                      c.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteId(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditCourseDialog
          course={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course?</AlertDialogTitle>
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

function EditCourseDialog({
  course,
  onClose,
  onSaved,
}: {
  course: Course;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(course.name);
  const [color, setColor] = useState(course.color ?? "#3b82f6");
  const [imageUrl, setImageUrl] = useState<string | null>(course.image_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${course.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("course-images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("course-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("courses")
        .update({ name: name.trim(), color, image_url: imageUrl })
        .eq("id", course.id);
      if (error) throw error;
      toast.success("Course updated");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit course</DialogTitle>
          <DialogDescription>Update the course name, image, and color.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course-name">Name</Label>
            <Input id="course-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Image</Label>
            <div className="flex items-center gap-3">
              <div
                className="h-20 w-20 shrink-0 rounded-lg overflow-hidden border border-border grid place-items-center text-xs font-bold"
                style={{ background: color, color: "#fff" }}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                  />
                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                  >
                    <span>
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {imageUrl ? "Replace" : "Upload"}
                    </span>
                  </Button>
                </label>
                {imageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setImageUrl(null)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 rounded border border-border cursor-pointer bg-transparent"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-10 gap-1.5 pt-1">
              {PRESET_COLORS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setColor(p)}
                  className={`h-6 w-6 rounded border ${
                    color.toLowerCase() === p.toLowerCase()
                      ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                      : "border-border"
                  }`}
                  style={{ background: p }}
                  aria-label={`Pick ${p}`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
