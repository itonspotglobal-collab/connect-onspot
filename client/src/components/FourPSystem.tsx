import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Cog, Lightbulb, Target } from "lucide-react"

interface PSystemCardProps {
  title: string
  questions: string[]
  icon: React.ReactNode
  color: string
}

function PSystemCard({ title, questions, icon, color }: PSystemCardProps) {
  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center`}>
            {icon}
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {questions.map((question, index) => (
            <p key={index} className="text-sm text-muted-foreground">
              {question}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function FourPSystem() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl mb-2">The OnSpot Experience</CardTitle>
        <p className="text-muted-foreground">
          Our proven 4P System that transforms your operations
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PSystemCard
            title="PHILOSOPHY"
            questions={[
              "What are you doing well?",
              "What sets you apart?",
              "What are your good qualities?"
            ]}
            icon={<Lightbulb className="h-5 w-5 text-white" />}
            color="bg-blue-500"
          />
          
          <PSystemCard
            title="PEOPLE"
            questions={[
              "Where do you need to improve?",
              "Are resources adequate?",
              "What do others do better than you?"
            ]}
            icon={<Users className="h-5 w-5 text-white" />}
            color="bg-green-500"
          />
          
          <PSystemCard
            title="PROBLEM SOLVING"
            questions={[
              "What are your goals?",
              "Are demands shifting?",
              "How can it be improved?"
            ]}
            icon={<Target className="h-5 w-5 text-white" />}
            color="bg-purple-500"
          />
          
          <PSystemCard
            title="PROCESS"
            questions={[
              "What are the blockers you're facing?",
              "What are factors outside of your control?",
              "How can we optimize workflows?"
            ]}
            icon={<Cog className="h-5 w-5 text-white" />}
            color="bg-orange-500"
          />
        </div>
      </CardContent>
    </Card>
  )
}