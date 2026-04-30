import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Loader2, Trophy, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
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
  mp_points: number | null;
  br_points: number | null;
  course_id: string;
  event_id: string;
  courses: { name: string; color: string | null } | null;
}

const isCodmEvent = (name?: string | null) =>
  !!name && /codm/i.test(name);

export default function AdminScores() {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState<string>("");
  const [courseId, setCourseId] = useState("");
  const [points, setPoints] = useState("");
  const [mpPoints, setMpPoints] = useState("");
  const [brPoints, setBrPoints] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPoints, setEditPoints] = useState("");
  const [editMp, setEditMp] = useState("");
  const [editBr, setEditBr] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, color")
        .order("name");
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

  // Auto-select first event when loaded
  if (!eventId && events && events.length > 0) {
    setEventId(events[0].id);
  }

  const { data: scores, isLoading } = useQuery({
    queryKey: ["scores-with-relations"],
    queryFn: async (): Promise<ScoreRow[]> => {
      const { data, error } = await supabase
        .from("scores")
        .select("id, points, mp_points, br_points, course_id, event_id, courses(name, color)")
        .order("points", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ScoreRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["scores-with-relations"] });
    qc.invalidateQueries({ queryKey: ["rankings"] });
    qc.invalidateQueries({ queryKey: ["event-leaderboards"] });
  };

  const isCodm = isCodmEvent(events?.find((e) => e.id === eventId)?.name);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!courseId || !eventId) throw new Error("All fields are required");

      let pts: number;
      let mp: number | null = null;
      let br: number | null = null;

      if (isCodm) {
        mp = parseFloat(mpPoints);
        br = parseFloat(brPoints);
        if (isNaN(mp) || isNaN(br)) throw new Error("Enter both MP and BR points");
        pts = mp + br;
      } else {
        pts = parseFloat(points);
        if (isNaN(pts)) throw new Error("Enter points");
      }

      const { data: existing, error: checkErr } = await supabase
        .from("scores")
        .select("id")
        .eq("event_id", eventId)
        .eq("course_id", courseId)
        .maybeSingle();
      if (checkErr) throw checkErr;
      if (existing) {
        throw new Error("This course already has a score for this event. Edit it instead.");
      }
      const { error } = await supabase.from("scores").insert({
        course_id: courseId,
        event_id: eventId,
        points: pts,
        mp_points: mp,
        br_points: br,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Score added");
      setPoints("");
      setMpPoints("");
      setBrPoints("");
      setCourseId("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async (args: { id: string; pts: number; mp?: number | null; br?: number | null }) => {
      const payload: Record<string, number | null> = { points: args.pts };
      if (args.mp !== undefined) payload.mp_points = args.mp;
      if (args.br !== undefined) payload.br_points = args.br;
      const { error } = await supabase.from("scores").update(payload).eq("id", args.id);
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
  const selectedEvent = events?.find((e) => e.id === eventId);

  // Filter scores to selected event only, sorted by points desc, with dense ranks (ties share rank)
  const eventScores = useMemo(
    () => (scores ?? []).filter((s) => s.event_id === eventId),
    [scores, eventId],
  );

  const rankedEventScores = useMemo(() => {
    let lastPts: number | null = null;
    let lastRank = 0;
    return eventScores.map((s, idx) => {
      const rank = lastPts !== null && s.points === lastPts ? lastRank : idx + 1;
      lastPts = s.points;
      lastRank = rank;
      return { ...s, rank };
    });
  }, [eventScores]);

  // Courses already scored in this event — hidden from the add-form picker
  const scoredCourseIds = useMemo(
    () => new Set(eventScores.map((s) => s.course_id)),
    [eventScores],
  );
  const availableCourses = useMemo(
    () => (courses ?? []).filter((c) => !scoredCourseIds.has(c.id)),
    [courses, scoredCourseIds],
  );
  const allCoursesScored =
    !!courses?.length && availableCourses.length === 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Manage Scores</h1>
        <p className="text-muted-foreground mt-1">
          Pick an event, then add scores per course.
        </p>
      </div>

      {noCoursesOrEvents ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Add at least one course and one event first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select event</CardTitle>
              <CardDescription>All actions below apply to this event.</CardDescription>
            </CardHeader>
            <CardContent>
              <Popover open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={eventPickerOpen}
                    className="max-w-sm w-full justify-between font-normal"
                  >
                    {selectedEvent?.name ?? "Choose an event"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandInput placeholder="Search events..." />
                    <CommandList>
                      <CommandEmpty>No event found.</CommandEmpty>
                      <CommandGroup>
                        {events?.map((ev) => (
                          <CommandItem
                            key={ev.id}
                            value={ev.name}
                            onSelect={() => {
                              setEventId(ev.id);
                              setCourseId("");
                              setEventPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                eventId === ev.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {ev.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Add score to <span className="text-primary">{selectedEvent?.name}</span>
              </CardTitle>
              <CardDescription>
                Each course can only have one score per event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allCoursesScored ? (
                <p className="text-sm text-muted-foreground">
                  Every course already has a score for this event. Edit existing entries below.
                </p>
              ) : (
                <form
                  className="grid gap-3 sm:grid-cols-[1fr_140px_auto]"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createMut.mutate();
                  }}
                >
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCourses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    step="any"
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    placeholder="Points"
                  />

                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    <span className="ml-2">Save</span>
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                {selectedEvent?.name} — entries ({eventScores.length})
              </CardTitle>
              <CardDescription>Ranked by points (highest first).</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-6 text-sm text-muted-foreground">Loading…</p>
              ) : eventScores.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground text-center">
                  No scores recorded for this event yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">#</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="w-[140px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankedEventScores.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {s.rank}
                        </TableCell>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full border"
                              style={{ backgroundColor: s.courses?.color ?? "transparent" }}
                            />
                            {s.courses?.name ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {editingId === s.id ? (
                            <Input
                              type="number"
                              step="any"
                              value={editPoints}
                              onChange={(e) => setEditPoints(e.target.value)}
                              className="w-24 ml-auto"
                              autoFocus
                            />
                          ) : (
                            <span className="font-bold text-primary tabular-nums">{s.points}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingId === s.id ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                onClick={() => {
                                  const pts = parseFloat(editPoints);
                                  if (isNaN(pts)) return toast.error("Enter a number");
                                  updateMut.mutate({ id: s.id, pts });
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                              >
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
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteId(s.id)}
                              >
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
        </>
      )}

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
