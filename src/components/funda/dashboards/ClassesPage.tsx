import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/funda/dashboards/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, GraduationCap, ShieldAlert, Users } from "lucide-react";
import { friendlyDbError } from "@/lib/db-errors";

type ClassRow = {
  id: string;
  name: string;
  grade_id: number;
  academic_year: number;
  teacher_user_id: string | null;
  teacher_name: string | null;
};

type Grade = { id: number; label: string };

type StaffMember = { id: string; full_name: string | null };

const CURRENT_YEAR = new Date().getFullYear();

export function ClassesPage() {
  const { primaryRole, primarySchoolId } = useAuth();
  const canManage = ["principal", "school_admin", "super_admin"].includes(primaryRole);

  const [classes, setClasses]   = useState<ClassRow[]>([]);
  const [grades, setGrades]     = useState<Grade[]>([]);
  const [staff, setStaff]       = useState<StaffMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving]     = useState(false);

  // Form state
  const [name, setName]               = useState("");
  const [gradeId, setGradeId]         = useState<string>("");
  const [teacherId, setTeacherId]     = useState<string>("none");
  const [academicYear, setAcademicYear] = useState(String(CURRENT_YEAR));

  const load = async () => {
    if (!primarySchoolId) { setLoading(false); return; }
    setLoading(true);

    const [{ data: classData }, { data: gradeData }, { data: roleData }] = await Promise.all([
      supabase
        .from("classes")
        .select("id, name, grade_id, academic_year, teacher_user_id")
        .eq("school_id", primarySchoolId)
        .order("grade_id")
        .order("name"),
      supabase.from("grades").select("id, label").order("id"),
      supabase
        .from("user_roles")
        .select("user_id")
        .eq("school_id", primarySchoolId)
        .in("role", ["teacher", "school_admin", "principal"]),
    ]);

    setGrades((gradeData ?? []) as Grade[]);

    // Load staff profiles
    const staffIds = [...new Set((roleData ?? []).map((r: any) => r.user_id))];
    let staffList: StaffMember[] = [];
    if (staffIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", staffIds)
        .order("full_name");
      staffList = (profileData ?? []) as StaffMember[];
    }
    setStaff(staffList);

    // Enrich classes with teacher names
    const staffMap = Object.fromEntries(staffList.map((s) => [s.id, s.full_name]));
    const enriched: ClassRow[] = (classData ?? []).map((c: any) => ({
      ...c,
      teacher_name: c.teacher_user_id ? (staffMap[c.teacher_user_id] ?? "Unknown") : null,
    }));
    setClasses(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, [primarySchoolId]);

  const resetForm = () => {
    setName(""); setGradeId(""); setTeacherId("none");
    setAcademicYear(String(CURRENT_YEAR));
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Enter a class name");
    if (!gradeId)     return toast.error("Select a grade");
    if (!primarySchoolId) return;

    setSaving(true);
    const { error } = await supabase.from("classes").insert({
      school_id:       primarySchoolId,
      name:            name.trim(),
      grade_id:        parseInt(gradeId),
      teacher_user_id: teacherId === "none" ? null : teacherId,
      academic_year:   parseInt(academicYear),
    });
    setSaving(false);

    if (error) return toast.error(friendlyDbError(error));
    toast.success(`Class "${name.trim()}" created`);
    setDialogOpen(false);
    resetForm();
    load();
  };

  const onDelete = async (cls: ClassRow) => {
    setDeleting(cls.id);
    const { error } = await supabase.from("classes").delete().eq("id", cls.id);
    setDeleting(null);
    if (error) return toast.error(friendlyDbError(error));
    toast.success(`"${cls.name}" deleted`);
    load();
  };

  if (!canManage) {
    return (
      <div className="max-w-lg">
        <PageHeader title="Classes" sub="Manage class groups at your school." />
        <Card className="p-10 text-center text-muted-foreground text-sm">
          <ShieldAlert className="size-8 mx-auto mb-2 opacity-40" />
          Only principals and school admins can manage classes.
        </Card>
      </div>
    );
  }

  // Group by grade for display
  const byGrade = classes.reduce<Record<number, ClassRow[]>>((acc, c) => {
    (acc[c.grade_id] ??= []).push(c);
    return acc;
  }, {});
  const sortedGrades = Object.keys(byGrade).map(Number).sort((a, b) => a - b);

  const gradeLabel = (id: number) =>
    grades.find((g) => g.id === id)?.label ?? (id === 0 ? "Grade R" : `Grade ${id}`);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Classes"
        sub={`Manage class groups · ${CURRENT_YEAR}`}
        action={
          canManage && (
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="size-4 mr-1.5" /> Add class
            </Button>
          )
        }
      />

      {loading ? (
        <div className="text-sm text-muted-foreground py-10 text-center">Loading…</div>
      ) : classes.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          <GraduationCap className="size-8 mx-auto mb-2 opacity-40" />
          <p className="font-medium text-foreground mb-1">No classes yet</p>
          <p>Add classes to enable class-specific calendar events and discipline filtering.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedGrades.map((gId) => (
            <div key={gId}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {gradeLabel(gId)}
              </h2>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3">Class name</th>
                      <th className="p-3">Teacher</th>
                      <th className="p-3">Year</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {byGrade[gId].map((cls) => (
                      <tr key={cls.id} className="border-t align-middle">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-md bg-accent/10 grid place-items-center shrink-0">
                              <Users className="size-3.5 text-accent" />
                            </div>
                            <span className="font-medium">{cls.name}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          {cls.teacher_name ? (
                            <Badge variant="secondary">{cls.teacher_name}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Unassigned</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {cls.academic_year}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={deleting === cls.id}
                            onClick={() => onDelete(cls)}
                            title="Delete class"
                          >
                            {deleting === cls.id
                              ? <Loader2 className="size-4 animate-spin" />
                              : <Trash2 className="size-4 text-destructive" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* ── Add class dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add class</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4 mt-1">
            <div>
              <Label htmlFor="cls-name">Class name</Label>
              <Input
                id="cls-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 10A or Grade 4 Maths"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Grade</Label>
                <Select value={gradeId} onValueChange={setGradeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {grades.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Select value={academicYear} onValueChange={setAcademicYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Assign teacher <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="none">Unassigned</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name ?? s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={saving || !name.trim() || !gradeId}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {saving
                ? <><Loader2 className="size-4 animate-spin mr-2" />Saving…</>
                : <><Plus className="size-4 mr-2" />Create class</>}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
