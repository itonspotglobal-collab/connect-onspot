import { Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function GetHiredAssessment({ onContinue }: { onContinue: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Skills &amp; Personality Assessments
          <Badge variant="outline">Optional</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" data-testid="assessment-unavailable">
        <h3 className="font-semibold">Assessments are currently unavailable</h3>
        <p className="text-muted-foreground">
          No assessment result is available in this flow. You can continue to job matching
          without an assessment. This does not mark an assessment as completed.
        </p>
        <Button onClick={onContinue} data-testid="button-continue-without-assessment">
          Continue to Matching
        </Button>
      </CardContent>
    </Card>
  );
}