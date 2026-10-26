import type { ChannelReadMessageParams, ChannelReadMessagesParams } from '@lobechat/types';
import { inArray } from 'drizzle-orm';

import { ChannelHistoryRepository } from '@/database/repositories/channel';
import { files } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { FileService } from '@/server/services/file';

/** Both the builtin tool and operation-authenticated CLI use this exact read boundary. */
export class ChannelHistoryService {
  private readonly repository: ChannelHistoryRepository;

  constructor(
    private readonly db: LobeChatDatabase,
    private readonly userId: string,
    private readonly operationId: string,
    private readonly workspaceId?: string,
  ) {
    this.repository = new ChannelHistoryRepository(db, userId, workspaceId);
  }

  readMessages = (params: ChannelReadMessagesParams) =>
    this.repository.readMessages(this.operationId, params);

  readMessage = async (params: ChannelReadMessageParams) => {
    const result = await this.repository.readMessage(this.operationId, params);
    const ids = result.message.fileIds ?? [];
    const shared = ids.length
      ? await this.db
          .select({
            id: files.id,
            name: files.name,
            fileType: files.fileType,
            size: files.size,
            url: files.url,
          })
          .from(files)
          .where(inArray(files.id, ids))
      : [];
    const fileService = new FileService(this.db, this.userId, this.workspaceId);
    return {
      ...result,
      attachments: await Promise.all(
        shared.map(async (file) => ({
          ...file,
          url: await fileService.getFullFileUrl(file.url, 300),
        })),
      ),
    };
  };
}
