import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, Cell } from "recharts";
import { Trophy, Medal, Award, TrendingUp, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface RankingRow {
  course_id: string;
  course_name: string;
  total_points: number;
}

interface EventLeaderboard {
  event_id: string;
  event_name: string;
  last_updated: string | null;
  rows: { course_id: string; course_name: string; points: number }[];
}

const fetchEventLeaderboards = async (): Promise<EventLeaderboard[]> => {
  const [{ data: events, error: eErr }, { data: courses, error: cErr }, { data: scores, error: sErr }] = await Promise.all([
    supabase.from("events").select("id, name").order("name"),
    supabase.from("courses").select("id, name"),
    supabase.from("scores").select("event_id, course_id, points, updated_at"),
  ]);
  if (eErr) throw eErr;
  if (cErr) throw cErr;
  if (sErr) throw sErr;

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c.name]));

  return (events ?? [])
    .map((ev) => {
      const evScores = (scores ?? []).filter((s) => s.event_id === ev.id);
      const totals = new Map<string, number>();
      let lastUpdated: string | null = null;
      evScores.forEach((s) => {
        totals.set(s.course_id, (totals.get(s.course_id) ?? 0) + (s.points ?? 0));
        if (!lastUpdated || (s.updated_at && s.updated_at > lastUpdated)) {
          lastUpdated = s.updated_at;
        }
      });
      const rows = Array.from(totals.entries())
        .map(([course_id, points]) => ({
          course_id,
          course_name: courseMap.get(course_id) ?? "Unknown",
          points,
        }))
        .sort((a, b) => b.points - a.points);
      return { event_id: ev.id, event_name: ev.name, last_updated: lastUpdated, rows };
    })
    .filter((ev) => ev.rows.length > 0);
};

const fetchRankings = async (): Promise<RankingRow[]> => {
  const [{ data: courses, error: cErr }, { data: scores, error: sErr }] = await Promise.all([
    supabase.from("courses").select("id, name").order("name"),
    supabase.from("scores").select("course_id, points"),
  ]);
  if (cErr) throw cErr;
  if (sErr) throw sErr;

  const totals = new Map<string, number>();
  (scores ?? []).forEach((s) => {
    totals.set(s.course_id, (totals.get(s.course_id) ?? 0) + (s.points ?? 0));
  });

  return (courses ?? [])
    .map((c) => ({
      course_id: c.id,
      course_name: c.name,
      total_points: totals.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.total_points - a.total_points);
};

const podiumStyles = [
  { ring: "ring-gold/40", bg: "bg-gradient-gold", text: "text-accent-foreground", icon: Trophy, label: "1st" },
  { ring: "ring-silver/40", bg: "bg-silver", text: "text-foreground", icon: Medal, label: "2nd" },
  { ring: "ring-bronze/40", bg: "bg-bronze", text: "text-primary-foreground", icon: Award, label: "3rd" },
];

const barColors = ["hsl(var(--gold))", "hsl(var(--silver))", "hsl(var(--bronze))"];

export default function Dashboard() {
  useEffect(() => {
    document.title = "Intramurals Leaderboard · Dashboard";
    const meta = document.querySelector('meta[name="description"]');
    const content = "Live intramurals scoring leaderboard with course rankings and points totals.";
    if (meta) meta.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  const { data: rankings, isLoading } = useQuery({
    queryKey: ["rankings"],
    queryFn: fetchRankings,
  });

  const { data: eventBoards, isLoading: eventsLoading } = useQuery({
    queryKey: ["event-leaderboards"],
    queryFn: fetchEventLeaderboards,
  });

  const totals = useMemo(() => {
    const totalPoints = rankings?.reduce((s, r) => s + r.total_points, 0) ?? 0;
    return {
      courses: rankings?.length ?? 0,
      points: totalPoints,
      leader: rankings?.[0]?.course_name ?? "—",
    };
  }, [rankings]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-hero p-8 sm:p-12 text-primary-foreground shadow-elegant">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-primary-glow/40 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-semibold backdrop-blur">
            <TrendingUp className="h-3.5 w-3.5" />
            Live Leaderboard
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-bold tracking-tight">Pakusganay 2026</h1>
          <p className="mt-2 max-w-xl text-primary-foreground/85">
            Track every point. Crown the champion course.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Current Leader" value={totals.leader} icon={Trophy} accent />
        <StatCard label="Total Courses" value={totals.courses.toString()} icon={Users} />
        {/* <StatCard label="Total Points" value={totals.points.toLocaleString()} icon={TrendingUp} /> */}
      </section>

      {/* Podium */}
      {!isLoading && rankings && rankings.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Top 3</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {rankings.slice(0, 3).map((r, i) => {
              const s = podiumStyles[i];
              const Icon = s.icon;
              return (
                <div
                  key={r.course_id}
                  className={`rounded-2xl ring-2 ${s.ring} bg-card p-6 shadow-card transition-smooth hover:shadow-elegant hover:-translate-y-1`}
                >
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${s.bg} ${s.text}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                  </div>
                  <div className="mt-4 text-2xl font-bold">{r.course_name}</div>
                  <div className="mt-1 text-3xl font-extrabold text-primary">
                    {r.total_points} <span className="text-sm font-medium text-muted-foreground">pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Chart + Full ranking */}
      <section className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 bg-gradient-card">
          <CardHeader>
            <CardTitle>Points by Course</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[320px] w-full" />
            ) : !rankings || rankings.length === 0 ? (
              <EmptyState message="No data yet — add courses and scores to populate the chart." />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rankings} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="course_name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <RTooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Bar dataKey="total_points" radius={[8, 8, 0, 0]}>
                    {rankings.map((_, idx) => (
                      <Cell key={idx} fill={idx < 3 ? barColors[idx] : "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-gradient-card">
          <CardHeader>
            <CardTitle>Full Ranking</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !rankings || rankings.length === 0 ? (
              <EmptyState message="No courses yet." />
            ) : (
              <ol className="space-y-2">
                {rankings.map((r, i) => (
                  <li
                    key={r.course_id}
                    className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3 transition-smooth hover:bg-secondary"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${
                          i === 0
                            ? "bg-gradient-gold text-accent-foreground"
                            : i === 1
                            ? "bg-silver text-foreground"
                            : i === 2
                            ? "bg-bronze text-primary-foreground"
                            : "bg-secondary text-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="font-medium">{r.course_name}</span>
                    </div>
                    <span className="font-bold text-primary">{r.total_points} pts</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Per-event leaderboards */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold">Leaderboards by Event</h2>
            <p className="text-sm text-muted-foreground">
              Only events with recorded scores are shown. Events updated within the last 24 hours are marked recent.
            </p>
          </div>
        </div>

        {eventsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : !eventBoards || eventBoards.length === 0 ? (
          <Card className="bg-gradient-card">
            <CardContent className="p-6">
              <EmptyState message="No scores recorded yet. Add scores from the admin panel to see event leaderboards." />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {eventBoards.map((ev) => {
              const isRecent =
                ev.last_updated &&
                Date.now() - new Date(ev.last_updated).getTime() <= 24 * 60 * 60 * 1000;
              return (
                <Card key={ev.event_id} className="bg-gradient-card transition-smooth hover:shadow-elegant">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{ev.event_name}</CardTitle>
                      {isRecent && (
                        <Badge className="bg-gradient-gold text-accent-foreground hover:opacity-90 gap-1">
                          <Clock className="h-3 w-3" />
                          Recent
                        </Badge>
                      )}
                    </div>
                    {ev.last_updated && (
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(ev.last_updated).toLocaleString()}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-2">
                      {ev.rows.map((r, i) => (
                        <li
                          key={r.course_id}
                          className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold shrink-0 ${
                                i === 0
                                  ? "bg-gradient-gold text-accent-foreground"
                                  : i === 1
                                  ? "bg-silver text-foreground"
                                  : i === 2
                                  ? "bg-bronze text-primary-foreground"
                                  : "bg-secondary text-foreground"
                              }`}
                            >
                              {i + 1}
                            </span>
                            <span className="text-sm font-medium truncate">{r.course_name}</span>
                          </div>
                          <span className="text-sm font-bold text-primary shrink-0">{r.points} pts</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card className="bg-gradient-card transition-smooth hover:shadow-elegant">
      <CardContent className="flex items-center gap-4 p-6">
        <div
          className={`grid h-12 w-12 place-items-center rounded-xl ${
            accent ? "bg-gradient-gold text-accent-foreground" : "bg-secondary text-primary"
          }`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-xl font-bold truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid place-items-center h-[200px] text-center text-muted-foreground">
      <div>
        <Trophy className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}
