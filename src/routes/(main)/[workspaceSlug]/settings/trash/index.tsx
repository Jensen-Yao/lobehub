'use client';

import { useFetchWorkspaceMembers } from '@/business/client/hooks/useFetchWorkspaceMembers';
import TrashSetting from '@/features/Settings/trash';

/**
 * Recycle bin mirrored under `/:workspaceSlug/settings/trash`. The list,
 * restore and purge run in the active workspace scope, where every member,
 * owner included, sees only what they deleted; owners and admins also get each
 * member's item count. The workspace shell renders the compact header, so the
 * page header is hidden. Members are loaded so those counts can name them.
 */
const WorkspaceTrashSetting = () => {
  useFetchWorkspaceMembers();

  return <TrashSetting isWorkspace showSettingHeader={false} />;
};

WorkspaceTrashSetting.displayName = 'WorkspaceTrashSetting';

export default WorkspaceTrashSetting;
