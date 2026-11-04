import {
  Briefcase,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Download,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plus,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link, NavLink, Outlet, useNavigation } from 'react-router';
import { toast } from 'sonner';
import { ROLE_LABELS, WORKSPACE_FEATURES } from '@casepilot/shared';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser } from '@/features/auth/auth-context';
import { useActiveOrg, useOrgs } from '@/features/org/org-context';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/session';
import { useInstallPrompt } from '@/pwa/install';
import { OfflineBanner } from '@/pwa/OfflineBanner';

type NavItem = { to: string; label: string; icon: LucideIcon; mobile?: boolean };

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, mobile: true },
  { to: '/cases', label: 'Cases', icon: Briefcase, mobile: true },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, mobile: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings, mobile: true },
];

export function AppShell() {
  const { org } = useActiveOrg();
  const navigation = useNavigation();
  const nav = WORKSPACE_FEATURES[org.workspaceType].teamInvites
    ? NAV
    : NAV.filter((item) => item.to !== '/team');

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center px-4 text-white">
          <Logo />
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 p-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent',
                  isActive && 'bg-sidebar-accent text-white',
                )
              }
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur">
          <span className="md:hidden">
            <Logo withName={false} />
          </span>
          <OrgSwitcher />
          <div className="ml-auto flex items-center gap-1">
            <UserMenu />
          </div>
          {navigation.state === 'loading' && (
            <div className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-primary" />
          )}
        </header>
        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {nav
          .filter((item) => item.mobile)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground',
                  isActive && 'text-primary',
                )
              }
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </NavLink>
          ))}
      </nav>
    </div>
  );
}

function OrgSwitcher() {
  const { orgs, switchOrg } = useOrgs();
  const { id, org, member } = useActiveOrg();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="max-w-[60vw] justify-start gap-2 px-2">
          <span className="truncate font-semibold">{org.name}</span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            {ROLE_LABELS[member.role]}
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
        {orgs.map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => void switchOrg(o.id)}>
            <span className="truncate">{o.name}</span>
            {o.id === id && <Check className="ml-auto" aria-label="Current workspace" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/onboarding">
            <Plus aria-hidden />
            New workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const user = useUser();
  const { canInstall, install, showIosHint } = useInstallPrompt();
  const name = user.displayName || user.email || 'Account';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {name.charAt(0).toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="truncate">{name}</div>
          {user.email && (
            <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canInstall && (
          <DropdownMenuItem onSelect={() => void install()}>
            <Download aria-hidden />
            Install app
          </DropdownMenuItem>
        )}
        {showIosHint && (
          <DropdownMenuItem
            onSelect={() =>
              toast.info('To install on iPhone or iPad, tap Share, then "Add to Home Screen".')
            }
          >
            <Download aria-hidden />
            Install app
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
