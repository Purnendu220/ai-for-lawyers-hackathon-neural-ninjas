import { describe, expect, it } from 'vitest';
import { assignableRoles } from './team';

describe('assignableRoles', () => {
  it('lets owners assign any role', () => {
    expect(assignableRoles('owner', 'admin')).toContain('owner');
    expect(assignableRoles('owner', null)).toContain('admin');
  });

  it('keeps admins away from owners, admins and admin invitations', () => {
    expect(assignableRoles('admin', 'owner')).toEqual([]);
    expect(assignableRoles('admin', 'admin')).toEqual([]);
    expect(assignableRoles('admin', null)).not.toContain('admin');
    expect(assignableRoles('admin', 'viewer')).toEqual(['lawyer', 'paralegal', 'viewer']);
  });

  it('gives everyone else no management rights', () => {
    expect(assignableRoles('lawyer', 'viewer')).toEqual([]);
    expect(assignableRoles('viewer', null)).toEqual([]);
  });
});
