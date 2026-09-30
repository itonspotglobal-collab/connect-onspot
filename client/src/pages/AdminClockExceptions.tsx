import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { authAPI } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock3, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';

type ExceptionStatus = 'pending' | 'detected' | 'rejected';
type Decision = 'approve' | 'reject';

interface ClockException {
  id: string;
  hiringContractId: string;
  talentId: string;
  talentName: string | null;
  talentEmail: string;
  jobTitle: string;
  startedAt: string;
  endedAt: string | null;
  exceptionType: string | null;
  status: ExceptionStatus;
  exceptionDetectedAt: string | null;
  proposedEndAt: string | null;
  proposalReason: string | null;
  approvedEndAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
}

const formatLocalDateTime = (value: string | null | undefined) => {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZoneName: 'short',
  }).format(date);
};

const statusLabel: Record<ExceptionStatus, string> = {
  pending: 'Pending review',
  detected: 'Detected — awaiting talent proposal',
  rejected: 'Rejected',
};

export default function AdminClockExceptions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | ExceptionStatus>('all');
  const canReview = user?.role === 'admin';

  const exceptionsQuery = useQuery<ClockException[]>({
    queryKey: ['/api/admin/clock/exceptions'],
    queryFn: () => authAPI.get('/api/admin/clock/exceptions'),
    enabled: canReview,
    retry: false,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ sessionId, decision, reason }: { sessionId: string; decision: Decision; reason: string }) =>
      authAPI.post(`/api/admin/clock/${sessionId}/resolve`, { decision, reason }),
    onSuccess: (_result, variables) => {
      setReasons((current) => ({ ...current, [variables.sessionId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clock/exceptions'] });
      toast({
        title: variables.decision === 'approve' ? 'Exception approved' : 'Exception rejected',
        description: 'The clock exception has been resolved.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Unable to resolve exception',
        description: error.response?.data?.error || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  if (!canReview) {
    return (
      <main className="container mx-auto max-w-5xl p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access restricted</AlertTitle>
          <AlertDescription>This exception queue is available to Talent Acquisition and Super Admins only.</AlertDescription>
        </Alert>
      </main>
    );
  }

  const exceptions = exceptionsQuery.data ?? [];
  const visibleExceptions = filter === 'all' ? exceptions : exceptions.filter((exception) => exception.status === filter);
  const errorStatus = exceptionsQuery.error as any;
  const permissionDenied = errorStatus?.response?.status === 403;

  return (
    <main className="container mx-auto max-w-5xl space-y-6 p-4 md:p-6" data-testid="admin-clock-exceptions-page">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Clock3 className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-primary md:text-3xl">Missed Clock-Out Exceptions</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Review clock sessions that were left open. Times are shown in your local time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
          </p>
        </div>
        <Button variant="outline" onClick={() => exceptionsQuery.refetch()} disabled={exceptionsQuery.isFetching}>
          {exceptionsQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </header>

      {permissionDenied ? (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access restricted</AlertTitle>
          <AlertDescription>Only Talent Acquisition and Super Admins can view talent clock exception details.</AlertDescription>
        </Alert>
      ) : exceptionsQuery.isError ? (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Could not load exceptions</AlertTitle>
          <AlertDescription>{errorStatus?.response?.data?.error || 'The exception queue could not be loaded. Refresh to try again.'}</AlertDescription>
        </Alert>
      ) : exceptionsQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading clock exceptions…
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Filter exceptions">
            {(['all', 'pending', 'detected', 'rejected'] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={filter === status ? 'default' : 'outline'}
                onClick={() => setFilter(status)}
              >
                {status === 'all' ? `All (${exceptions.length})` : `${statusLabel[status]} (${exceptions.filter((item) => item.status === status).length})`}
              </Button>
            ))}
          </div>

          {visibleExceptions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No {filter === 'all' ? '' : `${filter} `}clock-out exceptions to display.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {visibleExceptions.map((exception) => {
                const reason = reasons[exception.id] ?? '';
                const isResolving = resolveMutation.isPending && resolveMutation.variables?.sessionId === exception.id;
                return (
                  <Card key={exception.id}>
                    <CardHeader className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{exception.talentName || exception.talentEmail}</CardTitle>
                          {exception.talentName && <CardDescription>{exception.talentEmail}</CardDescription>}
                        </div>
                        <Badge variant={exception.status === 'pending' ? 'default' : exception.status === 'rejected' ? 'destructive' : 'secondary'}>
                          {statusLabel[exception.status]}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{exception.jobTitle}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">Clock-in time (local)</dt>
                          <dd className="font-medium">{formatLocalDateTime(exception.startedAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Proposed clock-out (local)</dt>
                          <dd className="font-medium">{formatLocalDateTime(exception.proposedEndAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Detected (local)</dt>
                          <dd>{formatLocalDateTime(exception.exceptionDetectedAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Exception type</dt>
                          <dd>{exception.exceptionType || 'Missed clock-out'}</dd>
                        </div>
                      </dl>
                      <div className="rounded-md bg-muted/50 p-3 text-sm">
                        <p className="mb-1 font-medium">Talent’s reason</p>
                        <p className="whitespace-pre-wrap">{exception.proposalReason || 'No proposal has been submitted yet.'}</p>
                      </div>
                      {exception.status === 'rejected' && exception.resolutionReason && (
                        <div className="rounded-md border p-3 text-sm">
                          <p className="mb-1 font-medium">Previous decision reason</p>
                          <p className="whitespace-pre-wrap">{exception.resolutionReason}</p>
                          {exception.resolvedAt && <p className="mt-2 text-xs text-muted-foreground">Resolved {formatLocalDateTime(exception.resolvedAt)}</p>}
                        </div>
                      )}
                      {exception.status === 'pending' && (
                        <div className="space-y-3 border-t pt-4">
                          <label htmlFor={`resolution-reason-${exception.id}`} className="text-sm font-medium">
                            Decision reason <span className="text-destructive">*</span>
                          </label>
                          <Textarea
                            id={`resolution-reason-${exception.id}`}
                            value={reason}
                            onChange={(event) => setReasons((current) => ({ ...current, [exception.id]: event.target.value }))}
                            placeholder="Add a reason for approving or rejecting this correction"
                            rows={3}
                            maxLength={2000}
                          />
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              disabled={!reason.trim() || isResolving}
                              onClick={() => resolveMutation.mutate({ sessionId: exception.id, decision: 'reject', reason: reason.trim() })}
                            >
                              {isResolving && resolveMutation.variables?.decision === 'reject' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Reject
                            </Button>
                            <Button
                              disabled={!reason.trim() || isResolving}
                              onClick={() => resolveMutation.mutate({ sessionId: exception.id, decision: 'approve', reason: reason.trim() })}
                            >
                              {isResolving && resolveMutation.variables?.decision === 'approve' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Approve
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}