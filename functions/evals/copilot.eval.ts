// Live evaluation of the copilot prompt (implementation plan, Day 6). Calls Claude for real, so it
// only runs when ANTHROPIC_API_KEY is set: npm run eval -w @casepilot/functions
import { afterAll, describe, expect, it } from 'vitest';
import { createAnthropicProvider } from '../src/ai/anthropic';
import { normalizeForMatch } from '../src/ai/citations';
import type { Excerpt } from '../src/ai/provider';

const apiKey = process.env.ANTHROPIC_API_KEY;

const excerpts: Excerpt[] = [
  { label: 'c1', unit: 'page', page: 1, text: 'FICTIONAL SAMPLE - NOT A REAL COURT ORDER. Demo Civil Court, Delhi. ABC Traders v. XYZ Supplies. Order dated 2 November 2026.' },
  { label: 'c2', unit: 'page', page: 1, text: '1. The plaintiff shall file its updated statement of account within 14 days from the date of this order. 2. The defendant may file a response within 14 days after service of the updated statement of account.' },
  { label: 'c3', unit: 'page', page: 1, text: '3. The matter is listed for the next hearing on 15 December 2026. 4. Both parties shall ensure that their authorized representatives are available on the next date.' },
];

type Row = { question: string; passed: number; checks: number; sources: string; failed: string };
const rows: Row[] = [];

const cases = [
  {
    question: 'When is the next hearing?',
    checks: (a: Awaited<ReturnType<ReturnType<typeof createAnthropicProvider>['answer']>>['output']) => ({
      'answers from the documents': !a.insufficientEvidence,
      'mentions 15 December 2026': /15 December 2026|15\/12\/2026|2026-12-15/.test(a.answer),
      'cites the hearing passage': a.sources.some((s) => s.chunkId === 'c3'),
      'cites only given passages': a.sources.every((s) => ['c1', 'c2', 'c3'].includes(s.chunkId)),
      'quotes are verbatim': a.sources.every((s) => {
        const text = excerpts.find((e) => e.label === s.chunkId)?.text ?? '';
        return !s.quote || normalizeForMatch(text).includes(normalizeForMatch(s.quote));
      }),
    }),
  },
  {
    question: 'How much money does the defendant owe the plaintiff?',
    checks: (a: Awaited<ReturnType<ReturnType<typeof createAnthropicProvider>['answer']>>['output']) => ({
      'says the documents do not establish it': a.insufficientEvidence,
      'invents no amount': !/(rs\.?|₹|inr)\s?\d/i.test(a.answer),
    }),
  },
];

describe.skipIf(!apiKey)('copilot prompt (live Claude)', () => {
  const provider = createAnthropicProvider(apiKey ?? '');

  for (const evalCase of cases) {
    it(evalCase.question, async () => {
      const { output } = await provider.answer({ question: evalCase.question, excerpts });
      const checks = evalCase.checks(output);
      const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
      rows.push({
        question: evalCase.question,
        passed: Object.keys(checks).length - failed.length,
        checks: Object.keys(checks).length,
        sources: output.sources.map((s) => s.chunkId).join(', ') || 'none',
        failed: failed.join('; '),
      });
      for (const [name, ok] of Object.entries(checks)) expect.soft(ok, name).toBe(true);
    });
  }

  afterAll(() => {
    console.table(rows);
  });
});
