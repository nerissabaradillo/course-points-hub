import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, Cell, Legend } from "recharts";
import { Trophy, Medal, Award, TrendingUp, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import nemsuLogo from "@/assets/nemsu-logo.png";
import pakusganayBanner from "@/assets/pakusganay-2026-banner.png";


interface RankingRow {
  course_id: string;
  course_name: string;
  course_image: string | null;
  course_color: string | null;
  total_points: number;
}

interface EventLeaderboard {
  event_id: string;
  event_name: string;
  last_updated: string | null;
  rows: {
    course_id: string;
    course_name: string;
    course_image: string | null;
    course_color: string | null;
    points: number;
  }[];
}

const fetchEventLeaderboards = async (): Promise<EventLeaderboard[]> => {
  const [{ data: events, error: eErr }, { data: courses, error: cErr }, { data: scores, error: sErr }] = await Promise.all([
    supabase.from("events").select("id, name").order("name"),
    supabase.from("courses").select("id, name, image_url, color"),
    supabase.from("scores").select("event_id, course_id, points, updated_at"),
  ]);
  if (eErr) throw eErr;
  if (cErr) throw cErr;
  if (sErr) throw sErr;

  const courseMap = new Map(
    (courses ?? []).map((c) => [c.id, { name: c.name, image: c.image_url, color: c.color }])
  );

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
        .map(([course_id, points]) => {
          const c = courseMap.get(course_id);
          return {
            course_id,
            course_name: c?.name ?? "Unknown",
            course_image: c?.image ?? null,
            course_color: c?.color ?? null,
            points,
          };
        })
        .sort((a, b) => b.points - a.points);
      return { event_id: ev.id, event_name: ev.name, last_updated: lastUpdated, rows };
    })
    .filter((ev) => ev.rows.length > 0);
};

const fetchRankings = async (): Promise<RankingRow[]> => {
  const [{ data: courses, error: cErr }, { data: scores, error: sErr }] = await Promise.all([
    supabase.from("courses").select("id, name, image_url, color").order("name"),
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
      course_image: c.image_url,
      course_color: c.color,
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

// Dense ranking: items with equal value share the same rank (1, 2, 2, 3)
function computeRanks<T>(items: T[], getValue: (item: T) => number): number[] {
  let lastVal: number | null = null;
  let lastRank = 0;
  return items.map((item, idx) => {
    const v = getValue(item);
    const rank = lastVal !== null && v === lastVal ? lastRank : idx + 1;
    lastVal = v;
    lastRank = rank;
    return rank;
  });
}

const rankSuffix = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

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

  // Build stacked breakdown: one row per course, one key per event
  const breakdown = useMemo(() => {
    if (!rankings || !eventBoards) return { data: [], events: [] as { id: string; name: string }[] };
    const events = eventBoards.map((ev) => ({ id: ev.event_id, name: ev.event_name }));
    const data = rankings.map((r) => {
      const row: Record<string, string | number> = {
        course_name: r.course_name,
        total_points: r.total_points,
      };
      eventBoards.forEach((ev) => {
        const found = ev.rows.find((x) => x.course_id === r.course_id);
        row[ev.event_name] = found?.points ?? 0;
      });
      return row;
    });
    return { data, events };
  }, [rankings, eventBoards]);

  // Dense ranks for overall rankings (ties share rank)
  const overallRanks = useMemo(
    () => (rankings ? computeRanks(rankings, (r) => r.total_points) : []),
    [rankings],
  );

  // Dense ranks per event leaderboard
  const eventRanks = useMemo(
    () =>
      (eventBoards ?? []).map((ev) => computeRanks(ev.rows, (r) => r.points)),
    [eventBoards],
  );

  // Distinct HSL colors for events (cycled around the wheel)
  const eventColor = (idx: number) => `hsl(${(idx * 47) % 360} 70% 55%)`;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl p-8 sm:p-12 text-primary-foreground shadow-elegant bg-cover"
        style={{ backgroundImage: `url(${pakusganayBanner})`, backgroundPosition: "center 30%" }}
      >
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative">
          {/* University banner */}
          <div className="flex items-center justify-start gap-4 sm:gap-5 rounded-xl bg-primary-foreground/10 px-4 py-3 backdrop-blur-md ring-1 ring-primary-foreground/20">
            <img
              src={nemsuLogo}
              alt="North Eastern Mindanao State University"
              className="h-14 w-14 sm:h-20 sm:w-20 object-contain shrink-0 drop-shadow"
            />
            <div className="flex flex-col text-left">
              <h2 className="text-lg sm:text-3xl font-bold leading-tight tracking-tight">
                North Eastern Mindanao State University - Lianga Campus
              </h2>
               <p className="text-sm sm:text-lg text-primary-foreground/90 font-semibold leading-snug">
                Poblacion, Lianga, Surigao del Sur 8307
              </p>
              <p className="text-sm sm:text-lg text-primary-foreground/90 font-semibold leading-snug">
                College of Information Technology
              </p>
              <p className="text-xs sm:text-base text-primary-foreground/80 font-medium leading-snug">
                Department of Computer Studies
              </p>
            </div>
          </div>

          <h1 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight">Pakusganay 2026</h1>
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
            {rankings
              .map((r, idx) => ({ r, rank: overallRanks[idx] ?? idx + 1 }))
              .filter(({ rank }) => rank <= 3)
              .map(({ r, rank }) => {
                const s = podiumStyles[rank - 1];
                const Icon = s.icon;
                return (
                  <div
                    key={r.course_id}
                    className={`relative overflow-hidden rounded-2xl ring-2 ${s.ring} bg-card p-6 shadow-card transition-smooth hover:shadow-elegant hover:-translate-y-1`}
                  >
                    {r.course_color && (
                      <div
                        className="absolute inset-x-0 top-0 h-1.5"
                        style={{ background: r.course_color }}
                      />
                    )}
                    <div className="flex items-center gap-3">
                      <CourseAvatar
                        name={r.course_name}
                        image={r.course_image}
                        color={r.course_color}
                        size="lg"
                      />
                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${s.bg} ${s.text}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {s.label}
                      </div>
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
            <p className="text-xs text-muted-foreground">Stacked breakdown by event</p>
          </CardHeader>
          <CardContent>
            {isLoading || eventsLoading ? (
              <Skeleton className="h-[360px] w-full" />
            ) : !rankings || rankings.length === 0 ? (
              <EmptyState message="No data yet — add courses and scores to populate the chart." />
            ) : breakdown.events.length === 0 ? (
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
                    {rankings.map((r, idx) => (
                      <Cell
                        key={idx}
                        fill={r.course_color ?? (idx < 3 ? barColors[idx] : "hsl(var(--primary))")}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={breakdown.data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
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
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {breakdown.events.map((ev, idx) => {
                    const isLast = idx === breakdown.events.length - 1;
                    return (
                      <Bar
                        key={ev.id}
                        dataKey={ev.name}
                        stackId="points"
                        fill={eventColor(idx)}
                        radius={isLast ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                      />
                    );
                  })}
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
                {rankings.map((r, i) => {
                  const rank = overallRanks[i] ?? i + 1;
                  return (
                    <li
                      key={r.course_id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3 transition-smooth hover:bg-secondary"
                      style={r.course_color ? { borderLeft: `4px solid ${r.course_color}` } : undefined}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold shrink-0 ${
                            rank === 1
                              ? "bg-gradient-gold text-accent-foreground"
                              : rank === 2
                              ? "bg-silver text-foreground"
                              : rank === 3
                              ? "bg-bronze text-primary-foreground"
                              : "bg-secondary text-foreground"
                          }`}
                        >
                          {rank}
                        </span>
                        <CourseAvatar
                          name={r.course_name}
                          image={r.course_image}
                          color={r.course_color}
                        />
                        <span className="font-medium truncate">{r.course_name}</span>
                      </div>
                      <span className="font-bold text-primary shrink-0">{r.total_points} pts</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Full points breakdown matrix */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold">Points Breakdown by Course</h2>
          <p className="text-sm text-muted-foreground">
            Full per-event points for every course, with totals.
          </p>
        </div>

        <Card className="bg-gradient-card">
          <CardContent className="p-0">
            {isLoading || eventsLoading ? (
              <div className="p-6 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !rankings || rankings.length === 0 ? (
              <div className="p-6">
                <EmptyState message="No data yet — add courses and scores to populate the breakdown." />
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="border-b border-border">
                      <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left font-semibold">
                        Course
                      </th>
                      {(eventBoards ?? []).map((ev) => (
                        <th
                          key={ev.event_id}
                          className="px-3 py-3 text-right font-semibold whitespace-nowrap text-muted-foreground"
                        >
                          {ev.event_name}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((r, i) => (
                      <tr
                        key={r.course_id}
                        className="border-b border-border last:border-0 transition-smooth hover:bg-secondary/50"
                      >
                        <td
                          className="sticky left-0 z-10 bg-card px-4 py-3"
                          style={r.course_color ? { borderLeft: `4px solid ${r.course_color}` } : undefined}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">
                              {overallRanks[i] ?? i + 1}
                            </span>
                            <CourseAvatar
                              name={r.course_name}
                              image={r.course_image}
                              color={r.course_color}
                              size="sm"
                            />
                            <span className="font-medium truncate">{r.course_name}</span>
                          </div>
                        </td>
                        {(eventBoards ?? []).map((ev, evIdx) => {
                          const foundIdx = ev.rows.findIndex((x) => x.course_id === r.course_id);
                          const found = foundIdx >= 0 ? ev.rows[foundIdx] : null;
                          const pts = found?.points ?? 0;
                          const rank = foundIdx >= 0 ? eventRanks[evIdx]?.[foundIdx] : undefined;
                          const isTop = rank === 1 && pts > 0;
                          return (
                            <td
                              key={ev.event_id}
                              className={`px-3 py-3 text-right tabular-nums whitespace-nowrap ${
                                pts === 0 ? "text-muted-foreground/60" : "text-foreground"
                              } ${isTop ? "font-bold text-primary" : ""}`}
                            >
                              {pts}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right font-bold text-primary tabular-nums whitespace-nowrap">
                          {r.total_points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Per-event leaderboards */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold">Leaderboards by Event</h2>
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
            {eventBoards.map((ev, evIdx) => {
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
                          style={r.course_color ? { borderLeft: `3px solid ${r.course_color}` } : undefined}
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
                            <CourseAvatar
                              name={r.course_name}
                              image={r.course_image}
                              color={r.course_color}
                              size="sm"
                            />
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

function CourseAvatar({
  name,
  image,
  color,
  size = "md",
}: {
  name: string;
  image: string | null;
  color: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-12 w-12 text-sm" : "h-9 w-9 text-xs";
  return (
    <div
      className={`${dim} shrink-0 rounded-full overflow-hidden border border-border grid place-items-center font-bold`}
      style={{
        background: color ?? "hsl(var(--secondary))",
        color: color ? "#fff" : "hsl(var(--foreground))",
      }}
    >
      {image ? (
        <img src={image} alt={name} className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </div>
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
