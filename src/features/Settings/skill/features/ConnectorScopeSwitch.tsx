'use client';

import { Segmented } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useActiveWorkspaceSlug } from '@/business/client/hooks/useActiveWorkspaceSlug';
import { useWorkspaces } from '@/business/client/hooks/useWorkspaces';

import {
  type ConnectorScope,
  getConnectorScopePath,
  resolveConnectorScopeTarget,
} from './connectorScope';

const styles = stylex.create({
  root: {
    borderBlockEndColor: cssVar.colorBorderSecondary,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: 1,
    flexShrink: 0,
    paddingBlock: 10,
    paddingInline: 16,
  },
});

/**
 * Personal | Workspace switch at the top of the Connectors list. The scope is
 * the axis the whole list is cut on — connectors are stored per scope and the
 * server resolves the scope from the route — so switching navigates to that
 * scope's Connectors page instead of filtering rows client-side. Hidden for
 * users without a workspace, where only the personal scope exists.
 */
const ConnectorScopeSwitch = memo(() => {
  const { t } = useTranslation('setting');
  const navigate = useNavigate();
  const workspaces = useWorkspaces();
  const activeSlug = useActiveWorkspaceSlug();

  const target = resolveConnectorScopeTarget(workspaces, activeSlug);
  if (!target.workspaceSlug) return null;

  const handleChange = (scope: ConnectorScope) => {
    if (scope === target.scope) return;
    navigate(getConnectorScopePath(scope, target.workspaceSlug));
  };

  return (
    <div {...stylex.props(styles.root)}>
      <Segmented<ConnectorScope>
        block
        size={'small'}
        value={target.scope}
        options={[
          { label: t('tools.connectorScope.personal'), value: 'personal' },
          { label: t('tools.connectorScope.workspace'), value: 'workspace' },
        ]}
        onChange={handleChange}
      />
    </div>
  );
});

ConnectorScopeSwitch.displayName = 'ConnectorScopeSwitch';

export default ConnectorScopeSwitch;
