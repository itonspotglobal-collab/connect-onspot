import { DashboardCard } from '@/components/DashboardCard'
import { TalentCard } from '@/components/TalentCard'
import { TaskBoard } from '@/components/TaskBoard'
import { PerformanceChart } from '@/components/PerformanceChart'
import { ROICalculator } from '@/components/ROICalculator'
import { ServiceModels } from '@/components/ServiceModels'
import { FourPSystem } from '@/components/FourPSystem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Briefcase, 
  Search,
  Plus,
  Bell,
  Filter
} from 'lucide-react'
//todo: remove mock functionality
import avatarImage from '@assets/generated_images/Professional_talent_avatar_71613d75.png'

export default function Dashboard() {
  //todo: remove mock functionality
  const performanceData = [
    { period: 'Jan', productivity: 78, satisfaction: 85, costSavings: 12000 },
    { period: 'Feb', productivity: 82, satisfaction: 88, costSavings: 15000 },
    { period: 'Mar', productivity: 79, satisfaction: 86, costSavings: 18000 },
    { period: 'Apr', productivity: 85, satisfaction: 91, costSavings: 22000 },
    { period: 'May', productivity: 88, satisfaction: 93, costSavings: 25000 },
    { period: 'Jun', productivity: 91, satisfaction: 95, costSavings: 28000 }
  ]

  const roiData = {
    totalCostSavings: 50000000, // $50M value delivered since 2021
    previousCosts: 280000,
    currentCosts: 84000, // 70% cost savings  
    timeToROI: 3, // Faster ROI with OnSpot
    teamProductivity: 85, // Employee NPS
    clientSatisfaction: 75 // Client NPS
  }

  const mockTasks = {
    todo: [
      {
        id: 'task-1',
        title: 'Design new landing page',
        description: 'Create wireframes and mockups for the new product landing page',
        priority: 'high' as const,
        assignee: { name: 'Sarah Chen' },
        dueDate: 'Dec 15',
        comments: 3,
        attachments: 2
      },
      {
        id: 'task-2',
        title: 'API integration testing',
        priority: 'medium' as const,
        assignee: { name: 'Marcus Rodriguez' },
        dueDate: 'Dec 18',
        comments: 1
      }
    ],
    inProgress: [
      {
        id: 'task-3',
        title: 'Database optimization',
        description: 'Optimize database queries for better performance',
        priority: 'high' as const,
        assignee: { name: 'Priya Sharma' },
        dueDate: 'Dec 12',
        comments: 5,
        attachments: 1
      }
    ],
    review: [
      {
        id: 'task-4',
        title: 'User authentication flow',
        priority: 'medium' as const,
        assignee: { name: 'David Kim' },
        comments: 2
      }
    ],
    completed: [
      {
        id: 'task-5',
        title: 'Payment gateway setup',
        priority: 'high' as const,
        assignee: { name: 'Sarah Chen' },
        comments: 4
      }
    ]
  }

  const handleNewProject = () => {
    console.log('New project clicked')
  }

  const handleViewAllTalent = () => {
    console.log('View all talent clicked')
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">
            Welcome to OnSpot
          </h1>
          <p className="text-muted-foreground">
            Making Outsourcing Easy - Built by entrepreneurs, for entrepreneurs. Cut costs by up to 70% and fuel 8X business growth.
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
          <Button 
            onClick={handleNewProject}
            data-testid="button-new-project"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Resources Deployed"
          value="500+"
          change={{ value: 15, type: 'increase' }}
          subtitle="Supporting client operations"
          icon={<Users className="h-4 w-4" />}
        />
        <DashboardCard
          title="Value Delivered"
          value="$50M"
          change={{ value: 12, type: 'increase' }}
          subtitle="Since 2021"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <DashboardCard
          title="Client Satisfaction"
          value="75%"
          subtitle="Net Promoter Score"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <DashboardCard
          title="Active Clients"
          value="85"
          change={{ value: 8, type: 'increase' }}
          subtitle="Across industries"
          icon={<Briefcase className="h-4 w-4" />}
        />
      </div>

      {/* Performance Charts and ROI */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PerformanceChart
              data={performanceData}
              type="line"
              title="Team Productivity"
              metric="productivity"
            />
            <PerformanceChart
              data={performanceData}
              type="line"
              title="Client Satisfaction"
              metric="satisfaction"
            />
            <PerformanceChart
              data={performanceData}
              type="bar"
              title="Monthly Savings"
              metric="costSavings"
            />
          </div>
        </div>
        <div className="lg:col-span-1">
          <ROICalculator 
            data={roiData}
            period="Q4 2024"
          />
        </div>
      </div>

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
              skills={["English Fluency", "CRM Management", "Technical Support", "Customer Service"]}
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
              skills={["Admin Support", "Data Entry", "Social Media", "Lead Generation"]}
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
                <p className="text-sm font-medium">Philippine Talent Pool Alert</p>
                <p className="text-sm text-muted-foreground">
                  15 pre-vetted specialists from our 50k+ talent pool match your project requirements. Start scaling in 21 days.
                </p>
                <Badge variant="outline" className="mt-1 text-xs">High Priority</Badge>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
              <div>
                <p className="text-sm font-medium">Cost Savings Opportunity</p>
                <p className="text-sm text-muted-foreground">
                  Upgrading to our Managed service could save you up to 70% on operational costs while boosting productivity.
                </p>
                <Badge variant="outline" className="mt-1 text-xs">70% Savings</Badge>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <div className="h-2 w-2 rounded-full bg-purple-500 mt-2" />
              <div>
                <p className="text-sm font-medium">Growth Potential</p>
                <p className="text-sm text-muted-foreground">
                  Based on our 4P System analysis, your business is positioned for 8X growth potential with the right outsourcing strategy.
                </p>
                <Badge variant="outline" className="mt-1 text-xs">8X Growth</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}