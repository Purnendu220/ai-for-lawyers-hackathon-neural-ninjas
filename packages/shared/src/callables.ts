import type { z } from 'zod';
import { CreateOrganizationInput, CreateOrganizationOutput } from './schemas/org';

/**
 * Contract for every callable function. Functions parse `input` with it; the web app's typed
 * `call()` wrapper takes its types from it, so a contract change fails the build on both sides.
 */
export const callables = {
  createOrganization: { input: CreateOrganizationInput, output: CreateOrganizationOutput },
} as const;

export type CallableName = keyof typeof callables;
export type CallableInput<N extends CallableName> = z.input<(typeof callables)[N]['input']>;
export type CallableOutput<N extends CallableName> = z.output<(typeof callables)[N]['output']>;
