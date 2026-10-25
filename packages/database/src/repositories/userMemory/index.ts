import type {
  userMemoriesActivities,
  userMemoriesContexts,
  userMemoriesExperiences,
  userMemoriesIdentities,
  userMemoriesPreferences,
} from '../../schemas';

export { UserMemoryTopicRepository } from './UserMemoryTopicRepository';

export interface MemorySource {
  agentId: string | null;
  id: string;
  sessionId: string | null;
  title: string | null;
}

export interface DisplayExperienceMemory extends Omit<
  typeof userMemoriesExperiences.$inferSelect,
  'situationVector' | 'actionVector' | 'keyLearningVector'
> {
  title: string | null;
}

export interface DisplayPreferenceMemory extends Omit<
  typeof userMemoriesPreferences.$inferSelect,
  'conclusionDirectivesVector'
> {
  title: string | null;
}

export type DisplayContextMemory = Omit<
  typeof userMemoriesContexts.$inferSelect,
  'descriptionVector'
>;

export type DisplayIdentityMemory = Omit<
  typeof userMemoriesIdentities.$inferSelect,
  'descriptionVector'
>;

export interface DisplayActivityMemory extends Omit<
  typeof userMemoriesActivities.$inferSelect,
  'narrativeVector' | 'feedbackVector'
> {
  title: string | null;
}
