import { NodeData } from '../types';

export type BaseAsset = 'ATOM' | 'ATOMONE';

export interface SlotReturnResult {
  id: string;
  r: number | null;
  status: 'ok' | 'na';
  reason?: string;
  rawSwapCount: number;
  baseAssetSwapCount: number;
  totalBaseLeg: number;
}

const BASE_DENOM_ALIASES: Record<BaseAsset, string[]> = {
  ATOM: ['ATOM', 'UATOM', 'IBCUATOM', 'COSMOSHUB'],
  ATOMONE: ['ATOMONE', 'ATONE', 'UATONE'],
};

const FLOW_EPSILON = 1e-8;

const normalizeDate = (value?: string | Date | null) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  try {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return value.slice(0, 10);
  } catch {
    return null;
  }
};

export const computeSlotReturn = (
  slot: { id: string; node: NodeData | null },
  baseAsset: BaseAsset,
  range?: { start?: string | null; endExclusive?: string | null }
): SlotReturnResult => {
  const emptyResult = (reason: string): SlotReturnResult => ({
    id: slot.id,
    r: null,
    status: 'na',
    reason,
    rawSwapCount: 0,
    baseAssetSwapCount: 0,
    totalBaseLeg: 0,
  });

  try {
    if (!slot.node) {
      return emptyResult('EMPTY_SLOT');
    }
    const history = slot.node.history || [];
    if (!history.length) {
      return emptyResult('NO_NODE_HISTORY');
    }
    const filtered = history
      .map((entry) => ({
        ...entry,
        normalized: normalizeDate(entry.date),
      }))
      .filter((entry) => entry.normalized);

    const { start, endExclusive } = range || {};
    const entries =
      start && endExclusive
        ? filtered.filter(
            (entry) =>
              entry.normalized! >= start && entry.normalized! < endExclusive
          )
        : filtered;

    if (!entries.length) {
      return emptyResult('NO_SWAPS_IN_RANGE');
    }

    const getFlow = (entry: typeof entries[number]) => {
      const fallback = entry.netFlow ?? 0;
      if (baseAsset === 'ATOM') {
        return entry.netFlowAtom ?? fallback;
      }
      return entry.netFlowAtone ?? fallback;
    };

    let rawSwapCount = 0;
    let baseAssetSwapCount = 0;
    let totalBaseLeg = 0;
    const events = entries.map((entry) => {
      const flow = getFlow(entry) || 0;
      const absFlow = Math.abs(flow);
      const txCount = entry.txCount ?? 0;
      if (txCount > 0 || absFlow > 0) {
        rawSwapCount += txCount > 0 ? txCount : 1;
      }
      if (absFlow > FLOW_EPSILON) {
        baseAssetSwapCount += 1;
        totalBaseLeg += absFlow;
      }
      return { flow, absFlow };
    });

    if (rawSwapCount === 0) {
      return emptyResult('NO_SWAPS_IN_RANGE');
    }
    if (baseAssetSwapCount === 0 || totalBaseLeg <= 0) {
      return emptyResult(
        baseAsset === 'ATOM' ? 'NO_ATOM_FLOW' : 'NO_ATOMONE_FLOW'
      );
    }

    let currentCoins = 1;
    events.forEach((event) => {
      if (event.absFlow <= 0) return;
      const share = event.absFlow / totalBaseLeg;
      const direction = Math.sign(event.flow);
      const delta = share * direction;
      const tentative = currentCoins + delta;
      if (tentative >= 0) {
        currentCoins = tentative;
      }
    });

    if (!Number.isFinite(currentCoins)) {
      return emptyResult('INVALID_RETURN');
    }

    return {
      id: slot.id,
      r: currentCoins,
      status: 'ok',
      rawSwapCount,
      baseAssetSwapCount,
      totalBaseLeg,
    };
  } catch (error) {
    console.error('[computeSlotReturn] failed', error);
    return emptyResult('SLOT_COMPUTE_ERROR');
  }
};

export const normalizeWeights = (
  slots: { id: string; weight: number }[],
  slotStatuses: Record<string, SlotReturnResult>
): Record<string, number> => {
  const result: Record<string, number> = {};
  const validSlots = slots.filter(
    (slot) =>
      slotStatuses[slot.id]?.status === 'ok' && slot.weight > 0
  );
  const total = validSlots.reduce(
    (sum, slot) => sum + Math.max(0, slot.weight),
    0
  );
  if (!validSlots.length || total <= 0) {
    slots.forEach((slot) => {
      result[slot.id] = 0;
    });
    return result;
  }
  slots.forEach((slot) => {
    if (slotStatuses[slot.id]?.status !== 'ok') {
      result[slot.id] = 0;
      return;
    }
    result[slot.id] = (Math.max(0, slot.weight) / total);
  });
  return result;
};

export interface PortfolioResult {
  status: 'ok' | 'na';
  reasons: string[];
  qFinal: number;
  pnl: number;
  roi: number | null;
  finalValue: number;
  contributions: Record<
    string,
    { initialValue: number; finalValue: number; contribution: number }
  >;
}

export const computePortfolio = (
  initialCapital: number,
  normalizedWeights: Record<string, number>,
  slotStatuses: Record<string, SlotReturnResult>
): PortfolioResult => {
  const safeResult = (reason: string): PortfolioResult => ({
    status: 'na',
    reasons: [reason],
    qFinal: 0,
    pnl: 0,
    roi: null,
    finalValue: 0,
    contributions: {},
  });

  try {
    if (!Number.isFinite(initialCapital) || initialCapital <= 0) {
      return safeResult('INVALID_CAPITAL');
    }

    const validSlots = Object.values(slotStatuses).filter(
      (slot) => slot.status === 'ok' && normalizedWeights[slot.id] > 0
    );
    if (validSlots.length < 2) {
      return safeResult('NEED_TWO_VALID_SLOTS');
    }

    let qFinal = 0;
    const contributions: PortfolioResult['contributions'] = {};

    validSlots.forEach((slot) => {
      const weight = normalizedWeights[slot.id] || 0;
      const initialValue = initialCapital * weight;
      const r = slot.r ?? 0;
      const finalValue = initialValue * r;
      qFinal += finalValue;
      contributions[slot.id] = {
        initialValue,
        finalValue,
        contribution: finalValue - initialValue,
      };
    });

    const pnl = qFinal - initialCapital;
    const roi = initialCapital === 0 ? null : (pnl / initialCapital) * 100;

    if (!Number.isFinite(qFinal) || !Number.isFinite(pnl)) {
      return safeResult('PORTFOLIO_COMPUTE_ERROR');
    }

    return {
      status: 'ok',
      reasons: [],
      qFinal,
      pnl,
      roi: roi ?? null,
      finalValue: qFinal,
      contributions,
    };
  } catch (error) {
    console.error('[computePortfolio] failed', error);
    return safeResult('PORTFOLIO_COMPUTE_ERROR');
  }
};
