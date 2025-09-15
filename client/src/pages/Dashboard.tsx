import { DashboardCard } from '@/components/DashboardCard'
import { TalentCard } from '@/components/TalentCard'
import { TaskBoard } from '@/components/TaskBoard'
import { PerformanceChart } from '@/components/PerformanceChart'
import { ROICalculator } from '@/components/ROICalculator'
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
    totalCostSavings: 145000,
    previousCosts: 280000,
    currentCosts: 135000,
    timeToROI: 6,
    teamProductivity: 91,
    clientSatisfaction: 95
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
            Welcome to OnSpot Platform
          </h1>
          <p className="text-muted-foreground">
            Making Outsourcing Easy - Your complete outsourcing management hub
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
          title="Active Talent"
          value="247"
          change={{ value: 12, type: 'increase' }}
          subtitle="Available now"
          icon={<Users className="h-4 w-4" />}
        />
        <DashboardCard
          title="Cost Savings"
          value="$85,430"
          change={{ value: 8, type: 'increase' }}
          subtitle="This month"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <DashboardCard
          title="Performance"
          value="94%"
          change={{ value: -2, type: 'decrease' }}
          subtitle="Team productivity"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <DashboardCard
          title="Active Projects"
          value="38"
          subtitle="In progress"
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
              name="Sarah Chen"
              role="Senior Full Stack Developer"
              location="San Francisco, CA"
              hourlyRate={85}
              rating={4.9}
              skills={["React", "Node.js", "TypeScript", "Python", "AWS"]}
              avatarUrl={avatarImage}
              experience="5+ years"
              availability="available"
            />
            <TalentCard
              id="talent-2"
              name="Marcus Rodriguez"
              role="UI/UX Designer"
              location="New York, NY"
              hourlyRate={75}
              rating={4.8}
              skills={["Figma", "Adobe Creative Suite", "Prototyping", "User Research"]}
              experience="4+ years"
              availability="busy"
            />
            <TalentCard
              id="talent-3"
              name="Priya Sharma"
              role="Data Analyst"
              location="Remote"
              hourlyRate={65}
              rating={4.7}
              skills={["Python", "SQL", "Tableau", "Machine Learning"]}
              experience="3+ years"
              availability="offline"
            />
          </div>
        </CardContent>
      </Card>

      {/* Project Management */}
      <TaskBoard tasks={mockTasks} />

      {/* AI Insights Section */}
      <Card>
        <CardHeader>
          <CardTitle>AI Insights & Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
              <div>
                <p className="text-sm font-medium">Talent Match Opportunity</p>
                <p className="text-sm text-muted-foreground">
                  3 new developers with React expertise are available that match your current project requirements.
                </p>
                <Badge variant="outline" className="mt-1 text-xs">High Priority</Badge>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
              <div>
                <p className="text-sm font-medium">Cost Optimization</p>
                <p className="text-sm text-muted-foreground">
                  Switching to our recommended talent pool could save you an additional $12,000 this quarter.
                </p>
                <Badge variant="outline" className="mt-1 text-xs">Savings Opportunity</Badge>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
              <div className="h-2 w-2 rounded-full bg-yellow-500 mt-2" />
              <div>
                <p className="text-sm font-medium">Performance Alert</p>
                <p className="text-sm text-muted-foreground">
                  Project "Database optimization" is approaching deadline. Consider adding more resources.
                </p>
                <Badge variant="outline" className="mt-1 text-xs">Action Needed</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}