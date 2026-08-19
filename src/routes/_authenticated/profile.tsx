import { createFileRoute } from '@tanstack/react-router'
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { doc, updateDoc, db } from "@/lib/supabase-store";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { name, phone, address });
    await supabase.auth.updateUser({ data: { name } });
    await refresh();
    toast.success("Profile updated");
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      await updateDoc(doc(db, "users", user.uid), { passwordUpdatedAt: Date.now() });
      toast.success("Password changed");
      setCurrentPwd("");
      setNewPwd("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return <div><PageHeader title="Profile" subtitle="Update your account details" /><div className="grid lg:grid-cols-2 gap-4"><Card><CardHeader><CardTitle>Account info</CardTitle></CardHeader><CardContent><form onSubmit={saveProfile} className="space-y-3"><div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div><div className="space-y-1.5"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div><div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></div><div className="space-y-1.5"><Label>Address</Label><Input value={address} onChange={(event) => setAddress(event.target.value)} /></div><div className="space-y-1.5"><Label>Role</Label><Input value={user?.role ?? ""} disabled className="capitalize" /></div><Button type="submit">Save changes</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Change password</CardTitle></CardHeader><CardContent><form onSubmit={changePassword} className="space-y-3"><div className="space-y-1.5"><Label>Current password</Label><div className="relative"><Input type={showCurrentPwd ? "text" : "password"} value={currentPwd} onChange={(event) => setCurrentPwd(event.target.value)} required className="pr-10" /><button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showCurrentPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div><div className="space-y-1.5"><Label>New password</Label><div className="relative"><Input type={showNewPwd ? "text" : "password"} minLength={6} value={newPwd} onChange={(event) => setNewPwd(event.target.value)} required className="pr-10" /><button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showNewPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div><Button type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</Button></form></CardContent></Card></div></div>;
}
