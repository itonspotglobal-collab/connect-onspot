import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { TopNavigation } from "@/components/TopNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ArrowLeft,
  Eye,
  Search,
  ClipboardList,
  Briefcase,
  CheckCircle2,
} from "lucide-react";
import {
  getPilot,
  getPilotActivity,
  getPilotActivityTotal,
  getPilotLastActivity,
  trackPilotActivity,
  DEFAULT_PILOT_ID,
  PILOT_ACTIVITY_LABELS,
  PILOT_ACTIVITY_ORDER,
  type PilotActivityKey,
} from "@/lib/pilotConfig";

const ACTIVITY_ICONS: Record<PilotActivityKey, typeof Eye> = {
  viewedHireTalent: Eye,
  searchedTalent: Search,
  requestedShortlist: ClipboardList,
  viewedFindWork: Briefcase,
  appliedToJob: CheckCircle2,
};

export default function PilotDashboard() {
  const params = useParams<{ pilotId?: string }>();
  const [, navigate] = useLocation();
  const pilotId = params.pilotId || DEFAULT_PILOT_ID;
  const pilot = getPilot(pilotId);

  const [activity, setActivity] = useState(() => getPilotActivity(pilotId));
  const lastActivityAt = useMemo(() => getPilotLastActivity(pilotId), [activity]);

  useEffect(() => {
    setActivity(getPilotActivity(pilotId));
  }, [pilotId]);

  if (!pilot) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <TopNavigation />
        <div className="mx-auto max-w-xl px-6 pt-24 text-center">
          <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">
            Pilot not found
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            There is no pilot configured with that id yet.
          </p>
          <Button variant="outline" className="rounded-full" onClick={() => navigate("/hire-talent")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Hire Talent
          </Button>
        </div>
      </div>
    );
  }

  const total = getPilotActivityTotal(pilotId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <TopNavigation />
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-10 lg:px-8">
        <button
          onClick={() => navigate("/hire-talent")}
          className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Hire Talent
        </button>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-[#3F4698]/10 px-3 py-1 text-[#3F4698] hover:bg-[#3F4698]/10">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {pilot.name} Pilot
              </Badge>
              <Badge variant="outline" className="rounded-full capitalize">
                {pilot.status}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {pilot.name} Pilot Activity
            </h1>
            <p className="mt-2 max-w-xl text-slate-500 dark:text-slate-400">
              {pilot.brandPromise} — a live look at how the {pilot.name} pilot is
              being used across Hire Talent and Find Work.
            </p>
          </div>

          <Card className="w-full max-w-[220px] shrink-0 border-slate-200 sm:w-auto">
            <CardContent className="p-5 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Total activity
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
                {total}
              </p>
              {lastActivityAt && (
                <p className="mt-1 text-[11px] text-slate-400">
                  Last event {new Date(lastActivityAt).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILOT_ACTIVITY_ORDER.map((key) => {
            const Icon = ACTIVITY_ICONS[key];
            const count = activity[key] ?? 0;
            return (
              <Card key={key} className="border-slate-200">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3F4698]/10 text-[#3F4698]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {count}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {PILOT_ACTIVITY_LABELS[key]}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button
            className="rounded-2xl px-6"
            onClick={() => {
              trackPilotActivity("requestedShortlist", pilotId);
              navigate("/hire-talent");
            }}
          >
            Request {pilot.name} shortlist
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl px-6"
            onClick={() => navigate("/find-work/jobs")}
          >
            Browse Find Work
          </Button>
        </div>
      </div>
    </div>
  );
}
