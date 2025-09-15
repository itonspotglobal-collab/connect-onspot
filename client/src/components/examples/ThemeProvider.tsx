import { ThemeProvider } from '../ThemeProvider'
import { ThemeToggle } from '../ThemeToggle'

export default function ThemeProviderExample() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="demo-theme">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Theme Example</h2>
          <ThemeToggle />
        </div>
        <p className="text-muted-foreground">
          Toggle between light and dark themes using the button above.
        </p>
      </div>
    </ThemeProvider>
  )
}