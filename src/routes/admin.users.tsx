import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

type Profile = { id: string; full_name: string | null; phone: string | null; created_at: string };
type RoleRow = { id: string; user_id: string; role: string; school_id: string | null; schools?: { name: string } | null };
type School = { id: string; name: string };

const ROLES = ["parent", "teacher", "principal", "school_admin", "super_admin"] as const;

function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<{ user: Profile } | null>(null);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>("teacher");
  const [schoolId, setSchoolId] = useState<string>("");

  const load = async () => {
    const [{ data: p }, { data: r }, { data: s }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("id, user_id, role, school_id, schools(name)"),
      supabase.from("schools").select("id, name").order("name"),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setRoles((r ?? []) as any);
    setSchools((s ?? []) as School[]);
  };
  useEffect(() => { load(); }, []);

  const onAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!open) return;
    if (role !== "parent" && role !== "super_admin" && !schoolId) {
      return toast.error("Pick a school for this role");
    }
    setSaving(true);
    const { error } = await supabase.from("user_roles").insert({
      user_id: open.user.id,
      role: role as any,
      school_id: role === "parent" || role === "super_admin" ? null : schoolId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Role assigned");
    setOpen(null);
    setSchoolId("");
    setRole("teacher");
    load();
  };

  const onRevoke = async (id: string) => {
    if (!confirm("Revoke this role?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Revoked");
    load();
  };

  const filtered = profiles.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.full_name ?? "").toLowerCase().includes(q) || p.id.includes(q);
  });

  const rolesByUser = roles.reduce<Record<string, RoleRow[]>>((acc, r) => {
    (acc[r.user_id] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users & roles</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Assign roles to existing users. Users sign up themselves; you grant them staff or admin access here.
        </p>
      </div>

      <div className="mb-4">
        <Input placeholder="Search by name or user id…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          <Users className="size-8 mx-auto mb-2 opacity-50" />
          No users found.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Roles</th>
                <th className="p-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const userRoles = rolesByUser[p.id] ?? [];
                return (
                  <tr key={p.id} className="border-t align-top">
                    <td className="p-3">
                      <div className="font-medium">{p.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.id.slice(0, 8)}…</div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {userRoles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                        {userRoles.map(r => (
                          <div key={r.id} className="inline-flex items-center gap-1 bg-muted rounded-md pl-2 pr-1 py-0.5 text-xs">
                            <Badge variant="outline" className="capitalize border-0 bg-transparent px-0">{r.role.replace("_", " ")}</Badge>
                            {r.schools?.name && <span className="text-muted-foreground">@ {r.schools.name}</span>}
                            <button onClick={() => onRevoke(r.id)} className="hover:text-destructive ml-1">
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setOpen({ user: p })}>
                        <Plus className="size-3.5 mr-1" /> Role
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign role to {open?.user.full_name ?? "user"}</DialogTitle></DialogHeader>
          <form onSubmit={onAssign} className="space-y-4">
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => { setRole(v); if (v === "parent" || v === "super_admin") setSchoolId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {role !== "parent" && role !== "super_admin" && (
              <div>
                <Label>School</Label>
                <Select value={schoolId} onValueChange={setSchoolId}>
                  <SelectTrigger><SelectValue placeholder="Pick a school" /></SelectTrigger>
                  <SelectContent>
                    {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button disabled={saving} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}Assign role
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
