import { create } from 'zustand';
import type { Listing, Notification, Review, SkillRequest } from '../bridge/types';
import { getBridge } from '../bridge';

interface MarketState {
  listings: Listing[];
  featuredListings: Listing[];
  activeListing: Listing | null;
  categoryFilter: string | null;
  sortOrder: 'trending' | 'newest' | 'installs' | 'rating';
  searchQuery: string;
  reviews: Review[];
  requests: SkillRequest[];
  requestsFilter: 'all' | 'mine' | 'to_me';
  notifications: Notification[];
  myListings: Listing[];
  updatesAvailable: { listingId: string; from: string; to: string }[];
  loading: boolean;
  activeTab: 'catalog' | 'requests' | 'my-market';

  setActiveTab: (tab: 'catalog' | 'requests' | 'my-market') => void;
  setCategoryFilter: (cat: string | null) => void;
  setSortOrder: (sort: 'trending' | 'newest' | 'installs' | 'rating') => void;
  setSearchQuery: (query: string) => void;
  setRequestsFilter: (filter: 'all' | 'mine' | 'to_me') => void;

  loadCatalog: () => Promise<void>;
  selectListing: (id: string) => Promise<void>;
  installListing: (id: string) => Promise<void>;
  uninstallListing: (id: string) => Promise<void>;
  checkUpdates: () => Promise<void>;
  publishListing: (
    skillId: string,
    input: {
      name: string;
      tagline: string;
      description: string;
      categories: string[];
      visibility: 'public' | 'unlisted';
      license: string;
    }
  ) => Promise<Listing>;
  unpublishListing: (id: string) => Promise<void>;
  loadReviews: (listingId: string) => Promise<void>;
  addReview: (listingId: string, rating: number, text: string) => Promise<void>;
  loadRequests: () => Promise<void>;
  createRequest: (input: { title: string; description: string; bounty?: string; toAuthorId?: string }) => Promise<void>;
  replyRequest: (id: string, text: string, listingId?: string) => Promise<void>;
  fulfillRequest: (id: string) => Promise<void>;
  loadNotifications: () => Promise<void>;
  markNotificationsRead: (ids: string[]) => Promise<void>;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  listings: [],
  featuredListings: [],
  activeListing: null,
  categoryFilter: null,
  sortOrder: 'trending',
  searchQuery: '',
  reviews: [],
  requests: [],
  requestsFilter: 'all',
  notifications: [],
  myListings: [],
  updatesAvailable: [],
  loading: false,
  activeTab: 'catalog',

  setActiveTab: (tab) => set({ activeTab: tab }),
  setCategoryFilter: (cat) => {
    set({ categoryFilter: cat });
    get().loadCatalog();
  },
  setSortOrder: (sort) => {
    set({ sortOrder: sort });
    get().loadCatalog();
  },
  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().loadCatalog();
  },
  setRequestsFilter: (filter) => {
    set({ requestsFilter: filter });
    get().loadRequests();
  },

  loadCatalog: async () => {
    try {
      set({ loading: true });
      const bridge = getBridge();
      const { categoryFilter, sortOrder, searchQuery } = get();
      const [res, feat, updates] = await Promise.all([
        bridge.market.search(searchQuery, {
          category: categoryFilter || undefined,
          sort: sortOrder,
        }),
        bridge.market.featured(),
        bridge.market.checkUpdates(),
      ]);
      set({
        listings: res.items,
        featuredListings: feat,
        updatesAvailable: updates,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  selectListing: async (id: string) => {
    const bridge = getBridge();
    const item = await bridge.market.get(id);
    const revs = await bridge.market.reviews(id);
    set({ activeListing: item, reviews: revs });
  },

  installListing: async (id: string) => {
    const bridge = getBridge();
    await bridge.market.install(id);
    await get().loadCatalog();
    if (get().activeListing?.id === id) {
      await get().selectListing(id);
    }
  },

  uninstallListing: async (id: string) => {
    const bridge = getBridge();
    await bridge.market.uninstall(id);
    await get().loadCatalog();
    if (get().activeListing?.id === id) {
      await get().selectListing(id);
    }
  },

  checkUpdates: async () => {
    const bridge = getBridge();
    const updates = await bridge.market.checkUpdates();
    set({ updatesAvailable: updates });
  },

  publishListing: async (skillId, input) => {
    const bridge = getBridge();
    const created = await bridge.market.publish(skillId, input);
    await get().loadCatalog();
    return created;
  },

  unpublishListing: async (id: string) => {
    const bridge = getBridge();
    await bridge.market.unpublish(id);
    await get().loadCatalog();
  },

  loadReviews: async (listingId: string) => {
    const bridge = getBridge();
    const revs = await bridge.market.reviews(listingId);
    set({ reviews: revs });
  },

  addReview: async (listingId, rating, text) => {
    const bridge = getBridge();
    await bridge.market.review(listingId, rating, text);
    await get().loadReviews(listingId);
  },

  loadRequests: async () => {
    const bridge = getBridge();
    const filter = get().requestsFilter;
    const reqs = await bridge.market.requests(filter);
    const myList = await bridge.market.myListings();
    set({ requests: reqs, myListings: myList });
  },

  createRequest: async (input) => {
    const bridge = getBridge();
    await bridge.market.createRequest(input);
    await get().loadRequests();
  },

  replyRequest: async (id, text, listingId) => {
    const bridge = getBridge();
    await bridge.market.replyRequest(id, text, listingId);
    await get().loadRequests();
  },

  fulfillRequest: async (id) => {
    const bridge = getBridge();
    await bridge.market.fulfillRequest(id);
    await get().loadRequests();
  },

  loadNotifications: async () => {
    const bridge = getBridge();
    const notifs = await bridge.market.notifications();
    set({ notifications: notifs });
  },

  markNotificationsRead: async (ids: string[]) => {
    const bridge = getBridge();
    await bridge.market.markRead(ids);
    set((state) => ({
      notifications: state.notifications.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
    }));
  },
}));
