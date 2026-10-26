// @vitest-environment node
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import { DocumentModel } from '@/database/models/document';
import { GoalModel } from '@/database/models/goal';
import { VerifyCriterionModel } from '@/database/models/verifyCriterion';
import { goalNodes, goals, workspaces } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { GoalCopyService } from './copy';
import { GoalService } from './GoalService';
import { registerGoalServiceTestCleanup } from './testUtils';

const serverDB: LobeChatDatabase = await getTestDB();
const userId = 'goal-copy-test-user';
const workspaceId = 'goal-copy-test-ws';

registerGoalServiceTestCleanup(serverDB, userId);

beforeEach(async () => {
  await serverDB
    .insert(workspaces)
    .values({ id: workspaceId, name: 'Team', primaryOwnerId: userId, slug: 'goal-copy-team' })
    .onConflictDoNothing();
});

const problemNode = async (goalId: string) =>
  (
    await serverDB
      .select()
      .from(goalNodes)
      .where(and(eq(goalNodes.goalId, goalId), eq(goalNodes.kind, 'problem')))
  )[0];

describe('GoalCopyService.copyToWorkspace', () => {
  it('copies a personal goal definition into a workspace as a fresh, agent-less draft', async () => {
    const source = await new GoalService(serverDB, userId).create({
      config: {
        recovery: { maxAttemptsPerTask: 2 },
        schedule: { deadline: '2000-01-01T00:00:00.000Z' },
        supervision: { enabled: true, maxIncidents: 3 },
      },
      maxRounds: 5,
      maxTotalCost: 12.5,
      problemDescription: 'Ship the onboarding flow',
      requirement: 'Users can finish onboarding',
      tasks: ['Draft the copy'],
      title: 'Onboarding',
    });
    // Scope-bound fields a copy must not carry: they name the source's agent and run state.
    await serverDB
      .update(goals)
      .set({
        config: {
          ...source.goal.config,
          model: 'gpt-x',
          pausedBy: 'pattern_break',
          provider: 'openai',
          taskAgentId: 'agt_source_only',
        },
        status: 'running',
      })
      .where(eq(goals.id, source.goal.id));

    const { goalId } = await new GoalCopyService(serverDB, userId).copyToWorkspace(
      source.goal.id,
      workspaceId,
    );

    expect(goalId).not.toBe(source.goal.id);
    // The copy lands in the workspace, not in personal scope.
    expect(await new GoalModel(serverDB, userId).findById(goalId)).toBeUndefined();
    const copy = (await new GoalModel(serverDB, userId, workspaceId).findById(goalId))!;
    expect(copy).toMatchObject({
      agentId: null,
      maxRounds: 5,
      maxTotalCost: 12.5,
      projectId: null,
      requirement: 'Users can finish onboarding',
      status: 'draft',
      title: 'Onboarding',
      workspaceId,
    });
    expect(copy.config).toEqual({
      recovery: { maxAttemptsPerTask: 2 },
      supervision: { enabled: true, maxIncidents: 3 },
    });

    // A fresh graph: the problem statement only, none of the source's Tasks.
    const nodes = await serverDB.select().from(goalNodes).where(eq(goalNodes.goalId, goalId));
    expect(nodes.map((node) => node.kind)).toEqual(['problem']);
    expect((await problemNode(goalId))?.description).toBe('Ship the onboarding flow');

    // The source is untouched.
    const original = (await new GoalModel(serverDB, userId).findById(source.goal.id))!;
    expect(original.status).toBe('running');
    expect(original.config?.taskAgentId).toBe('agt_source_only');
  });

  it('clones acceptance criteria and their instructions into the target scope', async () => {
    const source = await new GoalService(serverDB, userId, workspaceId).create({
      config: { acceptance: { metrics: [{ key: 'signups', target: 100 }] } },
      criteria: [{ instruction: 'Open the page and sign up', title: 'Sign-up works' }],
      title: 'Grow sign-ups',
    });
    const sourceCriterionIds = source.goal.config!.acceptance!.criteriaIds!;

    const { goalId } = await new GoalCopyService(serverDB, userId, workspaceId).copyToWorkspace(
      source.goal.id,
      null,
    );

    const copy = (await new GoalModel(serverDB, userId).findById(goalId))!;
    expect(copy.workspaceId).toBeNull();
    expect(copy.config?.acceptance?.metrics).toEqual([{ key: 'signups', target: 100 }]);
    const copiedIds = copy.config!.acceptance!.criteriaIds!;
    expect(copiedIds).toHaveLength(1);
    expect(copiedIds[0]).not.toBe(sourceCriterionIds[0]);

    const [criterion] = await new VerifyCriterionModel(serverDB, userId).findByIds(copiedIds);
    expect(criterion).toMatchObject({ title: 'Sign-up works', workspaceId: null });
    const document = await new DocumentModel(serverDB, userId).findById(criterion.documentId!);
    expect(document?.content).toBe('Open the page and sign up');
    // The source criterion still belongs to the workspace goal.
    expect(
      await new VerifyCriterionModel(serverDB, userId, workspaceId).findByIds(sourceCriterionIds),
    ).toHaveLength(1);
  });

  it('refuses a goal outside the caller scope', async () => {
    const source = await new GoalService(serverDB, userId, workspaceId).create({
      title: 'Workspace only',
    });

    await expect(
      new GoalCopyService(serverDB, userId).copyToWorkspace(source.goal.id, workspaceId),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
