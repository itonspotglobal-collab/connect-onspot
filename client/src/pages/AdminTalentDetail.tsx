import { useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
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
}

interface TalentDetailResponse {
  talent: TalentProfile;
  applications: Application[];
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

  const { talent: t, applications } = data;

  const displayName =
    (t.firstName || t.lastName)
      ? `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim()
      : t.fullName || t.displayName || t.email;

  const hiredCount = applications.filter(a => a.applicationStatus === 'hired').length;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6" data-testid="admin-talent-detail">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/admin/talent')} className="p-1 h-auto">
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
