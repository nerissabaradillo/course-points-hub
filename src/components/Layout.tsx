import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Trophy, LayoutDashboard, GraduationCap, Medal, Plus, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { to: "/admin/courses", label: "Courses", icon: GraduationCap },
  { to: "/admin/events", label: "Events", icon: Medal },
  { to: "/admin/scores", label: "Scores", icon: Plus },
];

export default function Layout() {
  const { user, isAdmin, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-hero text-primary-foreground shadow-elegant">
              <Trophy className="h-5 w-5" />
            </div>
            <span className="hidden sm:inline">Pakusganay</span>
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-smooth",
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </NavLink>

            {isAdmin &&
              adminNavItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-smooth",
                      isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{label}</span>
                </NavLink>
              ))}
          </nav>

          <div className="flex items-center gap-2">
            {!loading && user ? (
              <>
                {isAdmin && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Admin
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Sign out</span>
                </Button>
              </>
            ) : (
              <Button variant="default" size="sm" asChild>
                <Link to="/auth">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Admin login</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        Intramurals Scoring System
      </footer>
    </div>
  );
}
