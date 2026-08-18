import { useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { authAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  ChevronLeft,
  Loader2,
  Globe,
  Phone,
  MapPin,
  Users,
  Briefcase,
  Shield,
} from 'lucide-react';

interface Application {
  applicationId: string;
  talentName: string | null;
  applicationStatus: string;
  submittedAt: string | null;
}

interface Job {
  id: string;
  title: string;
  status: string;
  approvalStatus: string;
  createdAt: string;
  applications: Application[];
}

interface ClientProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  companyName: string | null;
  contactPerson: string | null;
  phoneNumber: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  companySize: string | null;
  about: string | null;
  timezone: string | null;
  profileUpdatedAt: string | null;
}

interface ClientDetailResponse {
  client: ClientProfile;
  jobs: Job[];
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  invited: 'Invited',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  under_review: 'Under Review',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
  interviewing: 'Interviewing',
  offer_extended: 'Offer Extended',
  offer_expired: 'Offer Expired',
  offer_accepted: 'Offer Accepted',
  offer_declined: 'Offer Declined',
  contract_sent: 'Contract Sent',
  hired: 'Hired',
};

function applicationStatusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (['hired', 'offer_accepted', 'contract_sent'].includes(status)) return 'default';
  if (['shortlisted', 'interviewing', 'offer_extended'].includes(status)) return 'secondary';
  return 'outline';
}

export default function AdminClientDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const clientId = params.id;

  const { data, isLoading, error } = useQuery<ClientDetailResponse>({
    queryKey: ['/api/admin/clients', clientId],
    queryFn: () => authAPI.get(`/api/admin/clients/${clientId}`),
    enabled: !!clientId,
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
        <Button variant="ghost" size="sm" onClick={() => setLocation('/admin/clients')} className="mb-4 p-1 h-auto">
          <ChevronLeft className="w-4 h-4 mr-1" />Back to Clients
        </Button>
        <p className="text-destructive">Client not found or you don't have access.</p>
      </div>
    );
  }

  const { client, jobs } = data;
  const displayName = client.companyName
    ?? (client.firstName || client.lastName
        ? `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim()
        : client.email);
  const totalApplications = jobs.reduce((sum, j) => sum + j.applications.length, 0);

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6" data-testid="admin-client-detail">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/admin/clients')} className="p-1 h-auto">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Building2 className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <p className="text-sm text-muted-foreground">{client.email}</p>
          </div>
        </div>
        <Badge variant="secondary" className="gap-1 mt-1 shrink-0">
          <Shield className="w-3 h-3" />
          Admin Access
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Client profile */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {client.contactPerson && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{client.contactPerson}</span>
                </div>
              )}
              {client.phoneNumber && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{client.phoneNumber}</span>
                </div>
              )}
              {client.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{client.location}</span>
                </div>
              )}
              {client.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={client.website} target="_blank" rel="noopener noreferrer"
                     className="text-primary hover:underline truncate">
                    {client.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              {client.industry && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="w-4 h-4 shrink-0" />
                  <span>{client.industry}</span>
                </div>
              )}
              {client.companySize && (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Size:</span> {client.companySize}
                </div>
              )}
              {client.timezone && (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Timezone:</span> {client.timezone}
                </div>
              )}
              {client.about && (
                <div className="pt-2 border-t text-muted-foreground leading-relaxed">
                  {client.about}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total jobs</span>
                <span className="font-medium">{jobs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Open jobs</span>
                <span className="font-medium">{jobs.filter(j => j.status === 'open').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total applications</span>
                <span className="font-medium">{totalApplications}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Client since</span>
                <span>{new Date(client.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Jobs + cross-reference applications */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold">
            Jobs {jobs.length > 0 && <span className="text-muted-foreground font-normal">({jobs.length})</span>}
          </h2>

          {jobs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No jobs yet for this client.
              </CardContent>
            </Card>
          ) : (
            jobs.map((job) => (
              <Card key={job.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold">{job.title}</CardTitle>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge
                        variant={job.status === 'open' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {job.status}
                      </Badge>
                      {job.approvalStatus !== 'approved' && (
                        <Badge variant="outline" className="text-xs">
                          {job.approvalStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(job.createdAt).toLocaleDateString()}
                  </p>
                </CardHeader>

                <CardContent className="pt-0">
                  {job.applications.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No applications yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="py-2 text-left font-medium text-muted-foreground pr-4">Applicant</th>
                            <th className="py-2 text-left font-medium text-muted-foreground pr-4">Status</th>
                            <th className="py-2 text-left font-medium text-muted-foreground">Applied</th>
                          </tr>
                        </thead>
                        <tbody>
                          {job.applications.map((app) => (
                            <tr key={app.applicationId} className="border-b last:border-0">
                              <td className="py-2 pr-4">
                                {app.talentName ?? <span className="italic text-muted-foreground">Unknown</span>}
                              </td>
                              <td className="py-2 pr-4">
                                <Badge
                                  variant={applicationStatusVariant(app.applicationStatus)}
                                  className="text-xs"
                                >
                                  {STATUS_LABELS[app.applicationStatus] ?? app.applicationStatus}
                                </Badge>
                              </td>
                              <td className="py-2 text-muted-foreground">
                                {app.submittedAt
                                  ? new Date(app.submittedAt).toLocaleDateString()
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
