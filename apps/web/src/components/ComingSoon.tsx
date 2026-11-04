import { Construction } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Placeholder for a screen that lands later in docs/IMPLEMENTATION_PLAN.md. */
export function ComingSoon({
  title,
  description,
  plannedFor,
}: {
  title: string;
  description: string;
  plannedFor: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Construction className="size-4 text-warning" aria-hidden />
            Not built yet
          </CardTitle>
          <CardDescription>{plannedFor}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{description}</CardContent>
      </Card>
    </div>
  );
}
