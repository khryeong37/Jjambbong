import { SimulationResult, MarketData, SimulationConfig, SlotDiagnostics } from '../types';
import {
  computeSlotReturn,
  normalizeWeights,
  computePortfolio,
  SlotReturnResult,
} from './backtest';

/**
 * Calculates the backtest simulation result based on coin quantity (not price).
 * Follows the specification document:
 * - Initial coin quantity C0 is divided by weights wA, wB, wC
 * - Each node's trading history is followed to calculate coin quantity changes
 * - Final coin quantity = sum of all slot final quantities
 * - Total PnL = Final coins - Initial coins
 * - ROI = (Total PnL / Initial coins) × 100
 */
const createEmptyResult = (
  slots: SimulationConfig['slots'],
  reason: string,
  diagnostics?: Record<string, SlotDiagnostics>
): SimulationResult => ({
  timeline: [],
  finalCoins: 0,
  finalValue: 0,
  roi: null,
  coinPnL: 0,
  totalPnL: 0,
  status: 'na',
  reasons: [reason],
  slotDiagnostics: diagnostics,
  slotSummaries: slots.map((slot) => ({
    id: slot.id,
    initialValue: 0,
    finalValue: 0,
    contribution: 0,
    status: 'na',
    reason,
    label: slot.node?.name,
    address: slot.node?.address,
  })),
});

const normalizeRange = (history?: MarketData['history']) => {
  if (!history || !history.length) {
    return { start: null, endExclusive: null };
  }
  const first = history[0]?.date;
  const last = history[history.length - 1]?.date;
  if (!first || !last) {
    return { start: null, endExclusive: null };
  }
  const start = first.slice(0, 10);
  const endDate = new Date(last);
  if (Number.isNaN(endDate.getTime())) {
    return { start, endExclusive: null };
  }
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return { start, endExclusive: endDate.toISOString().slice(0, 10) };
};

export const calculateSimulation = (
  config: SimulationConfig,
  marketData: MarketData,
  baseDenom: 'ATOM' | 'ATOMONE'
): SimulationResult => {
  const { initialCapital, slots } = config;
  const slotStatusMap: Record<string, SlotReturnResult> = {};
  try {
    const range = normalizeRange(marketData.history);

    slots.forEach((slot) => {
      slotStatusMap[slot.id] = computeSlotReturn(slot, baseDenom, range);
    });

    const normalizedWeights = normalizeWeights(slots, slotStatusMap);
    const portfolio = computePortfolio(
      initialCapital,
      normalizedWeights,
      slotStatusMap
    );

    const slotDiagnostics: Record<string, SlotDiagnostics> = {};
    Object.values(slotStatusMap).forEach((status) => {
      slotDiagnostics[status.id] = {
        status: status.status,
        reason: status.reason,
        r: status.r,
        rawSwapCount: status.rawSwapCount,
        baseAssetSwapCount: status.baseAssetSwapCount,
        totalBaseLeg: status.totalBaseLeg,
      };
    });

    const slotSummaries = slots.map((slot) => {
      const diag = slotStatusMap[slot.id];
      const weight = normalizedWeights[slot.id] || 0;
      const initialValue = initialCapital * weight;
      const finalValue =
        diag?.status === 'ok' && diag?.r !== null
          ? initialValue * (diag.r ?? 0)
          : initialValue;
      return {
        id: slot.id,
        initialValue,
        finalValue,
        contribution: finalValue - initialValue,
        status: diag?.status,
        reason: diag?.reason,
        label: slot.node?.name,
        address: slot.node?.address,
      };
    });

    const history = marketData.history || [];
    const timeline =
      history.length > 0
        ? history.map((entry, idx) => {
            const progress =
              history.length === 1 ? 1 : idx / (history.length - 1);
            const targetCoins =
              initialCapital +
              (portfolio.qFinal - initialCapital) * progress;
            const slotValues = slots.reduce<Record<string, number>>(
              (acc, slot) => {
                const weight = normalizedWeights[slot.id] || 0;
                acc[slot.id] = targetCoins * weight;
                return acc;
              },
              {}
            );
            return {
              date: entry.date || `${idx}`,
              portfolioCoins: targetCoins,
              portfolioValue: targetCoins,
              price: entry.price ?? 1,
              benchmarkCoins: initialCapital,
              benchmarkValue: initialCapital,
              slots: slotValues,
            };
          })
        : [];

    console.groupCollapsed(`[Simulation][${baseDenom}] Diagnostics`);
    console.log('baseAsset / C0', { baseAsset: baseDenom, C0: initialCapital });
    console.log('Slot status', slotDiagnostics);
    console.log('Normalized weights', normalizedWeights);
    console.log('Portfolio', portfolio);
    console.groupEnd();

    if (portfolio.status === 'na') {
      return {
        ...createEmptyResult(slots, portfolio.reasons.join(', '), slotDiagnostics),
        slotSummaries,
        slotDiagnostics,
      };
    }

    return {
      timeline,
      finalCoins: portfolio.qFinal,
      finalValue: portfolio.finalValue,
      roi: portfolio.roi,
      coinPnL: portfolio.pnl,
      totalPnL: portfolio.pnl,
      slotSummaries,
      status: portfolio.status,
      reasons: portfolio.reasons,
      slotDiagnostics,
    };
  } catch (error) {
    console.error('[calculateSimulation] failed', error);
    return createEmptyResult(
      config.slots,
      'SIMULATION_ERROR',
      Object.fromEntries(
        Object.entries(slotStatusMap).map(([id, status]) => [
          id,
          {
            status: status.status,
            reason: status.reason,
            r: status.r,
            rawSwapCount: status.rawSwapCount,
            baseAssetSwapCount: status.baseAssetSwapCount,
            totalBaseLeg: status.totalBaseLeg,
          },
        ])
      )
    );
  }
};
