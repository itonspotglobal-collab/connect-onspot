import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { authAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Shield,
  CheckCircle2,
  Circle,
} from 'lucide-react';

interface TalentItem {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  candidate_id: string | null;
  category: string | null;
  profile_completed: boolean | null;
  account_created: boolean | null;
  location: string | null;
  target_position: string | null;
  seniority: string | null;
  headline: string | null;
  availability: string | null;
}

interface TalentListResponse {
  total: number;
  page: number;
  limit: number;
  items: TalentItem[];
}

export default function AdminTalent() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__talentSearchTimer);
    (window as any).__talentSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  };

  const queryKey = ['/api/admin/talent', debouncedSearch, page];
  const { data, isLoading, error, refetch, isFetching } = useQuery<TalentListResponse>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      return authAPI.get(`/api/admin/talent?${params}`);
    },
  });

  const total      = data?.total ?? 0;
  const items      = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6" data-testid="admin-talent-list">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Talent Accounts</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Loading…' : `${total.toLocaleString()} talent user${total !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Shield className="w-3 h-3" />
            Admin
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          className="pl-9"
          data-testid="talent-search-input"
        />
      </div>

      {/* Table card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">
            {debouncedSearch
              ? `Showing results for "${debouncedSearch}"`
              : 'All talent accounts · click a row to open profile'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive p-6">Failed to load talent list.</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              {debouncedSearch ? 'No talent accounts match your search.' : 'No talent accounts found.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Position / Seniority</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Profile</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => {
                    const displayName = t.first_name || t.last_name
                      ? `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim()
                      : <span className="italic text-muted-foreground">No name</span>;
                    return (
                      <tr
                        key={t.id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        data-testid={`talent-row-${t.id}`}
                        onClick={() => setLocation(`/admin/talent/${t.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{displayName}</div>
                          {t.headline && (
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]">{t.headline}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{t.email}</td>
                        <td className="px-4 py-3">
                          {t.category ? (
                            <Badge variant="outline" className="text-xs">{t.category}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>{t.target_position || <span className="text-muted-foreground">—</span>}</div>
                          {t.seniority && (
                            <div className="text-xs text-muted-foreground">{t.seniority}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{t.location || '—'}</td>
                        <td className="px-4 py-3">
                          {t.profile_completed ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />Complete
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Circle className="w-3.5 h-3.5" />Incomplete
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(t.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {total.toLocaleString()} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
