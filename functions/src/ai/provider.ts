import type { CopilotAnswer, Extraction, SourceUnit } from '@casepilot/shared';

/** One page (PDF) or section (DOCX) of extracted text. */
export type DocumentPage = { page: number; text: string };

export type ExtractionRequest = {
  documentId: string;
  /** SHA-256 of the original file. The fixture provider replays recordings by this hash. */
  sha256: string;
  sourceUnit: SourceUnit;
  pages: DocumentPage[];
};

/** A retrieved passage, labelled so the model can cite it (`c1`, `c2`, …). */
export type Excerpt = { label: string; unit: SourceUnit; page: number; text: string };

export type CopilotRequest = { question: string; excerpts: Excerpt[] };

export type TranslationRequest = { text: string; to: 'en' | 'hi' };

export type AiResult<T> = {
  output: T;
  /** 'fixture' results are replays or test stand-ins and must be labelled as such in the UI. */
  mode: 'live' | 'fixture';
  model: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number } | null;
  latencyMs: number;
};

/** The only way functions talk to a model (docs/ARCHITECTURE.md §6.1). */
export interface AiProvider {
  extract(request: ExtractionRequest): Promise<AiResult<Extraction>>;
  answer(request: CopilotRequest): Promise<AiResult<CopilotAnswer>>;
  translate(request: TranslationRequest): Promise<AiResult<string>>;
}
