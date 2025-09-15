import { DashboardCard } from '../DashboardCard'
import { Users, DollarSign, TrendingUp, Briefcase } from 'lucide-react'

export default function DashboardCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
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
  )
}