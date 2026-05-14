import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/funda/dashboards/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Shield, Star, AlertTriangle, ShieldAlert, Zap } from "lucide-react";

export const Route = createFileRoute("/app/learner/$learnerId")({
  component: LearnerDetailPage,
});

type Learner = {
  id: string; first_name: string; last_name: string;
  grade_id: number; learner_number: string | null; gender: string | null;
  date_of_birth: string | null; schools: { name: string } | null;
};
type AttRow = { id: string; date: string; status: string; notes: string | null };
type DiscRow = { id: string; date: string; type: string; title: string; points: number | null };

const ATT_ICON: Record<string, React.ReactNode> = {
  present: <CheckCircle2 className="size-3.5 text-green-500" />,
  late:    <Clock        className="size-3.5 text-orange-400" />,
  absent:  <XCircle      className="size-3.5 text-red-500" />,
};
const ATT_COLOR: Record<string, string> = {
  present: "text-green-600 bg-green-500/10",
  late:    "text-orange-500 bg-orange-500/10",
  absent:  "text-red-500 bg-red-500/10",
};
const DISC_COLOR: Record<string, string> = {
  merit:      "text-green-600 bg-green-500/10",
  warning:    "text-orange-500 bg-orange-500/10",
  detention:  "text-red-500 bg-red-500/10",
  suspension: "text-red-700 bg-red-700/10",
  incident:   "text-purple-600 bg-purple-500/10",
};
const DISC_ICON: Record<string, React.ReactNode> = {
  merit:      <Star       className="size-3.5" />,
  warning:    <AlertTriangle className="size-3.5" />,
  detention:  <ShieldAlert  className="size-3.5" />,
  suspension: <ShieldAlert  className="size-3.5" />,
  incident:   <Zap          className="size-3.5" />,
};

function currentTerm() {
  const m = new Date().getMonth() + 1;
  if (m <= 3) return 1; if (m <= 6) return 2; if (m <= 9) return 3; return 4;
}
function termRange(term: number, year: number): [string, string] {
  const r: Record<number, [string, string]> = {
    1: [`${year}-01-01`, `${year}-03-31`],
    2: [`${year}-04-01`, `${year}-06-30`],
    3: [`${year}-07-01`, `${year}-09-30`],
    4: [`${year}-10-01`, `${year}-12-31`],
  };
  return r[term];
}

function LearnerDetailPage() {
  const { learnerId } = Route.useParams();
  const { primaryRole } = useAuth();
  const canView = primaryRole !== "parent";

  const [learner, setLearner]   = useState<Learner | null>(null);
  const [att, setAtt]           = useState<AttRow[]>([]);
  const [disc, setDisc]         = useState<DiscRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [termFilter, setTermFilter] = useState(currentTerm());
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!learnerId) return;
    setLoading(true);
    const [from, to] = termRange(termFilter, year);
    Promise.all([
      supabase.from("learners")
        .select("id, first_name, last_name, grade_id, learner_number, gender, date_of_birth, schools(name)")
        .eq("id", learnerId).maybeSingle(),
      supabase.from("attendance")
        .select("id, date, status, notes")
        .eq("learner_id", learnerId)
        .gte("date", from).lte("date", to)
        .order("date", { ascending: false }),
      supabase.from("discipline_records")
        .select("id, date, type, title, points")
        .eq("learner_id", learnerId)
        .order("date", { ascending: false })
        .limit(20),
    ]).then(([{ data: l }, { data: a }, { data: d }]) => {
      setLearner(l as Learner);
      setAtt((a ?? []) as AttRow[]);
      setDisc((d ?? []) as DiscRow[]);
      setLoading(false);
    });
  }, [learnerId, termFilter]);

  if (!canView) {
    return (
      <div className="max-w-lg">
        <PageHeader title="Learner" sub="" />
        <Card className="p-10 text-center text-muted-foreground text-sm">Staff only.</Card>
      </div>
    );
  }

  if (loading) return <div className="text-sm text-muted-foreground py-10 text-center">Loading…</div>;
  if (!learner) return <div className="text-sm text-muted-foreground py-10 text-center">Learner not found.</div>;

  const present = att.filter(r => r.status === "present").length;
  const late    = att.filter(r => r.status === "late").length;
  const absent  = att.filter(r => r.status === "absent").length;
  const attPct  = att.length > 0 ? Math.round((present + late) / att.length * 100) : null;

  const gradeLabel = learner.grade_id === 0 ? "Grade R" : `Grade ${learner.grade_id}`;

  return (
    <div className="max-w-4xl">
      {/* Back */}
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
        <Link to="/app/learners"><ArrowLeft className="size-4 mr-1" />Back to learners</Link>
      </Button>

      <PageHeader
        title={`${learner.first_name} ${learner.last_name}`}
        sub={`${gradeLabel} · ${learner.schools?.name ?? "—"}`}
      />

      {/* Info row */}
      <div className="flex flex-wrap gap-2 mb-6">
        {learner.learner_number && <Badge variant="secondary">No. {learner.learner_number}</Badge>}
        {learner.gender && <Badge variant="outline" className="capitalize">{learner.gender}</Badge>}
        {learner.date_of_birth && (
          <Badge variant="outline">
            DOB: {new Date(learner.date_of_birth + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Attendance ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Attendance</h2>
            <div className="flex gap-1">
              {[1,2,3,4].map(t => (
                <button
                  key={t}
                  onClick={() => setTermFilter(t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    termFilter === t
                      ? "bg-accent/15 border-accent/40 text-accent"
                      : "border-border/60 text-muted-foreground hover:border-accent/30"
                  }`}
                >
                  T{t}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          {att.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label: "Present", value: present, color: "text-green-600" },
                { label: "Late",    value: late,    color: "text-orange-500" },
                { label: "Absent",  value: absent,  color: "text-red-500" },
                { label: "Rate",    value: attPct !== null ? `${attPct}%` : "—", color: attPct !== null && attPct >= 80 ? "text-green-600" : "text-orange-500" },
              ].map(s => (
                <Card key={s.label} className="p-3 text-center">
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                </Card>
              ))}
            </div>
          )}

          {att.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">No attendance records for Term {termFilter}.</Card>
          ) : (
            <Card className="overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground sticky top-0">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {att.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                      </td>
                      <td className="p-2.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold capitalize px-2 py-0.5 rounded-full ${ATT_COLOR[r.status] ?? ""}`}>
                          {ATT_ICON[r.status]}{r.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-xs text-muted-foreground">{r.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        {/* ── Discipline ── */}
        <div>
          <h2 className="font-semibold text-sm mb-3">Discipline history</h2>
          {disc.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">
              <Shield className="size-6 mx-auto mb-2 opacity-40" />
              No discipline records.
            </Card>
          ) : (
            <Card className="overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground sticky top-0">
                  <tr>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Title</th>
                    <th className="p-2.5">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {disc.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold capitalize px-2 py-0.5 rounded-full ${DISC_COLOR[r.type] ?? "text-muted-foreground bg-muted"}`}>
                          {DISC_ICON[r.type]}{r.type}
                        </span>
                      </td>
                      <td className="p-2.5 text-xs font-medium">{r.title}</td>
                      <td className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
