import type { IEditor } from '@lobehub/editor';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDraft, saveDraft } from '@/features/ChatInput/draftStorage';

import { channelDraftKey, useComposerDraft } from './useComposerDraft';

const createFakeEditor = (text?: string) => {
  let json: Record<string, unknown> | undefined = text ? { text } : undefined;
  return {
    getDocument: vi.fn((type: string) =>
      type === 'markdown' ? ((json?.text as string) ?? '') : json,
    ),
    getLexicalEditor: () => ({}),
    get isEmpty() {
      return !json?.text;
    },
    setDocument: vi.fn((_type: string, content: Record<string, unknown>) => {
      json = content;
    }),
    type: (value: string) => {
      json = value ? { text: value } : undefined;
    },
  } as unknown as IEditor & { type: (value: string) => void };
};

const main = channelDraftKey('chn_000000000001');
const thread = channelDraftKey('chn_000000000001', 'cht_000000000001');

describe('useComposerDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Switching Channel or Thread remounts the composer; the unsent input must survive it.
  it('keeps unsent input when the composer unmounts and restores it on return', () => {
    const editor = createFakeEditor();
    const first = renderHook(() => useComposerDraft(editor, main));
    editor.type('half a thought');
    first.result.current.save();
    first.unmount();
    expect(getDraft(main)).toEqual({ text: 'half a thought' });

    const next = createFakeEditor();
    const second = renderHook(() => useComposerDraft(next, main));
    act(() => second.result.current.restore());
    expect(next.setDocument).toHaveBeenCalledWith('json', { text: 'half a thought' }, undefined);
  });

  it('keeps each Thread separate from the main timeline', () => {
    saveDraft(main, { text: 'main draft' });
    const editor = createFakeEditor();
    const { result } = renderHook(() => useComposerDraft(editor, thread));
    act(() => result.current.restore());
    expect(editor.setDocument).not.toHaveBeenCalled();
  });

  it('drops the draft once the input was sent', () => {
    const editor = createFakeEditor();
    const { result, unmount } = renderHook(() => useComposerDraft(editor, main));
    editor.type('send me');
    result.current.save();
    act(() => vi.advanceTimersByTime(500));
    expect(getDraft(main)).toBeDefined();

    editor.type('');
    result.current.save();
    result.current.clear();
    unmount();
    expect(getDraft(main)).toBeUndefined();
  });

  it('does not treat a torn-down editor as an empty draft', () => {
    saveDraft(main, { text: 'typed before the switch' });
    const tornDown = { ...createFakeEditor(), getLexicalEditor: () => null } as unknown as IEditor;
    const { result, unmount } = renderHook(() => useComposerDraft(tornDown, main));
    result.current.save();
    unmount();
    expect(getDraft(main)).toEqual({ text: 'typed before the switch' });
  });
});
