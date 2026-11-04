import type { WorkspaceType } from './enums';

export type MatterType = { value: string; label: string };

const LITIGATION_MATTERS: readonly MatterType[] = [
  { value: 'civil', label: 'Civil' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'criminal', label: 'Criminal' },
  { value: 'family', label: 'Family' },
  { value: 'property', label: 'Property' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'other', label: 'Other' },
];

const CORPORATE_MATTERS: readonly MatterType[] = [
  { value: 'litigation', label: 'Litigation' },
  { value: 'contract_dispute', label: 'Contract dispute' },
  { value: 'employment', label: 'Employment' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'other', label: 'Other' },
];

export type WorkspaceFeatures = {
  teamInvites: boolean;
  taskAssignment: boolean;
  externalCounsel: boolean;
  matterTypes: readonly MatterType[];
};

/** Blueprint §3 "Workspace-specific configuration". */
export const WORKSPACE_FEATURES: Record<WorkspaceType, WorkspaceFeatures> = {
  solo: {
    teamInvites: false,
    taskAssignment: false,
    externalCounsel: false,
    matterTypes: LITIGATION_MATTERS,
  },
  law_firm: {
    teamInvites: true,
    taskAssignment: true,
    externalCounsel: false,
    matterTypes: LITIGATION_MATTERS,
  },
  corporate: {
    teamInvites: true,
    taskAssignment: true,
    externalCounsel: true,
    matterTypes: CORPORATE_MATTERS,
  },
};
