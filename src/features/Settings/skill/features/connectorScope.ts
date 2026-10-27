import { buildWorkspaceAwarePath } from '@/features/Workspace/workspaceAwarePath';

export type ConnectorScope = 'personal' | 'workspace';

interface ScopeWorkspace {
  lockedOut?: boolean;
  slug?: string | null;
}

export interface ConnectorScopeTarget {
  /** The scope the page is showing now. */
  scope: ConnectorScope;
  /**
   * Workspace the "Workspace" option points at: the active one, else the first
   * one the user can still enter. `undefined` when there is no workspace to
   * switch to, so the switch has nothing to offer.
   */
  workspaceSlug?: string;
}

export const resolveConnectorScopeTarget = (
  workspaces: ScopeWorkspace[],
  activeSlug: string | null | undefined,
): ConnectorScopeTarget => {
  if (activeSlug) return { scope: 'workspace', workspaceSlug: activeSlug };

  const fallback = workspaces.find((workspace) => workspace.slug && !workspace.lockedOut);
  return { scope: 'personal', workspaceSlug: fallback?.slug ?? undefined };
};

export const getConnectorScopePath = (scope: ConnectorScope, workspaceSlug?: string) =>
  buildWorkspaceAwarePath('/settings/connector', scope === 'workspace' ? workspaceSlug : null);
