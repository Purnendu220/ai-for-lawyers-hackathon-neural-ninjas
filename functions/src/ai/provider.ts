import type { Extraction, SourceUnit } from '@casepilot/shared';

/** One page (PDF) or section (DOCX) of extracted text. */
export type DocumentPage = { page: number; text: string };

export type ExtractionRequest = {
  documentId: string;
  /** SHA-256 of the original file. The fixture provider replays recordings by this hash. */
  sha256: string;
  sourceUnit: SourceUnit;
  pages: DocumentPage[];
};

export type AiResult<T> = {
  output: T;
  /** 'fixture' results are replays and must be labelled as such in the UI. */
  mode: 'live' | 'fixture';
  model: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number } | null;
  latencyMs: number;
};

/**
 * The only way functions talk to a model (docs/ARCHITECTURE.md §6.1). Copilot answers, action
 * plans and translation join this interface on Days 5–6.
 */
export interface AiProvider {
  extract(request: ExtractionRequest): Promise<AiResult<Extraction>>;
}
