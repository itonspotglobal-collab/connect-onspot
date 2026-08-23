import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  Clock,
  Users,
  CheckCircle2,
  ExternalLink,
  Loader2,
  FileText,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface QueueEntry {
  candidate_id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  target_position: string | null;
  category: string | null;
  profile_photo_url: string | null;
  verification_doc_name: string | null;
  submitted_at: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminVerification() {
  const [, setLocation] = useLocation();

  const { data, isLoading, error, refetch } = useQuery<{ queue: QueueEntry[] }>({
    queryKey: ['/api/admin/verification/queue'],
    queryFn: () => authAPI.get('/api/admin/verification/queue'),
  });

  const queue = data?.queue ?? [];

  function getDisplayName(entry: QueueEntry) {
    if (entry.first_name || entry.last_name) {
      return `${entry.first_name ?? ''} ${entry.last_name ?? ''}`.trim();
    }
    return entry.display_name || entry.email;
  }

  function formatAge(iso: string) {
    const ms = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(ms / 3_600_000);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    const is403 = (error as any)?.status === 403 || String(error).includes('403');
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {is403
            ? 'The verification queue is restricted to Super Admins (accounts with no sub-role).'
            : 'Failed to load verification queue.'}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6" data-testid="admin-verification">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold">Verification Queue</h1>
            <p className="text-sm text-muted-foreground">
              Contractors awaiting identity verification — Super Admin only
            </p>
          </div>
        </div>
        <Badge variant="outline" className="mt-1 gap-1 shrink-0">
          <Clock className="w-3 h-3" />
          {queue.length} pending
        </Badge>
      </div>

      {/* Empty state */}
      {queue.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
            <p className="font-semibold text-slate-700">Queue is clear</p>
            <p className="text-sm text-muted-foreground">
              No contractors are waiting for identity verification.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Queue list */}
      {queue.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />Pending Reviews
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {queue.map((entry) => (
                <div
                  key={entry.candidate_id}
                  className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {entry.profile_photo_url ? (
                        <img
                          src={entry.profile_photo_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">
                          {getDisplayName(entry).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{getDisplayName(entry)}</p>
                      <p className="text-xs text-muted-foreground truncate">{entry.email}</p>
                      {entry.target_position && (
                        <p className="text-xs text-muted-foreground truncate">{entry.target_position}</p>
                      )}
                    </div>
                  </div>

                  {/* Doc info + age */}
                  <div className="hidden sm:flex flex-col items-end shrink-0 text-right gap-0.5">
                    {entry.verification_doc_name && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="w-3 h-3" />
                        {entry.verification_doc_name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Submitted {formatAge(entry.submitted_at)}
                    </span>
                  </div>

                  {/* Review button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => setLocation(`/admin/talent/${entry.user_id}`)}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Review
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
