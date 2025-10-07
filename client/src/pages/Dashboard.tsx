import { DashboardCard } from "@/components/DashboardCard";
import { TalentCard } from "@/components/TalentCard";
import { TaskBoard } from "@/components/TaskBoard";
import { PerformanceChart } from "@/components/PerformanceChart";
import { ROICalculator } from "@/components/ROICalculator";
import { ServiceModels } from "@/components/ServiceModels";
import { FourPSystem } from "@/components/FourPSystem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  DollarSign,
  TrendingUp,
  Briefcase,
  Search,
  Plus,
  Bell,
  Filter,
  Activity,
  Target,
  BarChart3,
  Phone,
  Calendar,
  Award,
  MessageSquare,
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Area, AreaChart } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from 'react';
//todo: remove mock functionality
import avatarImage from "@assets/generated_images/Professional_talent_avatar_71613d75.png";

export default function Dashboard() {
  const [timeFilter, setTimeFilter] = useState<'monthly' | 'weekly'>('monthly');
  const [performanceFilter, setPerformanceFilter] = useState<'monthly' | 'weekly'>('monthly');

  //todo: remove mock functionality
  const performanceData = [
    { period: "Jan", productivity: 78, satisfaction: 85, costSavings: 12000 },
    { period: "Feb", productivity: 82, satisfaction: 88, costSavings: 15000 },
    { period: "Mar", productivity: 79, satisfaction: 86, costSavings: 18000 },
    { period: "Apr", productivity: 85, satisfaction: 91, costSavings: 22000 },
    { period: "May", productivity: 88, satisfaction: 93, costSavings: 25000 },
    { period: "Jun", productivity: 91, satisfaction: 95, costSavings: 28000 },
  ];

  // Mock data for analytics
  const monthlyClientSatisfaction = [
    { month: 'Jan', score: 4.2 },
    { month: 'Feb', score: 4.5 },
    { month: 'Mar', score: 4.3 },
    { month: 'Apr', score: 4.6 },
    { month: 'May', score: 4.8 },
    { month: 'Jun', score: 4.7 },
  ];

  const weeklyClientSatisfaction = [
    { month: 'Week 1', score: 4.5 },
    { month: 'Week 2', score: 4.6 },
    { month: 'Week 3', score: 4.4 },
    { month: 'Week 4', score: 4.7 },
  ];

  const monthlyMoMAverage = [
    { month: 'Jan', onTime: 85, quality: 90, efficiency: 88 },
    { month: 'Feb', onTime: 87, quality: 92, efficiency: 89 },
    { month: 'Mar', onTime: 86, quality: 91, efficiency: 90 },
    { month: 'Apr', onTime: 89, quality: 93, efficiency: 91 },
    { month: 'May', onTime: 90, quality: 94, efficiency: 92 },
    { month: 'Jun', onTime: 91, quality: 95, efficiency: 93 },
  ];

  const weeklyMoMAverage = [
    { month: 'Week 1', onTime: 88, quality: 92, efficiency: 90 },
    { month: 'Week 2', onTime: 90, quality: 94, efficiency: 91 },
    { month: 'Week 3', onTime: 89, quality: 93, efficiency: 92 },
    { month: 'Week 4', onTime: 91, quality: 95, efficiency: 93 },
  ];

  const attendanceData = [
    { name: 'Maria Santos', attendance: 98, days: '24/25' },
    { name: 'Carlos Reyes', attendance: 96, days: '23/25' },
    { name: 'Ana Dela Cruz', attendance: 100, days: '25/25' },
    { name: 'Juan Pablo', attendance: 94, days: '22/25' },
  ];

  const monthlyProductivity = [
    { month: 'Jan', value: 78 },
    { month: 'Feb', value: 82 },
    { month: 'Mar', value: 79 },
    { month: 'Apr', value: 85 },
    { month: 'May', value: 88 },
    { month: 'Jun', value: 91 },
  ];

  const weeklyProductivity = [
    { month: 'Week 1', value: 85 },
    { month: 'Week 2', value: 88 },
    { month: 'Week 3', value: 87 },
    { month: 'Week 4', value: 91 },
  ];

  const monthlyProjects = [
    { month: 'Jan', completed: 12, inProgress: 8, planned: 5 },
    { month: 'Feb', completed: 15, inProgress: 10, planned: 6 },
    { month: 'Mar', completed: 13, inProgress: 9, planned: 7 },
    { month: 'Apr', completed: 18, inProgress: 11, planned: 8 },
    { month: 'May', completed: 20, inProgress: 12, planned: 9 },
    { month: 'Jun', completed: 22, inProgress: 14, planned: 10 },
  ];

  const weeklyProjects = [
    { month: 'Week 1', completed: 5, inProgress: 3, planned: 2 },
    { month: 'Week 2', completed: 6, inProgress: 4, planned: 3 },
    { month: 'Week 3', completed: 5, inProgress: 3, planned: 2 },
    { month: 'Week 4', completed: 6, inProgress: 4, planned: 3 },
  ];

  const monthlyCalls = [
    { month: 'Jan', calls: 145 },
    { month: 'Feb', calls: 162 },
    { month: 'Mar', calls: 158 },
    { month: 'Apr', calls: 178 },
    { month: 'May', calls: 185 },
    { month: 'Jun', calls: 192 },
  ];

  const weeklyCalls = [
    { month: 'Week 1', calls: 45 },
    { month: 'Week 2', calls: 48 },
    { month: 'Week 3', calls: 47 },
    { month: 'Week 4', calls: 52 },
  ];

  // Performance Summary Mock Data
  const radarData = [
    { subject: 'Quality', value: 92 },
    { subject: 'Speed', value: 88 },
    { subject: 'Communication', value: 95 },
    { subject: 'Innovation', value: 85 },
    { subject: 'Reliability', value: 90 },
  ];

  const attendanceDonutData = [
    { name: 'Present', value: 96 },
    { name: 'Absent', value: 4 },
  ];

  const workDistributionData = [
    { task: 'Development', hours: 120 },
    { task: 'Testing', hours: 80 },
    { task: 'Documentation', hours: 40 },
    { task: 'Meetings', hours: 60 },
  ];

  const talentScorecard = [
    { name: 'Maria Santos', performance: 95, quality: 92, attendance: 98 },
    { name: 'Carlos Reyes', performance: 88, quality: 90, attendance: 96 },
    { name: 'Ana Dela Cruz', performance: 92, quality: 94, attendance: 100 },
    { name: 'Juan Pablo', performance: 85, quality: 88, attendance: 94 },
  ];

  const clientFeedback = [
    { client: 'TechCorp', feedback: 'Excellent work on the API integration', sentiment: 'positive' },
    { client: 'StartupXYZ', feedback: 'Could improve response time', sentiment: 'neutral' },
    { client: 'Enterprise Inc', feedback: 'Outstanding quality and communication', sentiment: 'positive' },
    { client: 'SmallBiz Co', feedback: 'Good progress, minor delays', sentiment: 'neutral' },
  ];

  const clientSatisfactionData = timeFilter === 'monthly' ? monthlyClientSatisfaction : weeklyClientSatisfaction;
  const momAverageData = timeFilter === 'monthly' ? monthlyMoMAverage : weeklyMoMAverage;
  const productivityData = timeFilter === 'monthly' ? monthlyProductivity : weeklyProductivity;
  const projectsData = timeFilter === 'monthly' ? monthlyProjects : weeklyProjects;
  const callsData = timeFilter === 'monthly' ? monthlyCalls : weeklyCalls;

  const perfClientSatisfactionData = performanceFilter === 'monthly' ? monthlyClientSatisfaction : weeklyClientSatisfaction;
  const perfMomAverageData = performanceFilter === 'monthly' ? monthlyMoMAverage : weeklyMoMAverage;
  const perfProjectsData = performanceFilter === 'monthly' ? monthlyProjects : weeklyProjects;

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
  const DONUT_COLORS = ['#10b981', '#ef4444'];

  const roiData = {
    totalCostSavings: 50000000, // $50M value delivered since 2021
    previousCosts: 280000,
    currentCosts: 84000, // 70% cost savings
    timeToROI: 3, // Faster ROI with OnSpot
    teamProductivity: 85, // Employee NPS
    clientSatisfaction: 75, // Client NPS
  };

  const mockTasks = {
    todo: [
      {
        id: "task-1",
        title: "Design new landing page",
        description:
          "Create wireframes and mockups for the new product landing page",
        priority: "high" as const,
        assignee: { name: "Sarah Chen" },
        dueDate: "Dec 15",
        comments: 3,
        attachments: 2,
      },
      {
        id: "task-2",
        title: "API integration testing",
        priority: "medium" as const,
        assignee: { name: "Marcus Rodriguez" },
        dueDate: "Dec 18",
        comments: 1,
      },
    ],
    inProgress: [
      {
        id: "task-3",
        title: "Database optimization",
        description: "Optimize database queries for better performance",
        priority: "high" as const,
        assignee: { name: "Priya Sharma" },
        dueDate: "Dec 12",
        comments: 5,
        attachments: 1,
      },
    ],
    review: [
      {
        id: "task-4",
        title: "User authentication flow",
        priority: "medium" as const,
        assignee: { name: "David Kim" },
        comments: 2,
      },
    ],
    completed: [
      {
        id: "task-5",
        title: "Payment gateway setup",
        priority: "high" as const,
        assignee: { name: "Sarah Chen" },
        comments: 4,
      },
    ],
  };

  const handleNewProject = () => {
    console.log("New project clicked");
  };

  const handleViewAllTalent = () => {
    console.log("View all talent clicked");
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">
            Welcome to OnSpot
          </h1>
          <p className="text-muted-foreground">
            Making Outsourcing Easy - Built by entrepreneurs, for entrepreneurs.
            Cut costs by up to 70% and fuel 8X business growth.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            data-testid="button-notifications"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <Button onClick={handleNewProject} data-testid="button-new-project">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Key Metrics
            </CardTitle>
            <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as 'monthly' | 'weekly')}>
              <SelectTrigger className="w-36" data-testid="select-time-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Client Satisfaction - Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Client Satisfaction
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={clientSatisfactionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} domain={[0, 5]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* MoM Average - Grouped Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  MoM Average Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={momAverageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="onTime" fill="#3b82f6" name="On Time" />
                    <Bar dataKey="quality" fill="#8b5cf6" name="Quality" />
                    <Bar dataKey="efficiency" fill="#10b981" name="Efficiency" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Attendance - Table with Progress Bars */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Attendance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {attendanceData.map((item) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted-foreground">{item.days}</span>
                      </div>
                      <Progress value={item.attendance} className="h-2" />
                      <div className="text-xs text-right text-muted-foreground">{item.attendance}%</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Productivity - Time Series Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Productivity Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={productivityData}>
                    <defs>
                      <linearGradient id="colorProductivity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorProductivity)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Projects - Stacked Vertical Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Projects Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={projectsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="completed" stackId="a" fill="#10b981" name="Completed" />
                    <Bar dataKey="inProgress" stackId="a" fill="#f59e0b" name="In Progress" />
                    <Bar dataKey="planned" stackId="a" fill="#6b7280" name="Planned" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Number of Calls - Sparkline Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Number of Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{callsData[callsData.length - 1]?.calls || 0}</span>
                    <Badge variant="outline" className="text-xs">
                      {timeFilter === 'monthly' ? 'This Month' : 'This Week'}
                    </Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={callsData}>
                      <Line type="monotone" dataKey="calls" stroke="#ec4899" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary Metrics */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Performance Summary
            </CardTitle>
            <Select value={performanceFilter} onValueChange={(value) => setPerformanceFilter(value as 'monthly' | 'weekly')}>
              <SelectTrigger className="w-36" data-testid="select-performance-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Client Satisfaction - Radar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Client Satisfaction Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Monthly Average - Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Performance Average
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={perfMomAverageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="quality" fill="#8b5cf6" name="Quality" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Attendance % - Donut Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Attendance %
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={attendanceDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {attendanceDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Projects - Weekly Stacked Bars */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Projects Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={perfProjectsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="month" type="category" stroke="#6b7280" tick={{ fontSize: 11 }} width={60} />
                    <Tooltip />
                    <Bar dataKey="completed" stackId="a" fill="#10b981" name="Completed" />
                    <Bar dataKey="inProgress" stackId="a" fill="#f59e0b" name="In Progress" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Productivity - Work Distribution - Horizontal Bar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Work Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={workDistributionData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="task" stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="hours" fill="#ec4899" name="Hours" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Talent Scorecard - Table */}
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Talent Scorecard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">KPI</TableHead>
                        <TableHead className="font-semibold">Target</TableHead>
                        <TableHead className="font-semibold">Weight</TableHead>
                        <TableHead className="font-semibold">Actual</TableHead>
                        <TableHead className="font-semibold">Weighted Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Talent 1 */}
                      <TableRow>
                        <TableCell rowSpan={4} className="font-medium border-r">Talent 1</TableCell>
                        <TableCell>Attendance</TableCell>
                        <TableCell>95%</TableCell>
                        <TableCell>30%</TableCell>
                        <TableCell>98%</TableCell>
                        <TableCell>29.4</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>CSAT</TableCell>
                        <TableCell>90%</TableCell>
                        <TableCell>40%</TableCell>
                        <TableCell>92%</TableCell>
                        <TableCell>36.8</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Productivity</TableCell>
                        <TableCell>85%</TableCell>
                        <TableCell>30%</TableCell>
                        <TableCell>88%</TableCell>
                        <TableCell>26.4</TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={4} className="font-semibold">Talent 1 Overall</TableCell>
                        <TableCell className="font-semibold">92.6</TableCell>
                      </TableRow>

                      {/* Talent 2 */}
                      <TableRow>
                        <TableCell rowSpan={4} className="font-medium border-r">Talent 2</TableCell>
                        <TableCell>Attendance</TableCell>
                        <TableCell>95%</TableCell>
                        <TableCell>30%</TableCell>
                        <TableCell>96%</TableCell>
                        <TableCell>28.8</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>CSAT</TableCell>
                        <TableCell>90%</TableCell>
                        <TableCell>40%</TableCell>
                        <TableCell>89%</TableCell>
                        <TableCell>35.6</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Productivity</TableCell>
                        <TableCell>85%</TableCell>
                        <TableCell>30%</TableCell>
                        <TableCell>85%</TableCell>
                        <TableCell>25.5</TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={4} className="font-semibold">Talent 2 Overall</TableCell>
                        <TableCell className="font-semibold">89.9</TableCell>
                      </TableRow>

                      {/* Talent 3 */}
                      <TableRow>
                        <TableCell rowSpan={4} className="font-medium border-r">Talent 3</TableCell>
                        <TableCell>Attendance</TableCell>
                        <TableCell>95%</TableCell>
                        <TableCell>30%</TableCell>
                        <TableCell>100%</TableCell>
                        <TableCell>30.0</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>CSAT</TableCell>
                        <TableCell>90%</TableCell>
                        <TableCell>40%</TableCell>
                        <TableCell>94%</TableCell>
                        <TableCell>37.6</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Productivity</TableCell>
                        <TableCell>85%</TableCell>
                        <TableCell>30%</TableCell>
                        <TableCell>90%</TableCell>
                        <TableCell>27.0</TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={4} className="font-semibold">Talent 3 Overall</TableCell>
                        <TableCell className="font-semibold">94.6</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Client Feedback / Call Out and Coaching - Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Client Feedback / Call Out and Coaching
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Feedback</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Coaching Date</TableHead>
                      <TableHead className="font-semibold">RCA</TableHead>
                      <TableHead className="font-semibold">Action Plan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Talent Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Talent
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search talent..."
                  className="pl-8 w-48"
                  data-testid="input-talent-search"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-filter-talent"
              >
                <Filter className="h-4 w-4 mr-1" />
                Filter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewAllTalent}
                data-testid="button-view-all-talent"
              >
                View All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TalentCard
              id="talent-1"
              name="Maria Santos"
              role="Senior Full Stack Developer"
              location="Manila, Philippines"
              hourlyRate={25}
              rating={4.9}
              skills={["React", "Node.js", "TypeScript", "Python", "AWS"]}
              avatarUrl={avatarImage}
              experience="5+ years"
              availability="available"
            />
            <TalentCard
              id="talent-2"
              name="Carlos Reyes"
              role="Customer Support Specialist"
              location="Cebu, Philippines"
              hourlyRate={8}
              rating={4.8}
              skills={[
                "English Fluency",
                "CRM Management",
                "Technical Support",
                "Customer Service",
              ]}
              experience="3+ years"
              availability="available"
            />
            <TalentCard
              id="talent-3"
              name="Ana Dela Cruz"
              role="Virtual Assistant"
              location="Davao, Philippines"
              hourlyRate={6}
              rating={4.7}
              skills={[
                "Admin Support",
                "Data Entry",
                "Social Media",
                "Lead Generation",
              ]}
              experience="4+ years"
              availability="available"
            />
          </div>
        </CardContent>
      </Card>

      {/* Project Management */}
      <TaskBoard tasks={mockTasks} />

      {/* Service Models */}
      <ServiceModels />

      {/* 4P System */}
      <FourPSystem />

      {/* AI Insights Section */}
      <Card>
        <CardHeader>
          <CardTitle>OnSpot Insights & Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
              <div>
                <p className="text-sm font-medium">
                  Philippine Talent Pool Alert
                </p>
                <p className="text-sm text-muted-foreground">
                  15 pre-vetted specialists from our 50k+ talent pool match your
                  project requirements. Start scaling in 21 days.
                </p>
                <Badge variant="outline" className="mt-1 text-xs">
                  High Priority
                </Badge>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
              <div>
                <p className="text-sm font-medium">Cost Savings Opportunity</p>
                <p className="text-sm text-muted-foreground">
                  Upgrading to our Managed service could save you up to 70% on
                  operational costs while boosting productivity.
                </p>
                <Badge variant="outline" className="mt-1 text-xs">
                  70% Savings
                </Badge>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <div className="h-2 w-2 rounded-full bg-purple-500 mt-2" />
              <div>
                <p className="text-sm font-medium">Growth Potential</p>
                <p className="text-sm text-muted-foreground">
                  Based on our 4P System analysis, your business is positioned
                  for 8X growth potential with the right outsourcing strategy.
                </p>
                <Badge variant="outline" className="mt-1 text-xs">
                  8X Growth
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
