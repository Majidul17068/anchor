import { create } from 'zustand';
import type { Share, Skill } from '../bridge/types';
import { getBridge } from '../bridge';

export type SkillTab = 'mine' | 'acquired' | 'shared' | 'plugins' | 'builtin';

interface SkillsState {
  skills: Skill[];
  activeSkill: Skill | null;
  activeTab: SkillTab;
  loading: boolean;
  evaluating: boolean;
  evalResults: Record<string, { pass: boolean; output: string }>;
  versionHistory: { version: string; at: string; summary: string }[];

  setActiveTab: (tab: SkillTab) => void;
  loadSkills: () => Promise<void>;
  selectSkill: (id: string) => Promise<void>;
  saveSkill: (skill: Omit<Skill, 'id' | 'source' | 'sharedWith' | 'updatedAt'> & { id?: string }) => Promise<Skill>;
  deleteSkill: (id: string) => Promise<void>;
  evaluateSkill: (id: string) => Promise<void>;
  improveSkill: (id: string) => Promise<void>;
  rollbackVersion: (id: string, version: string) => Promise<void>;
  shareSkill: (id: string, email: string, permission: 'view' | 'copy') => Promise<Share>;
  revokeSkill: (id: string, email: string) => Promise<void>;
  generateShareLink: (id: string) => Promise<string>;
  importFromLink: (link: string) => Promise<Skill>;
  importFromGitHub: (repo: string) => Promise<Skill[]>;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  activeSkill: null,
  activeTab: 'mine',
  loading: false,
  evaluating: false,
  evalResults: {},
  versionHistory: [],

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadSkills: async () => {
    try {
      set({ loading: true });
      const bridge = getBridge();
      const list = await bridge.skills.list();
      set({
        skills: list,
        activeSkill: get().activeSkill || list[0] || null,
        loading: false,
      });
      if (get().activeSkill) {
        const versions = await bridge.skills.versions(get().activeSkill!.id);
        set({ versionHistory: versions });
      }
    } catch {
      set({ loading: false });
    }
  },

  selectSkill: async (id: string) => {
    const bridge = getBridge();
    const sk = await bridge.skills.get(id);
    const versions = await bridge.skills.versions(id);
    const results: Record<string, { pass: boolean; output: string }> = {};
    sk.examples.forEach((ex) => {
      if (ex.lastResult) results[ex.id] = ex.lastResult;
    });

    set({
      activeSkill: sk,
      versionHistory: versions,
      evalResults: results,
    });
  },

  saveSkill: async (input) => {
    const bridge = getBridge();
    const saved = await bridge.skills.save(input);
    await get().loadSkills();
    set({ activeSkill: saved });
    return saved;
  },

  deleteSkill: async (id: string) => {
    const bridge = getBridge();
    await bridge.skills.delete(id);
    await get().loadSkills();
  },

  evaluateSkill: async (id: string) => {
    set({ evaluating: true });
    try {
      const bridge = getBridge();
      const stream = bridge.skills.evaluate(id);
      for await (const res of stream) {
        set((state) => ({
          evalResults: {
            ...state.evalResults,
            [res.exampleId]: { pass: res.pass, output: res.output },
          },
        }));
      }
    } finally {
      set({ evaluating: false });
    }
  },

  improveSkill: async (id: string) => {
    const bridge = getBridge();
    const improved = await bridge.skills.improve(id);
    await get().loadSkills();
    set({ activeSkill: improved });
  },

  rollbackVersion: async (id: string, version: string) => {
    const bridge = getBridge();
    const rolled = await bridge.skills.rollback(id, version);
    await get().loadSkills();
    set({ activeSkill: rolled });
  },

  shareSkill: async (id, email, permission) => {
    const bridge = getBridge();
    const res = await bridge.skills.share(id, email, permission);
    await get().selectSkill(id);
    return res;
  },

  revokeSkill: async (id, email) => {
    const bridge = getBridge();
    await bridge.skills.revoke(id, email);
    await get().selectSkill(id);
  },

  generateShareLink: async (id: string) => {
    const bridge = getBridge();
    return bridge.skills.shareLink(id);
  },

  importFromLink: async (link: string) => {
    const bridge = getBridge();
    const imported = await bridge.skills.importFromLink(link);
    await get().loadSkills();
    set({ activeSkill: imported, activeTab: 'shared' });
    return imported;
  },

  importFromGitHub: async (repo: string) => {
    const bridge = getBridge();
    const imported = await bridge.skills.importFromGitHub(repo);
    await get().loadSkills();
    if (imported.length > 0) {
      set({ activeSkill: imported[0], activeTab: 'acquired' });
    }
    return imported;
  },
}));
