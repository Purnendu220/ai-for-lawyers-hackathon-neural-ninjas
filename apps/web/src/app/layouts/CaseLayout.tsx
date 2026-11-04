import { NavLink, Outlet, useParams } from 'react-router';
import { cn } from '@/lib/utils';

const TABS = [
  { to: 'overview', label: 'Overview' },
  { to: 'documents', label: 'Documents' },
  { to: 'timeline', label: 'Timeline' },
  { to: 'tasks', label: 'Tasks' },
  { to: 'copilot', label: 'Copilot' },
];

/** Case header and tabs. The case document itself is loaded from Day 2. */
export function CaseLayout() {
  const { caseId } = useParams();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <p className="text-xs text-muted-foreground">Case</p>
        <h1 className="text-2xl font-semibold tracking-tight">{caseId}</h1>
      </div>
      <nav aria-label="Case sections" className="-mx-4 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground',
                  isActive && 'border-primary text-foreground',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
