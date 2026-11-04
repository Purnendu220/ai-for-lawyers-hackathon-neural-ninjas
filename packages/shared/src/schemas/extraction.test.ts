import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Extraction } from './extraction';

// Hand-written test data shaped like the blueprint §9 sample order. Not a model output.
const sample: Extraction = {
  documentSummary: 'Order listing the matter for 15 December 2026 with filing directions.',
  language: 'en',
  caseDetails: {
    caseNumber: null,
    courtName: 'Demo Civil Court, Delhi',
    caseType: null,
    parties: ['ABC Traders', 'XYZ Supplies'],
    dateOfOrder: '2026-11-02',
  },
  facts: [],
  directions: [
    {
      direction: 'Defendant may file a response after service of the updated statement.',
      directionType: 'conditional',
      condition: 'Service of the updated statement of account',
      responsibleParty: 'Defendant',
      sourcePage: 1,
      sourceQuote: 'within 14 days after service of the updated statement of account',
    },
  ],
  dates: [
    {
      dateText: 'within 14 days from the date of this order',
      normalizedDate: null,
      dateType: 'filing_deadline',
      basis: 'relative_to_order',
      sourcePage: 1,
      sourceQuote: 'within 14 days from the date of this order',
    },
  ],
  proposedTasks: [
    {
      title: 'Prepare updated statement of account',
      description: 'Plaintiff to file the updated statement of account.',
      priority: 'high',
      suggestedDueDate: null,
      dueDateBasis: 'relative_to_order',
      condition: null,
      sourcePage: 1,
      sourceQuote: 'shall file its updated statement of account within 14 days',
    },
  ],
  warnings: [],
};

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
};

/** Walks the JSON Schema and returns every object node. */
function objectNodes(node: JsonSchema, found: JsonSchema[] = []): JsonSchema[] {
  if (node.properties) found.push(node);
  for (const child of Object.values(node.properties ?? {})) objectNodes(child, found);
  if (node.items) objectNodes(node.items, found);
  for (const option of node.anyOf ?? []) objectNodes(option, found);
  return found;
}

describe('Extraction schema', () => {
  it('accepts a well-formed extraction', () => {
    expect(Extraction.parse(sample)).toEqual(sample);
  });

  it('rejects omitted keys: unknown values must be null, not missing', () => {
    const { warnings: _omitted, ...withoutWarnings } = sample;
    expect(Extraction.safeParse(withoutWarnings).success).toBe(false);
  });

  it('rejects keys the schema does not define', () => {
    expect(Extraction.safeParse({ ...sample, approved: true }).success).toBe(false);
  });

  it('is compatible with Structured Outputs strict mode', () => {
    const schema = z.toJSONSchema(Extraction) as JsonSchema;
    const objects = objectNodes(schema);
    expect(objects.length).toBeGreaterThan(5);
    for (const node of objects) {
      expect(node.additionalProperties).toBe(false);
      expect([...(node.required ?? [])].sort()).toEqual(Object.keys(node.properties ?? {}).sort());
    }
  });
});
