import { describe, expect, it } from 'vitest';

import { getConnectorScopePath, resolveConnectorScopeTarget } from './connectorScope';

describe('resolveConnectorScopeTarget', () => {
  it('shows the workspace scope and points at the active workspace inside one', () => {
    expect(resolveConnectorScopeTarget([{ slug: 'acme' }, { slug: 'beta' }], 'beta')).toEqual({
      scope: 'workspace',
      workspaceSlug: 'beta',
    });
  });

  it('points the personal page at the first workspace the user can still enter', () => {
    expect(
      resolveConnectorScopeTarget([{ lockedOut: true, slug: 'lapsed' }, { slug: 'acme' }], null),
    ).toEqual({ scope: 'personal', workspaceSlug: 'acme' });
  });

  it('has no workspace target when the user has no reachable workspace', () => {
    expect(resolveConnectorScopeTarget([], null)).toEqual({ scope: 'personal' });
    expect(resolveConnectorScopeTarget([{ lockedOut: true, slug: 'lapsed' }], null)).toEqual({
      scope: 'personal',
    });
  });
});

describe('getConnectorScopePath', () => {
  it('maps each scope to its own Connectors page', () => {
    expect(getConnectorScopePath('personal', 'acme')).toBe('/settings/connector');
    expect(getConnectorScopePath('workspace', 'acme')).toBe('/acme/settings/connector');
  });

  it('falls back to the personal page without a workspace slug', () => {
    expect(getConnectorScopePath('workspace')).toBe('/settings/connector');
  });
});
