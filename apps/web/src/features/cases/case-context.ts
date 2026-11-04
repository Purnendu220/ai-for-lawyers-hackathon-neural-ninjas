import { useOutletContext } from 'react-router';
import type { Case } from './useCases';

export type CaseContext = { kase: Case };

/** The case loaded by CaseLayout, for the screens under /cases/:caseId. */
export function useCase(): Case {
  return useOutletContext<CaseContext>().kase;
}
