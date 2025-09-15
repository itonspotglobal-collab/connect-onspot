import { TaskBoard } from '../TaskBoard'

export default function TaskBoardExample() {
  //todo: remove mock functionality
  const mockTasks = {
    todo: [
      {
        id: 'task-1',
        title: 'Design new landing page',
        description: 'Create wireframes and mockups for the new product landing page',
        priority: 'high' as const,
        assignee: {
          name: 'Sarah Chen',
        },
        dueDate: 'Dec 15',
        comments: 3,
        attachments: 2
      },
      {
        id: 'task-2',
        title: 'API integration testing',
        priority: 'medium' as const,
        assignee: {
          name: 'Marcus Rodriguez',
        },
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
        assignee: {
          name: 'Priya Sharma',
        },
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
        assignee: {
          name: 'David Kim',
        },
        comments: 2
      }
    ],
    completed: [
      {
        id: 'task-5',
        title: 'Payment gateway setup',
        priority: 'high' as const,
        assignee: {
          name: 'Sarah Chen',
        },
        comments: 4
      }
    ]
  }

  return (
    <div className="p-4">
      <TaskBoard tasks={mockTasks} />
    </div>
  )
}