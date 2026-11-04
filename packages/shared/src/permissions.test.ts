import { describe, expect, it } from 'vitest';
import { can } from './permissions';

describe('can', () => {
  it('denies everything without a role', () => {
    expect(can(null, 'case.read')).toBe(false);
    expect(can(undefined, 'case.read')).toBe(false);
  });

  it('lets a viewer read but never write or approve', () => {
    expect(can('viewer', 'case.read')).toBe(true);
    expect(can('viewer', 'case.write')).toBe(false);
    expect(can('viewer', 'task.write')).toBe(false);
    expect(can('viewer', 'ai.review')).toBe(false);
    expect(can('viewer', 'copilot.ask')).toBe(false);
  });

  it('limits member management to owners and admins', () => {
    expect(can('owner', 'member.manage')).toBe(true);
    expect(can('admin', 'member.manage')).toBe(true);
    expect(can('lawyer', 'member.manage')).toBe(false);
  });

  it('lets paralegals approve AI suggestions only when the org policy allows it', () => {
    expect(can('paralegal', 'ai.review')).toBe(false);
    expect(can('paralegal', 'ai.review', { paralegalCanApprove: true })).toBe(true);
    expect(can('viewer', 'ai.review', { paralegalCanApprove: true })).toBe(false);
  });
});
