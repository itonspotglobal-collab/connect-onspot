import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, MessageSquare, Paperclip } from "lucide-react"

interface TaskItem {
  id: string
  title: string
  description?: string
  priority: 'high' | 'medium' | 'low'
  assignee?: {
    name: string
    avatar?: string
  }
  dueDate?: string
  comments?: number
  attachments?: number
}

interface TaskColumnProps {
  title: string
  tasks: TaskItem[]
  color: string
}

function TaskCard({ task }: { task: TaskItem }) {
  const getPriorityColor = () => {
    switch (task.priority) {
      case 'high':
        return 'destructive'
      case 'medium':
        return 'default'
      default:
        return 'secondary'
    }
  }

  const handleTaskClick = () => {
    console.log('Task clicked:', task.title)
  }

  return (
    <Card 
      className="mb-3 hover-elevate cursor-pointer"
      onClick={handleTaskClick}
      data-testid={`card-task-${task.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-sm font-medium line-clamp-2">
            {task.title}
          </h4>
          <Badge variant={getPriorityColor()} className="text-xs ml-2">
            {task.priority}
          </Badge>
        </div>
        
        {task.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {task.assignee && (
              <Avatar className="h-5 w-5">
                <AvatarImage src={task.assignee.avatar} />
                <AvatarFallback className="text-xs">
                  {task.assignee.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
            )}
            {task.dueDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {task.dueDate}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {task.comments && (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {task.comments}
              </div>
            )}
            {task.attachments && (
              <div className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                {task.attachments}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TaskColumn({ title, tasks, color }: TaskColumnProps) {
  return (
    <div className="flex-1 min-w-72">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <h3 className="font-medium text-sm">{title}</h3>
          <Badge variant="secondary" className="text-xs">
            {tasks.length}
          </Badge>
        </div>
      </div>
      <div className="space-y-0">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}

interface TaskBoardProps {
  tasks: {
    todo: TaskItem[]
    inProgress: TaskItem[]
    review: TaskItem[]
    completed: TaskItem[]
  }
}

export function TaskBoard({ tasks }: TaskBoardProps) {
  return (
    <Card data-testid="board-tasks">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Project Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 overflow-x-auto pb-4">
          <TaskColumn
            title="To Do"
            tasks={tasks.todo}
            color="bg-gray-400"
          />
          <TaskColumn
            title="In Progress"
            tasks={tasks.inProgress}
            color="bg-blue-400"
          />
          <TaskColumn
            title="Review"
            tasks={tasks.review}
            color="bg-yellow-400"
          />
          <TaskColumn
            title="Completed"
            tasks={tasks.completed}
            color="bg-green-400"
          />
        </div>
      </CardContent>
    </Card>
  )
}