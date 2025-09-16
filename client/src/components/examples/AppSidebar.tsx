import { AppSidebar } from '../AppSidebar'
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

export default function AppSidebarExample() {
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties

  return (
    <SidebarProvider style={style}>
      <div className="flex h-96 w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-2 border-b">
            <SidebarTrigger />
            <h1 className="text-sm font-medium">OnSpot</h1>
          </header>
          <main className="flex-1 p-4">
            <p className="text-muted-foreground">
              Main content area - sidebar navigation example
            </p>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}