import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { authAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  X,
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
  location: string | null;
  target_position: string | null;
  seniority: string | null;
  headline: string | null;
  availability: string | null;
  is_vetted: boolean;
  top_skills: string[] | null;
  total_applications: number;
  last_active_at: string | null;
}

interface TalentListResponse {
  total: number;
  vettedTotal: number;
  page: number;
  limit: number;
  items: TalentItem[];
}

const APPLICATION_STATUSES = [
  { value: 'new',            label: 'New' },
  { value: 'invited',        label: 'Invited' },
  { value: 'under_review',   label: 'Under Review' },
  { value: 'reviewed',       label: 'Reviewed' },
  { value: 'shortlisted',    label: 'Shortlisted' },
  { value: 'interviewing',   label: 'Interviewing' },
  { value: 'offer_extended', label: 'Offer Extended' },
  { value: 'offer_accepted', label: 'Offer Accepted' },
  { value: 'hired',          label: 'Hired' },
  { value: 'rejected',       label: 'Rejected' },
  { value: 'withdrawn',      label: 'Withdrawn' },
  { value: 'declined',       label: 'Declined' },
];

function formatLastActive(ts: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return d.toLocaleDateString();
}

export default function AdminTalent() {
  const [, setLocation] = useLocation();
  const [search, setSearch]                       = useState('');
  const [debouncedSearch, setDebouncedSearch]     = useState('');
  const [skillFilter, setSkillFilter]             = useState('');
  const [debouncedSkill, setDebouncedSkill]       = useState('');
  const [statusFilter, setStatusFilter]           = useState('');
  const [vettedFilter, setVettedFilter]           = useState(false);
  const [vettedSort, setVettedSort]               = useState('');
  const [page, setPage]                           = useState(1);
  const LIMIT = 50;

  const debounce = (setter: (v: string) => void, delay = 350) => (val: string) => {
    clearTimeout((window as any).__adminTalentTimer);
    (window as any).__adminTalentTimer = setTimeout(() => { setter(val); setPage(1); }, delay);
  };

  const handleSearch = (val: string) => { setSearch(val);      debounce(setDebouncedSearch)(val); };
  const handleSkill  = (val: string) => { setSkillFilter(val); debounce(setDebouncedSkill)(val);  };
  const handleStatus = (val: string) => { setStatusFilter(val); setPage(1); };
  const handleVettedSort = (val: string) => { setVettedSort(val === '__default__' ? '' : val); setPage(1); };

  const clearFilters = () => {
    setSearch(''); setDebouncedSearch('');
    setSkillFilter(''); setDebouncedSkill('');
    setStatusFilter('');
    setVettedFilter(false);
    setPage(1);
  };
  const hasFilters = debouncedSearch || debouncedSkill || statusFilter || vettedFilter;

  const { data, isLoading, error, refetch, isFetching } = useQuery<TalentListResponse>({
    queryKey: ['/api/admin/talent', debouncedSearch, debouncedSkill, statusFilter, vettedFilter, vettedSort, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (debouncedSkill)  params.set('skill',  debouncedSkill);
      if (statusFilter)    params.set('applicationStatus', statusFilter);
      if (vettedFilter)    params.set('vetted', 'true');
      if (vettedSort) {
        params.set('sortBy', 'vetted');
        params.set('sortOrder', vettedSort === 'vetted-first' ? 'desc' : 'asc');
      }
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Name/email search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name or email…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-9"
            data-testid="talent-search-input"
          />
        </div>

        {/* Skill filter */}
        <div className="relative w-48">
          <Input
            placeholder="Filter by skill…"
            value={skillFilter}
            onChange={e => handleSkill(e.target.value)}
            data-testid="talent-skill-filter"
          />
        </div>

        {/* Application status filter */}
        <Select value={statusFilter || '__all__'} onValueChange={v => handleStatus(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-48" data-testid="talent-status-filter">
            <SelectValue placeholder="Any application status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Any application status</SelectItem>
            {APPLICATION_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Vetted sort */}
        <Select value={vettedSort || '__default__'} onValueChange={handleVettedSort}>
          <SelectTrigger className="w-48" data-testid="talent-vetted-sort">
            <SelectValue placeholder="Sort by Vetted status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">Newest first</SelectItem>
            <SelectItem value="vetted-first">Vetted first</SelectItem>
            <SelectItem value="not-vetted-first">Not vetted first</SelectItem>
          </SelectContent>
        </Select>

        {/* Vetted filter */}
        <Button
          type="button"
          variant={vettedFilter ? 'default' : 'outline'}
          size="sm"
          className="h-9 rounded-full gap-1.5"
          onClick={() => { setVettedFilter(value => !value); setPage(1); }}
          aria-pressed={vettedFilter}
          data-testid="talent-vetted-filter"
        >
          Vetted
          <Badge
            variant={vettedFilter ? 'secondary' : 'outline'}
            className="px-1.5 py-0 text-xs"
          >
            {data?.vettedTotal ?? '…'}
          </Badge>
        </Button>

        {/* Clear filters */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-9">
            <X className="w-3.5 h-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Table card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">
            {hasFilters
              ? `Filtered results — ${total} match${total !== 1 ? 'es' : ''}`
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
              {hasFilters ? 'No talent accounts match the current filters.' : 'No talent accounts found.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vetted</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Skills (top 3)</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Applications</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Profile</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => {
                    const displayName = (t.first_name || t.last_name)
                      ? `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim()
                      : null;
                    return (
                      <tr
                        key={t.id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        data-testid={`talent-row-${t.id}`}
                        onClick={() => setLocation(`/admin/talent/${t.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {displayName ?? <span className="italic text-muted-foreground">No name</span>}
                          </div>
                          {t.target_position && (
                            <div className="text-xs text-muted-foreground">{t.target_position}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {t.is_vetted ? (
                            <Badge
                              className="gap-1 bg-[#474EAD] text-white hover:bg-[#383E90]"
                              data-testid={`talent-vetted-status-${t.id}`}
                            >
                              <Shield className="w-3.5 h-3.5" />
                              Vetted
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 text-muted-foreground"
                              data-testid={`talent-vetted-status-${t.id}`}
                            >
                              <Circle className="w-3.5 h-3.5" />
                              Not vetted
                            </Badge>
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
                          <div className="flex flex-wrap gap-1">
                            {t.top_skills && t.top_skills.length > 0
                              ? t.top_skills.map((s, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs font-normal">{s}</Badge>
                                ))
                              : <span className="text-muted-foreground">—</span>
                            }
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {t.total_applications > 0
                            ? <span className="font-medium">{t.total_applications}</span>
                            : <span className="text-muted-foreground">0</span>
                          }
                        </td>
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
                          {formatLastActive(t.last_active_at)}
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
          <span>Page {page} of {totalPages} · {total.toLocaleString()} total</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
