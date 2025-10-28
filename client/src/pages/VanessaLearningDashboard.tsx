import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  TrendingUp, 
  Database, 
  Sparkles, 
  ThumbsUp, 
  ThumbsDown,
  BookOpen,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface LearningSummary {
  date: string;
  insights: string[];
  improvementAreas: string[];
  topPositiveTopics: string[];
  commonIssues: string[];
  totalFeedback: number;
  positiveCount: number;
  negativeCount: number;
  timestamp?: number;
}

interface DatabaseStats {
  totalThreads: number;
  totalFeedback: number;
  totalKnowledge: number;
  totalLearningSummaries: number;
}

interface LearningStatus {
  status: "running" | "success" | "failed";
  feedbackCount: number;
  summaryKey?: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface LearningHealth {
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  successRate: number;
}

interface LatestSummary {
  summaryKey: string;
  generatedAt: string;
  feedbackCount: number;
  summaryText: string;
  insights: string[];
  improvementAreas: string[];
}

export default function VanessaLearningDashboard() {
  const { toast } = useToast();

  // Fetch latest learning summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery<{
    success: boolean;
    summary: LearningSummary | null;
  }>({
    queryKey: ["/api/learn/summary"],
  });

  // Fetch database stats
  const { data: statsData, isLoading: statsLoading } = useQuery<{
    success: boolean;
    stats: DatabaseStats;
  }>({
    queryKey: ["/api/learn/stats"],
  });

  // Fetch all feedback
  const { data: feedbackData, isLoading: feedbackLoading } = useQuery<{
    success: boolean;
    feedback: any[];
  }>({
    queryKey: ["/api/feedback"],
  });

  // Fetch learning status (recent runs)
  const { data: statusData, isLoading: statusLoading } = useQuery<{
    success: boolean;
    statuses: LearningStatus[];
  }>({
    queryKey: ["/api/learn/status"],
  });

  // Fetch learning health
  const { data: healthData, isLoading: healthLoading } = useQuery<{
    success: boolean;
    health: LearningHealth;
  }>({
    queryKey: ["/api/learn/health"],
  });

  // Fetch latest summary with metadata
  const { data: latestSummaryData, isLoading: latestSummaryLoading } = useQuery<{
    success: boolean;
    summary: LatestSummary;
  }>({
    queryKey: ["/api/learn/summary/latest"],
  });

  // Knowledge ingestion mutation
  const ingestKnowledgeMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/learn"),
    onSuccess: (data: any) => {
      toast({
        title: "Knowledge ingestion complete",
        description: `Processed ${data.summaries} knowledge files`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to ingest knowledge",
        variant: "destructive",
      });
    },
  });

  // Learning loop mutation
  const learningLoopMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/learn/summarize"),
    onSuccess: () => {
      toast({
        title: "Learning loop completed",
        description: "Vanessa has analyzed recent feedback and updated her learning insights",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/summary/latest"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to run learning loop",
        variant: "destructive",
      });
    },
  });

  const summary = summaryData?.summary;
  const stats = statsData?.stats;
  const feedback = feedbackData?.feedback || [];
  const learningStatuses = statusData?.statuses || [];
  const learningHealth = healthData?.health;
  const latestSummary = latestSummaryData?.summary;

  const satisfactionRate = stats && stats.totalFeedback > 0
    ? Math.round((summary?.positiveCount || 0) / stats.totalFeedback * 100)
    : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">🟢 Success</Badge>;
      case "running":
        return <Badge className="bg-yellow-500">🟡 Running</Badge>;
      case "failed":
        return <Badge variant="destructive">🔴 Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Brain className="h-8 w-8 text-primary" />
          Vanessa Learning Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Monitor and improve Vanessa's AI performance through feedback analysis and continuous learning
        </p>
      </div>

      {/* Action Buttons */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Knowledge Ingestion
            </CardTitle>
            <CardDescription>
              Process and summarize knowledge files from /resources/knowledge/
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => ingestKnowledgeMutation.mutate()}
              disabled={ingestKnowledgeMutation.isPending}
              className="w-full"
              data-testid="button-ingest-knowledge"
            >
              {ingestKnowledgeMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Ingest Knowledge Files
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5" />
              Learning Loop
            </CardTitle>
            <CardDescription>
              Analyze feedback and update Vanessa's learning insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => learningLoopMutation.mutate()}
              disabled={learningLoopMutation.isPending}
              className="w-full"
              variant="default"
              data-testid="button-run-learning-loop"
            >
              {learningLoopMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Run Learning Loop
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalThreads || 0}</div>
            <p className="text-xs text-muted-foreground">Total threads tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feedback</CardTitle>
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalFeedback || 0}</div>
            <p className="text-xs text-muted-foreground">User ratings received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Knowledge Base</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalKnowledge || 0}</div>
            <p className="text-xs text-muted-foreground">Topics summarized</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{satisfactionRate}%</div>
            <Progress value={satisfactionRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Learning Insights Tabs */}
      <Tabs defaultValue="visibility" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visibility">Learning Visibility</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="feedback">Recent Feedback</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Learning Visibility Tab */}
        <TabsContent value="visibility" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Learning Health Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Learning Health
                </CardTitle>
                <CardDescription>Overall learning system performance</CardDescription>
              </CardHeader>
              <CardContent>
                {healthLoading ? (
                  <p className="text-center text-muted-foreground">Loading...</p>
                ) : !learningHealth ? (
                  <p className="text-center text-muted-foreground">No learning runs yet</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Success Rate</span>
                      <span className="text-2xl font-bold">{learningHealth.successRate}%</span>
                    </div>
                    <Progress value={learningHealth.successRate} className="h-2" />
                    <div className="grid grid-cols-3 gap-2 text-center pt-2">
                      <div>
                        <div className="text-2xl font-bold text-muted-foreground">{learningHealth.totalRuns}</div>
                        <div className="text-xs text-muted-foreground">Total Runs</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{learningHealth.successRuns}</div>
                        <div className="text-xs text-muted-foreground">Success</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">{learningHealth.failedRuns}</div>
                        <div className="text-xs text-muted-foreground">Failed</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Latest Summary Preview Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Latest Summary
                </CardTitle>
                <CardDescription>Most recent learning insights</CardDescription>
              </CardHeader>
              <CardContent>
                {latestSummaryLoading ? (
                  <p className="text-center text-muted-foreground">Loading...</p>
                ) : !latestSummary ? (
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">No summary available yet</p>
                    <Button
                      onClick={() => learningLoopMutation.mutate()}
                      disabled={learningLoopMutation.isPending}
                      size="sm"
                      data-testid="button-generate-summary"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${learningLoopMutation.isPending ? 'animate-spin' : ''}`} />
                      Generate Summary
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Generated: {format(new Date(latestSummary.generatedAt), "MMM d, h:mm a")}</span>
                      <span>{latestSummary.feedbackCount} feedback</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {latestSummary.summaryText || latestSummary.insights.join(" ").substring(0, 200)}...
                    </p>
                    <div className="flex gap-2 pt-2">
                      <Badge variant="outline">{latestSummary.insights.length} insights</Badge>
                      <Badge variant="outline">{latestSummary.improvementAreas.length} improvements</Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Learning Runs Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Recent Learning Runs
              </CardTitle>
              <CardDescription>Last 5 learning loop executions</CardDescription>
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <p className="text-center text-muted-foreground">Loading...</p>
              ) : learningStatuses.length === 0 ? (
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">No learning runs yet</p>
                  <Button
                    onClick={() => learningLoopMutation.mutate()}
                    disabled={learningLoopMutation.isPending}
                    data-testid="button-run-first-learning"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Run First Learning Loop
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {learningStatuses.map((status, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(status.status)}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(status.startedAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                        {status.status === "success" && (
                          <p className="text-sm text-muted-foreground">
                            Analyzed {status.feedbackCount} feedback entries
                          </p>
                        )}
                        {status.status === "failed" && status.error && (
                          <p className="text-sm text-red-600">{status.error}</p>
                        )}
                        {status.completedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Duration: {Math.round((new Date(status.completedAt).getTime() - new Date(status.startedAt).getTime()) / 1000)}s
                          </p>
                        )}
                      </div>
                      {status.summaryKey && (
                        <Badge variant="secondary" className="ml-2">
                          Summary Available
                        </Badge>
                      )}
                    </div>
                  ))}
                  <Button
                    onClick={() => learningLoopMutation.mutate()}
                    disabled={learningLoopMutation.isPending}
                    className="w-full mt-4"
                    variant="outline"
                    data-testid="button-rerun-learning"
                  >
                    {learningLoopMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Re-run Learning Loop
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          {summaryLoading ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">Loading learning insights...</p>
              </CardContent>
            </Card>
          ) : !summary ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Brain className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium mb-2">No learning summary yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Run the learning loop to generate insights from user feedback
                </p>
                <Button
                  onClick={() => learningLoopMutation.mutate()}
                  disabled={learningLoopMutation.isPending}
                  data-testid="button-generate-first-summary"
                >
                  Generate First Summary
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Key Insights
                  </CardTitle>
                  <CardDescription>
                    {summary.timestamp && `Last updated: ${format(new Date(summary.timestamp), "MMM d, yyyy • h:mm a")}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.insights.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No insights yet</p>
                  ) : (
                    <ul className="space-y-2">
                      {summary.insights.map((insight, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-primary font-semibold mt-0.5">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    Improvement Areas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.improvementAreas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No improvement areas identified</p>
                  ) : (
                    <ul className="space-y-2">
                      {summary.improvementAreas.map((area, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-orange-600 font-semibold mt-0.5">•</span>
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ThumbsUp className="h-5 w-5 text-blue-600" />
                    Top Positive Topics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.topPositiveTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No positive topics yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {summary.topPositiveTopics.map((topic, idx) => (
                        <Badge key={idx} variant="secondary">{topic}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ThumbsDown className="h-5 w-5 text-red-600" />
                    Common Issues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.commonIssues.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No common issues identified</p>
                  ) : (
                    <ul className="space-y-2">
                      {summary.commonIssues.map((issue, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-red-600 font-semibold mt-0.5">•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle>Recent Feedback</CardTitle>
              <CardDescription>Latest user ratings and comments</CardDescription>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <p className="text-center text-muted-foreground">Loading feedback...</p>
              ) : feedback.length === 0 ? (
                <p className="text-center text-muted-foreground">No feedback yet</p>
              ) : (
                <div className="space-y-3">
                  {feedback.slice(0, 20).map((item: any, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                      {item.rating === "up" ? (
                        <ThumbsUp className="h-4 w-4 text-green-600 mt-1" />
                      ) : (
                        <ThumbsDown className="h-4 w-4 text-red-600 mt-1" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={item.rating === "up" ? "secondary" : "destructive"}>
                            {item.rating === "up" ? "Positive" : "Negative"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.timestamp), "MMM d, h:mm a")}
                          </span>
                        </div>
                        {item.comment && (
                          <p className="text-sm text-muted-foreground">{item.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Vanessa's performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Positive Feedback</span>
                    <span className="text-sm text-muted-foreground">
                      {summary?.positiveCount || 0} / {summary?.totalFeedback || 0}
                    </span>
                  </div>
                  <Progress value={satisfactionRate} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Knowledge Coverage</span>
                    <span className="text-sm text-muted-foreground">
                      {stats?.totalKnowledge || 0} topics
                    </span>
                  </div>
                  <Progress value={Math.min((stats?.totalKnowledge || 0) * 10, 100)} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
