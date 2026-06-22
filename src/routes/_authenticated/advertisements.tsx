import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { AdvertisementDoc } from "@/lib/types";
import { fmtDate } from "@/lib/utils-format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/advertisements")({
  component: AdvertisementsPage,
});

function AdvertisementsPage() {
  const { role } = useAuth();
  const [ads, setAds] = useState<AdvertisementDoc[]>([]);
  const [editing, setEditing] = useState<AdvertisementDoc | null>(null);
  const [open, setOpen] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const unsub = onSnapshot(collection(db, "advertisements"), (snap) => {
      if (!isMounted.current) return;
      setAds(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdvertisementDoc, "id">) })));
    });
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, []);

  if (role !== "admin")
    return <div className="p-10 text-center text-muted-foreground">403 — Forbidden</div>;

  const deleteAd = async (id: string) => {
    if (!confirm("Are you sure you want to delete this advertisement?")) return;
    try {
      await deleteDoc(doc(db, "advertisements", id));
      toast.success("Advertisement deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div>
      <PageHeader
        title="Advertisements"
        subtitle="Manage customer portal advertisements"
        actions={
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}>
                <Plus className="size-4 mr-1" />
                Add Advertisement
              </Button>
            </DialogTrigger>
            <AdDialog
              key={editing?.id ?? "new"}
              initial={editing}
              onDone={() => {
                setOpen(false);
                setEditing(null);
              }}
            />
          </Dialog>
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Preview</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.map((ad) => (
                <TableRow key={ad.id}>
                  <TableCell>
                    <img
                      src={ad.imageUrl}
                      alt={ad.title ?? "Advertisement"}
                      className="h-12 w-20 object-cover rounded"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{ad.title ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                    {ad.link ? (
                      <a
                        href={ad.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ad.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDate(ad.createdAt)}
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(ad);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteAd(ad.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {ads.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground py-10"
                  >
                    No advertisements yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AdDialog({ initial, onDone }: { initial: AdvertisementDoc | null; onDone: () => void }) {
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) {
      toast.error("Image URL is required");
      return;
    }
    setBusy(true);
    try {
      if (initial) {
        await updateDoc(doc(db, "advertisements", initial.id), {
          imageUrl,
          title,
          link,
        });
        toast.success("Advertisement updated");
      } else {
        await setDoc(doc(db, "advertisements", Date.now().toString()), {
          imageUrl,
          title,
          link,
          status: "active",
          createdAt: Date.now(),
        });
        toast.success("Advertisement created");
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit" : "Add"} Advertisement</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Image URL *</Label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            required
          />
          {imageUrl && (
            <div className="mt-2">
              <img
                src={imageUrl}
                alt="Preview"
                className="max-h-48 w-full object-cover rounded border"
              />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Title (Optional)</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Advertisement title"
          />
        </div>
        <div className="space-y-2">
          <Label>Link (Optional)</Label>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://example.com"
            type="url"
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
