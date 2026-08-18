import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { authAPI } from '@/lib/api';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Shield,
  ExternalLink,
} from 'lucide-react';

interface ClientRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  company_name: string | null;
  contact_person: string | null;
  phone_number: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  total_jobs: number;
  open_jobs: number;
  closed_jobs: number;
  pending_jobs: number;
}

interface ClientsResponse {
  total: number;
  page: number;
  limit: number;
  items: ClientRow[];
}

const PAGE_SIZE = 25;

export default function AdminClients() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._adminClientSearchTimer);
    (window as any)._adminClientSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  };

  const { data, isFetching, refetch } = useQuery<ClientsResponse>({
    queryKey: ['/api/admin/clients', { search: debouncedSearch, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      return authAPI.get(`/api/admin/clients?${params}`);
    },
  });

  const clients = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6" data-testid="admin-clients-page">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/admin/dashboard')}
            className="p-1 h-auto"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Building2 className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Client Accounts</h1>
            <p className="text-sm text-muted-foreground">
              {total > 0 ? `${total} client${total !== 1 ? 's' : ''}` : 'No clients yet'}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="gap-1 mt-1">
          <Shield className="w-3 h-3" />
          Admin Access
        </Badge>
      </div>

      {/* Search + Refresh */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by company, name, or email…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isFetching && clients.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">
              {debouncedSearch ? 'No clients match your search.' : 'No client accounts yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Company / Contact</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Industry</th>
                    <th className="px-4 py-3 text-left font-medium">Jobs</th>
                    <th className="px-4 py-3 text-left font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      data-testid={`client-row-${c.id}`}
                      onClick={() => setLocation(`/admin/clients/${c.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium flex items-center gap-1.5">
                          {c.company_name ?? (
                            <span className="text-muted-foreground italic">No company</span>
                          )}
                          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </div>
                        {c.contact_person && (
                          <div className="text-xs text-muted-foreground">{c.contact_person}</div>
                        )}
                        {c.location && (
                          <div className="text-xs text-muted-foreground">{c.location}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.industry ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {c.total_jobs} total
                          </Badge>
                          {c.open_jobs > 0 && (
                            <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100 border-0">
                              {c.open_jobs} open
                            </Badge>
                          )}
                          {c.pending_jobs > 0 && (
                            <Badge className="text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-0">
                              {c.pending_jobs} pending
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
