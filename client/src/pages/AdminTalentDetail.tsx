import { useLocation, useParams } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { authAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  ChevronLeft,
  Loader2,
  MapPin,
  Globe,
  Linkedin,
  Github,
  Briefcase,
  GraduationCap,
  Shield,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Video,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Application {
  applicationId: string;
  jobTitle: string | null;
  clientCompanyName: string | null;
  applicationStatus: string;
  submittedAt: string | null;
}

interface VettingHistoryEntry {
  id: string;
  action: 'granted' | 'revoked';
  reason: string | null;
  changedBy: string;
  changedAt: string;
}

interface VerificationStatusData {
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verifiedByMechanism: string | null;
  verificationNotes: string | null;
  status: string | null;
  docName: string | null;
  rejectionReason: string | null;
}

interface VerificationHistoryEntry {
  id: string;
  action: string;
  reason: string | null;
  changedBy: string;
  changedAt: string;
}

interface TalentProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  candidateId: string | null;
  fullName: string | null;
  displayName: string | null;
  category: string | null;
  targetPosition: string | null;
  seniority: string | null;
  experienceYears: string | null;
  headline: string | null;
  summary: string | null;
  moreAboutMe: string | null;
  availability: string | null;
  location: string | null;
  coreSkills: string[];
  secondarySkills: string[];
  workHistory: any[];
  education: any[];
  certifications: any[];
  preferences: Record<string, any>;
  profileCompleted: boolean | null;
  profilePhotoUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  websiteUrl: string | null;
  hasResume: boolean;
  hasVideo: boolean;
  resumeFileName: string | null;
  videoIntroFileName: string | null;
  profileUpdatedAt: string | null;
  isVetted: boolean;
  vettedAt: string | null;
  vettedByMechanism: string | null;
  isVerified: boolean;
  verificationStatus: string | null;
}

interface TalentDetailResponse {
  talent: TalentProfile;
  applications: Application[];
  vettingHistory: VettingHistoryEntry[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new: 'New', invited: 'Invited', declined: 'Declined', withdrawn: 'Withdrawn',
  under_review: 'Under Review', reviewed: 'Reviewed', shortlisted: 'Shortlisted',
  rejected: 'Rejected', interviewing: 'Interviewing', offer_extended: 'Offer Extended',
  offer_expired: 'Offer Expired', offer_accepted: 'Offer Accepted',
  offer_declined: 'Offer Declined', contract_sent: 'Contract Sent', hired: 'Hired',
};

function applicationStatusVariant(s: string): 'default' | 'secondary' | 'outline' {
  if (['hired', 'offer_accepted', 'contract_sent'].includes(s)) return 'default';
  if (['shortlisted', 'interviewing', 'offer_extended'].includes(s)) return 'secondary';
  return 'outline';
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminTalentDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const userId = params.id;

  const { data, isLoading, error } = useQuery<TalentDetailResponse>({
    queryKey: ['/api/admin/talent', userId],
    queryFn: () => authAPI.get(`/api/admin/talent/${userId}`),
    enabled: !!userId,
  });

  const queryClient = useQueryClient();
  const [vettingReason, setVettingReason] = useState('');
  const [vettingLoading, setVettingLoading] = useState(false);
  const [vettingError, setVettingError] = useState<string | null>(null);

  const { data: eligibility, refetch: refetchEligibility } = useQuery<{
    isVetted: boolean;
    vettedAt: string | null;
    vettedByMechanism: string | null;
    completedHireCount: number;
    autoThreshold: number | null;
    meetsAutoThreshold: boolean;
  }>({
    queryKey: ['/api/admin/talent', userId, 'vetted-eligibility'],
    queryFn: () => authAPI.get(`/api/admin/talent/${userId}/vetted-eligibility`),
    enabled: !!userId,
  });

  // Verification status — Super Admin only; non-Super-Admins get a 403 (retry:false)
  const {
    data: verificationStatus,
    refetch: refetchVerification,
    error: verificationStatusError,
  } = useQuery<VerificationStatusData>({
    queryKey: ['/api/admin/talent', userId, 'verification-status'],
    queryFn: () => authAPI.get(`/api/admin/talent/${userId}/verification-status`),
    enabled: !!userId,
    retry: false,
  });

  const {
    data: verificationHistoryData,
    refetch: refetchVerificationHistory,
  } = useQuery<{ history: VerificationHistoryEntry[] }>({
    queryKey: ['/api/admin/talent', userId, 'verification-history'],
    queryFn: () => authAPI.get(`/api/admin/talent/${userId}/verification-history`),
    enabled: !!userId,
    retry: false,
  });

  const [verifyNotes,        setVerifyNotes]        = useState('');
  const [verifyRejectReason, setVerifyRejectReason] = useState('');
  const [verifyLoading,      setVerifyLoading]      = useState(false);
  const [verifyError,        setVerifyError]        = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/admin/talent')} className="mb-4 p-1 h-auto">
          <ChevronLeft className="w-4 h-4 mr-1" />Back to Talent
        </Button>
        <p className="text-destructive text-sm">Talent not found or you don't have access.</p>
      </div>
    );
  }

  const { talent: t, applications, vettingHistory } = data;

  const displayName =
    (t.firstName || t.lastName)
      ? `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim()
      : t.fullName || t.displayName || t.email;

  const hiredCount = applications.filter(a => a.applicationStatus === 'hired').length;

  async function handleVettingAction(action: 'grant' | 'revoke') {
    if (!vettingReason.trim()) {
      setVettingError('A reason is required.');
      return;
    }
    setVettingLoading(true);
    setVettingError(null);
    try {
      await authAPI.patch(`/api/admin/talent/${userId}/vetted`, { action, reason: vettingReason.trim() });
      setVettingReason('');
      await Promise.all([
        refetchEligibility(),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/talent', userId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/talent'] }),
      ]);
    } catch (err: any) {
      setVettingError(err?.message ?? 'Failed to update vetting status.');
    } finally {
      setVettingLoading(false);
    }
  }

  async function handleVerificationAction(action: 'confirm' | 'reject') {
    if (action === 'reject' && !verifyRejectReason.trim()) {
      setVerifyError('A reason is required when rejecting.');
      return;
    }
    setVerifyLoading(true);
    setVerifyError(null);
    try {
      if (action === 'confirm') {
        await authAPI.post(`/api/admin/talent/${userId}/verification/confirm`, { notes: verifyNotes.trim() || undefined });
      } else {
        await authAPI.post(`/api/admin/talent/${userId}/verification/reject`, { reason: verifyRejectReason.trim() });
      }
      setVerifyNotes('');
      setVerifyRejectReason('');
      await Promise.all([
        refetchVerification(),
        refetchVerificationHistory(),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/talent', userId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/talent'] }),
      ]);
    } catch (err: any) {
      setVerifyError(err?.message ?? 'Failed to update verification status.');
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleViewDocument() {
    const token = localStorage.getItem('onspot_jwt_token') || '';
    try {
      const response = await fetch(`/api/admin/talent/${userId}/verification-document`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Access denied or no document found');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      setVerifyError(`Could not load document: ${err.message}`);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6" data-testid="admin-talent-detail">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/admin/talent')}
            className="p-1 h-auto"
            aria-label="Back to Talent"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Users className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <p className="text-sm text-muted-foreground">{t.email}</p>
            {t.headline && <p className="text-sm text-muted-foreground">{t.headline}</p>}
          </div>
        </div>
        <Badge variant="secondary" className="gap-1 mt-1 shrink-0">
          <Shield className="w-3 h-3" />Admin Access
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: profile ──────────────────────────────────────────────── */}
        <div className="space-y-4">

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {t.category && (
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{t.category}{t.seniority ? ` · ${t.seniority}` : ''}</span>
                </div>
              )}
              {t.targetPosition && (
                <div className="text-muted-foreground">{t.targetPosition}</div>
              )}
              {t.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>{t.location}</span>
                </div>
              )}
              {t.availability && (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Available:</span> {t.availability}
                </div>
              )}
              {t.experienceYears && (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Experience:</span> {t.experienceYears}
                </div>
              )}
              {t.linkedinUrl && (
                <a href={t.linkedinUrl} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-2 text-primary hover:underline">
                  <Linkedin className="w-4 h-4 shrink-0" />LinkedIn
                </a>
              )}
              {t.githubUrl && (
                <a href={t.githubUrl} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-2 text-primary hover:underline">
                  <Github className="w-4 h-4 shrink-0" />GitHub
                </a>
              )}
              {(t.portfolioUrl || t.websiteUrl) && (
                <a href={t.portfolioUrl || t.websiteUrl!} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-2 text-primary hover:underline">
                  <Globe className="w-4 h-4 shrink-0" />Portfolio / Website
                </a>
              )}
            </CardContent>
          </Card>

          {/* File access */}
          {(t.hasResume || t.hasVideo) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {t.hasResume && (
                  <a
                    href={`/api/admin/talent/${t.id}/resume`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    {t.resumeFileName || 'Resume'}
                  </a>
                )}
                {t.hasVideo && (
                  <a
                    href={`/api/admin/talent/${t.id}/video`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Video className="w-4 h-4 shrink-0" />
                    {t.videoIntroFileName || 'Video Introduction'}
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card>
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profile status</span>
                {t.profileCompleted
                  ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3.5 h-3.5" />Complete</span>
                  : <span className="flex items-center gap-1 text-muted-foreground"><Circle className="w-3.5 h-3.5" />Incomplete</span>}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Applications</span>
                <span className="font-medium">{applications.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hired</span>
                <span className="font-medium">{hiredCount}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Member since</span>
                <span>{new Date(t.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* ── Verification Status ─────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />Verification Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {/* Super Admin restriction */}
              {verificationStatusError && (
                <p className="text-xs text-muted-foreground italic">
                  {(verificationStatusError as any)?.response?.status === 403
                    ? 'Verification management is restricted to Super Admins.'
                    : 'Failed to load verification status.'}
                </p>
              )}

              {verificationStatus && (
                <>
                  {/* Current status row */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    {verificationStatus.isVerified ? (
                      <span className="flex items-center gap-1 font-semibold text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />Verified
                      </span>
                    ) : verificationStatus.status === 'pending' ? (
                      <span className="flex items-center gap-1 font-semibold text-amber-600">
                        <Clock className="w-3.5 h-3.5" />Pending review
                      </span>
                    ) : verificationStatus.status === 'rejected' ? (
                      <span className="flex items-center gap-1 font-semibold text-destructive">
                        <Circle className="w-3.5 h-3.5" />Rejected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Circle className="w-3.5 h-3.5" />No Classification
                      </span>
                    )}
                  </div>

                  {/* Verified details */}
                  {verificationStatus.isVerified && verificationStatus.verifiedAt && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Verified on</span>
                      <span>{new Date(verificationStatus.verifiedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {verificationStatus.isVerified && verificationStatus.verifiedByMechanism && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Mechanism</span>
                      <span className="capitalize text-right max-w-[140px] truncate">
                        {verificationStatus.verifiedByMechanism.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                  {verificationStatus.verificationNotes && (
                    <div className="flex items-start justify-between gap-2 text-muted-foreground">
                      <span>Notes</span>
                      <span className="text-right text-xs">{verificationStatus.verificationNotes}</span>
                    </div>
                  )}

                  {/* Pending: doc + action panel */}
                  {verificationStatus.status === 'pending' && (
                    <div className="space-y-2.5 pt-1">
                      {verificationStatus.docName && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Document</span>
                          <button
                            onClick={handleViewDocument}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            {verificationStatus.docName}
                          </button>
                        </div>
                      )}
                      <textarea
                        value={verifyNotes}
                        onChange={e => { setVerifyNotes(e.target.value); setVerifyError(null); }}
                        placeholder="Confirm notes (optional)…"
                        rows={2}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      />
                      <textarea
                        value={verifyRejectReason}
                        onChange={e => { setVerifyRejectReason(e.target.value); setVerifyError(null); }}
                        placeholder="Rejection reason (required to reject)…"
                        rows={2}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      />
                      {verifyError && <p className="text-xs text-destructive">{verifyError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerificationAction('confirm')}
                          disabled={verifyLoading}
                          className="flex-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 hover:bg-green-700 transition-colors"
                        >
                          {verifyLoading ? 'Saving…' : 'Confirm Verified'}
                        </button>
                        <button
                          onClick={() => handleVerificationAction('reject')}
                          disabled={verifyLoading}
                          className="flex-1 rounded-md border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-60 hover:bg-destructive/10 transition-colors"
                        >
                          {verifyLoading ? 'Saving…' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Rejected: reason */}
                  {verificationStatus.status === 'rejected' && verificationStatus.rejectionReason && (
                    <div className="text-xs text-red-700 bg-red-50 rounded-md p-2 border border-red-100">
                      <p className="font-medium mb-0.5">Rejection reason:</p>
                      <p>{verificationStatus.rejectionReason}</p>
                    </div>
                  )}

                  {/* Verification history */}
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">History</p>
                    {!verificationHistoryData?.history?.length ? (
                      <p className="text-xs text-muted-foreground">No verification history yet</p>
                    ) : (
                      <div className="space-y-2.5">
                        {verificationHistoryData.history.map(event => (
                          <div key={event.id} className="border-b last:border-0 pb-2.5 last:pb-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-xs font-semibold ${event.action === 'confirmed' ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {event.action === 'confirmed' ? 'Confirmed' : 'Rejected / Grandfathered'}
                              </span>
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {new Date(event.changedAt).toLocaleString()}
                              </span>
                            </div>
                            {event.reason && (
                              <p className="text-xs text-muted-foreground mt-0.5">{event.reason}</p>
                            )}
                            <p className="text-[11px] text-muted-foreground mt-0.5">By {event.changedBy}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Vetted Status ─────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />Vetted Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {/* Current status */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                {eligibility?.isVetted
                  ? <span className="flex items-center gap-1 font-semibold text-[#474EAD]">
                      <CheckCircle2 className="w-3.5 h-3.5" />Vetted
                    </span>
                  : <span className="flex items-center gap-1 text-muted-foreground">
                      <Circle className="w-3.5 h-3.5" />No Classification
                    </span>}
              </div>

              {/* Completed hires + threshold */}
              {eligibility && (
                <>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Completed hires</span>
                    <span className="font-medium text-foreground">{eligibility.completedHireCount}</span>
                  </div>
                  {eligibility.autoThreshold !== null && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Auto-threshold</span>
                      <span className={eligibility.meetsAutoThreshold ? "font-medium text-green-600" : "font-medium text-foreground"}>
                        {eligibility.completedHireCount}/{eligibility.autoThreshold}
                        {eligibility.meetsAutoThreshold && " ✓ eligible"}
                      </span>
                    </div>
                  )}
                  {eligibility.isVetted && eligibility.vettedAt && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Vetted on</span>
                      <span>{new Date(eligibility.vettedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {eligibility.isVetted && eligibility.vettedByMechanism && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Mechanism</span>
                      <span className="capitalize">{eligibility.vettedByMechanism.replace('_', ' ')}</span>
                    </div>
                  )}
                </>
              )}

              {/* Action */}
              <div className="pt-1 space-y-2">
                <textarea
                  value={vettingReason}
                  onChange={e => { setVettingReason(e.target.value); setVettingError(null); }}
                  placeholder="Reason (required)…"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                {vettingError && <p className="text-xs text-destructive">{vettingError}</p>}
                <div className="flex gap-2">
                  {!eligibility?.isVetted ? (
                    <button
                      onClick={() => handleVettingAction('grant')}
                      disabled={vettingLoading}
                      className="flex-1 rounded-md bg-[#474EAD] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 hover:bg-[#383E90] transition-colors"
                    >
                      {vettingLoading ? 'Saving…' : 'Grant Vetted'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleVettingAction('revoke')}
                      disabled={vettingLoading}
                      className="flex-1 rounded-md border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-60 hover:bg-destructive/10 transition-colors"
                    >
                      {vettingLoading ? 'Saving…' : 'Revoke Vetted'}
                    </button>
                  )}
                </div>
              </div>

              {/* Vetted status audit history */}
              <div className="border-t pt-3" data-testid="vetting-history">
                <p className="text-xs font-medium text-muted-foreground mb-2">History</p>
                {vettingHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No vetting history yet</p>
                ) : (
                  <div className="space-y-2.5">
                    {vettingHistory.map(event => (
                      <div
                        key={event.id}
                        className="border-b last:border-0 pb-2.5 last:pb-0"
                        data-testid="vetting-history-entry"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold ${event.action === 'granted' ? 'text-[#474EAD]' : 'text-destructive'}`}>
                            {event.action === 'granted' ? 'Granted' : 'Revoked'}
                          </span>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {new Date(event.changedAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {event.reason || 'No reason provided'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          By {event.changedBy}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: skills + applications ───────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Skills */}
          {(t.coreSkills.length > 0 || t.secondarySkills.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Skills</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {t.coreSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Core</p>
                    <div className="flex flex-wrap gap-1.5">
                      {t.coreSkills.map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-xs font-normal">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {t.secondarySkills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Secondary</p>
                    <div className="flex flex-wrap gap-1.5">
                      {t.secondarySkills.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-normal">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Summary / About */}
          {(t.summary || t.moreAboutMe) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">About</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {t.summary || t.moreAboutMe}
              </CardContent>
            </Card>
          )}

          {/* Work history */}
          {t.workHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Work History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {t.workHistory.map((w: any, i: number) => (
                  <div key={i} className="text-sm border-b last:border-0 pb-3 last:pb-0">
                    <div className="font-medium">{w.title || w.role}</div>
                    <div className="text-muted-foreground">{w.company}</div>
                    {(w.startDate || w.endDate) && (
                      <div className="text-xs text-muted-foreground">{w.startDate} – {w.endDate || 'Present'}</div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Education */}
          {t.education.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />Education
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {t.education.map((e: any, i: number) => (
                  <div key={i} className="text-sm">
                    <div className="font-medium">{e.degree || e.qualification}</div>
                    <div className="text-muted-foreground">{e.institution || e.school}</div>
                    {e.year && <div className="text-xs text-muted-foreground">{e.year}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Applications — reverse cross-reference */}
          <div>
            <h2 className="text-base font-semibold mb-3">
              Applications{applications.length > 0 && (
                <span className="text-muted-foreground font-normal ml-1">({applications.length})</span>
              )}
            </h2>
            {applications.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  No applications yet.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="border-b bg-muted/30">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Client</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Applied</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications.map(app => (
                          <tr key={app.applicationId} className="border-b last:border-0">
                            <td className="px-4 py-3 font-medium">
                              {app.jobTitle ?? <span className="italic text-muted-foreground">Unknown role</span>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {app.clientCompanyName ?? '—'}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={applicationStatusVariant(app.applicationStatus)} className="text-xs">
                                {STATUS_LABELS[app.applicationStatus] ?? app.applicationStatus}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
