import { NodeData, MarketData } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();
const NODE_LIMIT = Number(import.meta.env.VITE_NODE_LIMIT ?? '500') || 500;

const buildApiUrl = (
  dateRange?: { start: string; end: string },
  params: Record<string, string | number | undefined> = {}
) => {
  const searchParams = new URLSearchParams();
  if (dateRange?.start) searchParams.set('start', dateRange.start);
  if (dateRange?.end) searchParams.set('end', dateRange.end);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const endpoint = `/api/nodes${
    searchParams.toString() ? `?${searchParams}` : ''
  }`;

  if (!API_BASE_URL) {
    return endpoint;
  }

  const base = API_BASE_URL.endsWith('/')
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;
  return `${base}${endpoint}`;
};

export const loadSwapNodes = async (dateRange?: {
  start: string;
  end: string;
}): Promise<NodeData[]> => {
  const url = buildApiUrl(dateRange, { limit: NODE_LIMIT });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load nodes: ${res.status}`);
  }
  const data = await res.json();
  return data as NodeData[];
};

export const loadNodeDetail = async (id: string): Promise<NodeData> => {
  const endpoint = `/api/nodes/${encodeURIComponent(id)}`;
  const url = API_BASE_URL
    ? `${API_BASE_URL.replace(/\/$/, '')}${endpoint}`
    : endpoint;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load node detail: ${res.status}`);
  }
  return (await res.json()) as NodeData;
};

export const loadLocalMarket = (): { atom: MarketData; one: MarketData } => {
  const today = new Date();
  const history = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    return { date: d.toISOString().split('T')[0], price: 1 + i * 0.01 };
  });
  const base: MarketData = {
    price: 1,
    change24h: 0,
    marketCap: 0,
    volume24h: 0,
    history,
  };
  return {
    atom: base,
    one: {
      ...base,
      price: 0.5,
      history: history.map((h) => ({ ...h, price: h.price * 0.5 })),
    },
  };
};
