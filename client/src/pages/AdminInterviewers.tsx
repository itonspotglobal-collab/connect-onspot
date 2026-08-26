import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Wifi,
  WifiOff,
  Users,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Interviewer {
  id: string;
  name: string;
  title: string;
  sortOrder: number;
  isCalendarConnected: boolean;
  /** Origin of this record — only "db" entries support edit/delete. */
  source: "db" | "env" | "builtin";
  createdAt?: string;
  updatedAt?: string;
}

interface InterviewerFormState {
  name: string;
  title: string;
  calendarEmail: string;
  sortOrder: number;
}

const EMPTY_FORM: InterviewerFormState = {
  name: '',
  title: '',
  calendarEmail: '',
  sortOrder: 0,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminInterviewers() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editTarget, setEditTarget] = useState<Interviewer | null>(null);
  const [formState, setFormState] = useState<InterviewerFormState>(EMPTY_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Interviewer | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data, isLoading, error } = useQuery<{ interviewers: Interviewer[] }>({
    queryKey: ['/api/admin/interviewers'],
    queryFn: () => authAPI.get('/api/admin/interviewers'),
  });

  const interviewers = data?.interviewers ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: InterviewerFormState) =>
      authAPI.post('/api/admin/interviewers', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/interviewers'] });
      toast({ title: 'Interviewer added' });
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Failed to add interviewer', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: InterviewerFormState }) =>
      authAPI.patch(`/api/admin/interviewers/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/interviewers'] });
      toast({ title: 'Interviewer updated' });
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Failed to update interviewer', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      authAPI.delete(`/api/admin/interviewers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/interviewers'] });
      toast({ title: 'Interviewer removed' });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: 'Failed to remove interviewer', variant: 'destructive' });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setFormState(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(interviewer: Interviewer) {
    setEditTarget(interviewer);
    // calendarEmail is never returned from GET — admins re-enter it when editing
    setFormState({
      name: interviewer.name,
      title: interviewer.title,
      calendarEmail: '',
      sortOrder: interviewer.sortOrder,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditTarget(null);
    setFormState(EMPTY_FORM);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formState.name.trim()) return;
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, body: formState });
    } else {
      createMutation.mutate(formState);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load interviewers. Make sure you are signed in as an admin.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/admin/dashboard')}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Interviewer Management
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Add and connect interviewer calendars for scheduling.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Add Interviewer
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        <strong>Calendar connection</strong> requires a Microsoft 365 UPN (e.g.{' '}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">jane@onspotglobal.com</code>). 
        Interviewers without a calendar email show as <em>Not connected</em> and won't appear in slot queries.
      </div>

      {/* List */}
      {interviewers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <Users className="w-10 h-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-sm">No interviewers configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first interviewer to enable calendar-based scheduling.
              </p>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Interviewer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {interviewers.map((iv) => (
            <Card key={iv.id} className="group">
              <CardContent className="flex items-center gap-4 py-4">
                {/* Avatar placeholder */}
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {iv.name.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-tight truncate">{iv.name}</p>
                  {iv.title && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{iv.title}</p>
                  )}
                </div>

                {/* Connection badge */}
                {iv.isCalendarConnected ? (
                  <Badge variant="outline" className="shrink-0 border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400 gap-1">
                    <Wifi className="w-3 h-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 text-muted-foreground gap-1">
                    <WifiOff className="w-3 h-3" />
                    Not connected
                  </Badge>
                )}

                {/* Source badge for read-only entries */}
                {iv.source !== "db" && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {iv.source === "env" ? "via secret" : "built-in"}
                  </Badge>
                )}

                {/* Actions — only for DB-managed entries */}
                {iv.source === "db" && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => openEdit(iv)}
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(iv)}
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Interviewer' : 'Add Interviewer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="iv-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="iv-name"
                placeholder="Jane Smith"
                value={formState.name}
                onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iv-title">Title / Role</Label>
              <Input
                id="iv-title"
                placeholder="Talent Acquisition Lead"
                value={formState.title}
                onChange={(e) => setFormState((s) => ({ ...s, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iv-email">
                Calendar Email (M365 UPN)
              </Label>
              <Input
                id="iv-email"
                type="email"
                placeholder="jane@onspotglobal.com"
                value={formState.calendarEmail}
                onChange={(e) => setFormState((s) => ({ ...s, calendarEmail: e.target.value }))}
              />
              {editTarget && (
                <p className="text-xs text-muted-foreground">
                  Leave blank to keep the existing calendar email unchanged. Enter a new address to update it.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Must be a Microsoft 365 account in your tenant. Leave blank to add without a calendar.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iv-order">Display Order</Label>
              <Input
                id="iv-order"
                type="number"
                min={0}
                placeholder="0"
                value={formState.sortOrder}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, sortOrder: parseInt(e.target.value, 10) || 0 }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first in the interviewer list.
              </p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !formState.name.trim()}>
                {isSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {editTarget ? 'Save Changes' : 'Add Interviewer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove interviewer?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be removed from the interviewer list.
              This won't affect any previously scheduled interviews.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
