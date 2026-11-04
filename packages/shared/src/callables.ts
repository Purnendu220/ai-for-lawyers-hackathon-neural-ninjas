import type { z } from 'zod';
import { ArchiveCaseInput, CreateCaseInput, CreateCaseOutput, UpdateCaseInput } from './schemas/case';
import { OkOutput } from './schemas/common';
import {
  AnalyzeDocumentOutput,
  DocumentRef,
  StartUploadInput,
  StartUploadOutput,
} from './schemas/document';
import { CreateOrganizationInput, CreateOrganizationOutput } from './schemas/org';
import { ReviewAnalysisInput, ReviewAnalysisOutput } from './schemas/review';
import {
  AcceptInvitationOutput,
  InvitationRef,
  InviteMemberInput,
  InviteMemberOutput,
  UpdateMemberInput,
} from './schemas/team';

/**
 * Contract for every callable function. Functions parse `input` with it; the web app's typed
 * `call()` wrapper takes its types from it, so a contract change fails the build on both sides.
 */
export const callables = {
  createOrganization: { input: CreateOrganizationInput, output: CreateOrganizationOutput },
  inviteMember: { input: InviteMemberInput, output: InviteMemberOutput },
  revokeInvitation: { input: InvitationRef, output: OkOutput },
  acceptInvitation: { input: InvitationRef, output: AcceptInvitationOutput },
  updateMember: { input: UpdateMemberInput, output: OkOutput },
  createCase: { input: CreateCaseInput, output: CreateCaseOutput },
  updateCase: { input: UpdateCaseInput, output: OkOutput },
  archiveCase: { input: ArchiveCaseInput, output: OkOutput },
  startUpload: { input: StartUploadInput, output: StartUploadOutput },
  analyzeDocument: { input: DocumentRef, output: AnalyzeDocumentOutput },
  reviewAnalysis: { input: ReviewAnalysisInput, output: ReviewAnalysisOutput },
} as const;

export type CallableName = keyof typeof callables;
export type CallableInput<N extends CallableName> = z.input<(typeof callables)[N]['input']>;
export type CallableOutput<N extends CallableName> = z.output<(typeof callables)[N]['output']>;
