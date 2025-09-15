import { Link, useLocation } from "wouter";
import { LoginDialog } from "@/components/LoginDialog";

const navigationItems = [
  { title: "Home", path: "/" },
  { title: "Hire Talent", path: "/hire-talent" },
  { title: "Get Hired", path: "/get-hired" },
  { title: "Why OnSpot", path: "/why-onspot" },
  { title: "Amazing", path: "/amazing" },
  { title: "Pricing", path: "/pricing" },
  { title: "Enterprise", path: "/enterprise" },
  { title: "Insights", path: "/insights" }
];

export function TopNavigation() {
  const [location] = useLocation();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2" data-testid="logo-home">
          <div className="font-bold text-xl text-primary">OnSpot</div>
        </Link>

        {/* Navigation Items */}
        <div className="hidden md:flex items-center space-x-6">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location === item.path 
                  ? "text-primary" 
                  : "text-muted-foreground"
              }`}
              data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {item.title}
            </Link>
          ))}
        </div>

        {/* Login Button */}
        <LoginDialog />
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t">
        <div className="container px-4 py-2">
          <div className="flex flex-wrap gap-4 justify-center">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`text-xs font-medium transition-colors hover:text-primary ${
                  location === item.path 
                    ? "text-primary" 
                    : "text-muted-foreground"
                }`}
                data-testid={`mobile-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}