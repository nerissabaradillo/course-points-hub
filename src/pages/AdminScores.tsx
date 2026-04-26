import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface ScoreRow {
  id: string;
  points: number;
  course_id: string;
  event_id: string;
  courses: { name: string } | null;
  events: { name: string } | null;
}

export default function AdminScores() {
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState("");
  const [eventId, setEventId] = useState("");
  const [points, setPoints] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPoints, setEditPoints] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: scores, isLoading } = useQuery({
    queryKey: ["scores-with-relations"],
    queryFn: async (): Promise<ScoreRow[]> => {
      const { data, error } = await supabase
        .from("scores")
        .select("id, points, course_id, event_id, courses(name), events(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ScoreRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["scores-with-relations"] });
    qc.invalidateQueries({ queryKey: ["rankings"] });
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const pts = parseInt(points, 10);
      if (!courseId || !eventId || isNaN(pts)) throw new Error("All fields are required");
      const { error } = await supabase.from("scores").insert({
        course_id: courseId,
        event_id: eventId,
        points: pts,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Score added");
      setPoints("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, pts }: { id: string; pts: number }) => {
      const { error } = await supabase.from("scores").update({ points: pts }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Score updated");
      setEditingId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Score deleted");
      setDeleteId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const noCoursesOrEvents = !courses?.length || !events?.length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Manage Scores</h1>
        <p className="text-muted-foreground mt-1">
          Record points each course earns per event. Multiple entries per course/event are allowed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record a new score</CardTitle>
        </CardHeader>
        <CardContent>
          {noCoursesOrEvents && (
            <p className="text-sm text-muted-foreground mb-4">
              Add at least one course and one event first.
            </p>
          )}
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_120px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate();
            }}
          >
            <Select value={courseId} onValueChange={setCourseId} disabled={noCoursesOrEvents}>
              <SelectTrigger>
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                {courses?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={eventId} onValueChange={setEventId} disabled={noCoursesOrEvents}>
              <SelectTrigger>
                <SelectValue placeholder="Event" />
              </SelectTrigger>
              <SelectContent>
                {events?.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {ev.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="Points"
              disabled={noCoursesOrEvents}
            />

            <Button type="submit" disabled={createMut.isPending || noCoursesOrEvents}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-2">Save</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All entries ({scores?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : !scores || scores.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No scores recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="w-[140px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.courses?.name ?? "—"}</TableCell>
                    <TableCell>{s.events?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {editingId === s.id ? (
                        <Input
                          type="number"
                          value={editPoints}
                          onChange={(e) => setEditPoints(e.target.value)}
                          className="w-24 ml-auto"
                          autoFocus
                        />
                      ) : (
                        <span className="font-bold text-primary">{s.points}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === s.id ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            onClick={() => {
                              const pts = parseInt(editPoints, 10);
                              if (isNaN(pts)) return toast.error("Enter a number");
                              updateMut.mutate({ id: s.id, pts });
                            }}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(s.id);
                              setEditPoints(String(s.points));
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteId(s.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete score entry?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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
