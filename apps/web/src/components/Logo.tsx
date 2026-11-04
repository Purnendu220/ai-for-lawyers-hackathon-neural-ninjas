import { cn } from '@/lib/utils';

export function Logo({ className, withName = true }: { className?: string; withName?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <img src="/logo.svg" alt="" className="size-7" />
      {withName && <span>CasePilot AI</span>}
    </span>
  );
}
