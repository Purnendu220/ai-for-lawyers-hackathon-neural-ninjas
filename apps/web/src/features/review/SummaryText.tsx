import { useMutation } from '@tanstack/react-query';
import type { Timestamp } from 'firebase/firestore';
import { Languages } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { can, type AnalysisDoc } from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCase } from '@/features/cases/case-context';
import { useActiveOrg } from '@/features/org/org-context';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import type { WithId } from '@/lib/live';
import { useOnline } from '@/pwa/online';

/** The analysis summary in English, or in Hindi by machine translation on request. */
export function SummaryText({ analysis }: { analysis: WithId<AnalysisDoc<Timestamp>> }) {
  const kase = useCase();
  const { id: orgId, org, member } = useActiveOrg();
  const online = useOnline();
  const [language, setLanguage] = useState<'en' | 'hi'>(
    org.defaultLanguage === 'hi' && analysis.summaryHi ? 'hi' : 'en',
  );
  const translate = useMutation({
    mutationFn: () =>
      call(
        'translateSummary',
        { orgId, caseId: kase.id, analysisId: analysis.id },
        { timeout: 120_000 },
      ),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const canTranslate = can(member.role, 'copilot.ask', org.policy);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="inline-flex w-fit rounded-md border p-0.5"
        role="group"
        aria-label="Summary language"
      >
        {(['en', 'hi'] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={language === option ? 'secondary' : 'ghost'}
            className="h-7"
            aria-pressed={language === option}
            onClick={() => setLanguage(option)}
          >
            {option === 'en' ? 'English' : 'हिन्दी'}
          </Button>
        ))}
      </div>
      {language === 'en' ? (
        <p>{analysis.summary}</p>
      ) : analysis.summaryHi ? (
        <>
          <p lang="hi">{analysis.summaryHi}</p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Machine translation. Check it against the English summary and the order.
            {analysis.summaryHiMode === 'fixture' && (
              <Badge variant="warning">Test translation</Badge>
            )}
          </p>
        </>
      ) : canTranslate ? (
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          disabled={translate.isPending || !online}
          onClick={() => translate.mutate()}
        >
          <Languages aria-hidden />
          {translate.isPending ? 'Translating…' : 'Translate into Hindi'}
        </Button>
      ) : (
        <p className="text-muted-foreground">No Hindi summary yet.</p>
      )}
    </div>
  );
}
