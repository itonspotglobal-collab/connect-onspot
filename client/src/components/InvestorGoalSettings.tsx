import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { authAPI } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INVESTOR_GOAL_PLACEHOLDERS, isValidInvestorGoalSetting, type InvestorGoalKey } from "@shared/investorGoals";

export function InvestorGoalSettings({ settings }: { settings: Record<string, string> }) {
  const [draft, setDraft] = useState<Partial<Record<InvestorGoalKey, string>>>({});
  const { toast } = useToast();
  const entries = Object.entries(INVESTOR_GOAL_PLACEHOLDERS) as [InvestorGoalKey, string][];
  const save = useMutation({
    mutationFn: (values: Record<string, string>) => authAPI.patch("/api/admin/platform-settings", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-settings"] });
      setDraft({});
      toast({ title: "Investor goals saved", description: "The public Investors page will pick up the goals on its next live refresh." });
    },
    onError: (error: any) => toast({
      title: "Goals not saved",
      description: error.response?.data?.error || "Unable to save investor goals. Only Super Admins can update them.",
      variant: "destructive",
    }),
  });
  const values = Object.fromEntries(entries.map(([key]) => [key, draft[key] ?? settings[key] ?? ""]));
  const valid = entries.every(([key]) => isValidInvestorGoalSetting(key, values[key]));
  return (
    <section className="space-y-3 border-t pt-6" aria-labelledby="investor-goal-settings-title">
      <h3 id="investor-goal-settings-title" className="font-semibold">Investor account goals for 2027</h3>
      <p className="text-[13px] text-muted-foreground">
        Only Super Admins can save these goals. Enter positive whole account counts without commas.
        Leave a placeholder or clear a field to show the live count without a ring or goal line.
      </p>
      {entries.map(([key, placeholder]) => (
        <div className="space-y-1" key={key}>
          <label htmlFor={key} className="text-sm font-medium">
            {key === "investor_goal_contractors_2027" ? "Contractor goal" : "Client goal"}
          </label>
          <Input id={key} inputMode="numeric" placeholder={placeholder}
            value={values[key]} disabled={save.isPending}
            aria-invalid={!isValidInvestorGoalSetting(key, values[key])}
            aria-describedby={!valid ? "investor-goal-validation" : undefined}
            onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
        </div>
      ))}
      {!valid && <p id="investor-goal-validation" role="alert" className="text-sm text-destructive">
        Use a positive whole number, the matching placeholder, or a blank value.
      </p>}
      <Button disabled={save.isPending || !valid || !Object.keys(draft).length}
        onClick={() => save.mutate(values)}>
        {save.isPending ? "Saving…" : "Save Investor Goals"}
      </Button>
    </section>
  );
}
