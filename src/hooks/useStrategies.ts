import { useMemo, useRef, useEffect } from 'react';
import { CoinData } from './useBinanceData';

// Core strategies (الكنز): breakout, rsi_bounce, scalping
// Experimental strategies (تجريبية): institutional, crossover
export type StrategyId = 'breakout' | 'rsi_bounce' | 'institutional' | 'crossover' | 'scalping';

// Boost mode for experimental strategies (3 hours window)
const BOOST_MODE_DURATION = 3 * 60 * 60 * 1000; // 3 hours in ms
const boostModeStart = Date.now();
const isBoostModeActive = () => Date.now() - boostModeStart < BOOST_MODE_DURATION;

export interface StrategyResult {
  symbol: string;
  price: string;
  priceChangePercent: string;
  strategy: StrategyId;
  strategyName: string;
  entryReason: string; // سبب الدخول بالتفصيل
  volumeMultiplier?: number; // مضاعف الحجم
  rsiValue?: number; // قيمة RSI
  atr?: number; // مؤشر ATR للتذبذب
  volatilityPercent?: number; // نسبة التذبذب
  isExperimental?: boolean; // علامة للاستراتيجيات التجريبية
  takeProfitPercent?: number; // هدف الربح للنطاق
}

// Calculate simulated RSI based on price change momentum
const calculateSimulatedRSI = (priceChangePercent: number): number => {
  const normalized = Math.max(-10, Math.min(10, priceChangePercent));
  return 50 + (normalized * 4);
};

// Calculate ATR-like volatility from high/low prices
const calculateATR = (coin: CoinData): number => {
  const high = parseFloat(coin.highPrice);
  const low = parseFloat(coin.lowPrice);
  const current = parseFloat(coin.price);
  if (current === 0) return 0;
  // ATR as percentage of current price
  return ((high - low) / current) * 100;
};

// Calculate volume multiplier (current vs 24h average)
const calculateVolumeMultiplier = (coin: CoinData): number => {
  const volume24h = parseFloat(coin.quoteVolume);
  // Assume 24 hours = 1440 minutes, estimate hourly average
  // Current volume is high if it significantly exceeds hourly average
  const avgHourlyVolume = volume24h / 24;
  // Estimate current hour volume from recent activity (price change indicates activity)
  const priceChange = Math.abs(parseFloat(coin.priceChangePercent));
  // Higher price change = higher relative volume
  const estimatedCurrentVolume = avgHourlyVolume * (1 + priceChange / 10);
  return estimatedCurrentVolume / avgHourlyVolume;
};

interface RSIHistory {
  previousRSI: number;
  currentRSI: number;
  crossedUp: boolean;
}

export const useStrategies = (
  coins: CoinData[],
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
) => {
  // Track RSI history for bounce detection
  const rsiHistory = useRef<Map<string, RSIHistory>>(new Map());
  
  // Update RSI history
  useEffect(() => {
    coins.forEach(coin => {
      const currentRSI = calculateSimulatedRSI(parseFloat(coin.priceChangePercent));
      const history = rsiHistory.current.get(coin.symbol);
      
      if (history) {
        // Check if RSI crossed 35 from below
        const crossedUp = history.previousRSI < 35 && currentRSI >= 35;
        rsiHistory.current.set(coin.symbol, {
          previousRSI: history.currentRSI,
          currentRSI,
          crossedUp,
        });
      } else {
        rsiHistory.current.set(coin.symbol, {
          previousRSI: currentRSI,
          currentRSI,
          crossedUp: false,
        });
      }
    });
  }, [coins]);

  const results = useMemo(() => {
    // Core strategies (الكنز)
    const breakouts: StrategyResult[] = [];
    const rsiBounces: StrategyResult[] = [];
    const scalpings: StrategyResult[] = [];
    // Experimental strategies (تجريبية)
    const institutionals: StrategyResult[] = [];
    const crossovers: StrategyResult[] = [];

    coins.forEach((coin) => {
      const changePercent = parseFloat(coin.priceChangePercent);
      const volumeMultiplier = calculateVolumeMultiplier(coin);
      const rsiValue = calculateSimulatedRSI(changePercent);
      const atr = calculateATR(coin);
      const volatilityPercent = atr;
      const volume24h = parseFloat(coin.quoteVolume);
      const boostActive = isBoostModeActive();
      
      // ═══════════════════════════════════════════════════════════════
      // CORE STRATEGIES (الكنز) - لا تغيير على الإعدادات الأصلية
      // ═══════════════════════════════════════════════════════════════
      
      // Strategy 10: Breakout Detection with Volume Confirmation
      // Conditions: ≥1.5% price explosion + volume 2.5x higher than average
      if (changePercent >= 1.5 && volumeMultiplier >= 2.5) {
        const entryReason = `اختراق سعري +${changePercent.toFixed(2)}% | حجم ${volumeMultiplier.toFixed(1)}x من المتوسط`;
        breakouts.push({
          symbol: coin.symbol,
          price: coin.price,
          priceChangePercent: coin.priceChangePercent,
          strategy: 'breakout',
          strategyName: 'اختراق مؤكد',
          entryReason,
          volumeMultiplier,
          rsiValue,
          atr,
          volatilityPercent,
          isExperimental: false,
        });
      }

      // Strategy 65: RSI Bounce Detection
      // Conditions: RSI was below 35 and NOW crosses ABOVE 35 (upward crossover)
      const history = rsiHistory.current.get(coin.symbol);
      if (history?.crossedUp) {
        const entryReason = `ارتداد RSI | قفز من ${history.previousRSI.toFixed(0)} → ${history.currentRSI.toFixed(0)} (فوق 35)`;
        rsiBounces.push({
          symbol: coin.symbol,
          price: coin.price,
          priceChangePercent: coin.priceChangePercent,
          strategy: 'rsi_bounce',
          strategyName: 'ارتداد RSI مؤكد',
          entryReason,
          volumeMultiplier,
          rsiValue: history.currentRSI,
          atr,
          volatilityPercent,
          isExperimental: false,
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // 📊 SCALPING STRATEGY (النطاق) - S20: Low Volatility Range Trading
      // ═══════════════════════════════════════════════════════════════
      
      // Conditions: Very low volatility (<1.5%) + RSI bouncing from 35 area + Volume > $10M
      // Take Profit: 1.2% fixed, Stop Loss: 0.8% for fast turnover
      if (volatilityPercent < 1.5 && rsiValue >= 33 && rsiValue <= 42 && changePercent > 0.1 && changePercent < 1 && volume24h >= 10000000) {
        const takeProfitPercent = 1.2; // Fixed 1.2% TP for fast turnover
        const entryReason = `نطاق ضيق | حجم $${(volume24h / 1000000).toFixed(0)}M | تذبذب ${volatilityPercent.toFixed(2)}% | RSI ${rsiValue.toFixed(0)} | TP:1.2% SL:0.8%`;
        scalpings.push({
          symbol: coin.symbol,
          price: coin.price,
          priceChangePercent: coin.priceChangePercent,
          strategy: 'scalping',
          strategyName: 'سكالبينج النطاق',
          entryReason,
          volumeMultiplier,
          rsiValue,
          atr,
          volatilityPercent,
          isExperimental: false,
          takeProfitPercent,
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // EXPERIMENTAL STRATEGIES (تجريبية) - للمقارنة فقط
      // ═══════════════════════════════════════════════════════════════
      
      // 🏛️ Institutional Strategy: High Volume + Stable Movement
      // BOOST MODE: Ignore high RSI restriction for 3 hours
      const institutionalRSIPass = boostActive ? true : (rsiValue < 70);
      if (volume24h > 50000000 && volatilityPercent < 3 && changePercent > 0.3 && changePercent < 2 && institutionalRSIPass) {
        const boostTag = boostActive ? ' [🚀وضع التنشيط]' : '';
        const entryReason = `حجم مؤسسي $${(volume24h / 1000000).toFixed(0)}M | تذبذب منخفض ${volatilityPercent.toFixed(1)}%${boostTag}`;
        institutionals.push({
          symbol: coin.symbol,
          price: coin.price,
          priceChangePercent: coin.priceChangePercent,
          strategy: 'institutional',
          strategyName: 'صفقة مؤسسية',
          entryReason,
          volumeMultiplier,
          rsiValue,
          atr,
          volatilityPercent,
          isExperimental: true,
        });
      }

      // ⚡ Crossover Strategy: RSI + Volume Alignment
      // BOOST MODE: Widen RSI zone from 45-55 to 35-65
      const rsiMin = boostActive ? 35 : 45;
      const rsiMax = boostActive ? 65 : 55;
      if (rsiValue >= rsiMin && rsiValue <= rsiMax && volumeMultiplier >= 1.8 && changePercent > 0.5) {
        const boostTag = boostActive ? ' [🚀وضع التنشيط]' : '';
        const entryReason = `تقاطع محايد RSI=${rsiValue.toFixed(0)} | حجم ${volumeMultiplier.toFixed(1)}x | زخم +${changePercent.toFixed(2)}%${boostTag}`;
        crossovers.push({
          symbol: coin.symbol,
          price: coin.price,
          priceChangePercent: coin.priceChangePercent,
          strategy: 'crossover',
          strategyName: 'تقاطع زخمي',
          entryReason,
          volumeMultiplier,
          rsiValue,
          atr,
          volatilityPercent,
          isExperimental: true,
        });
      }
    });

    return {
      // Core
      breakouts,
      rsiBounces,
      scalpings,
      totalBreakouts: breakouts.length,
      totalRsiBounces: rsiBounces.length,
      totalScalpings: scalpings.length,
      // Experimental
      institutionals,
      crossovers,
      totalInstitutionals: institutionals.length,
      totalCrossovers: crossovers.length,
    };
  }, [coins]);

  // Log strategy detections with detailed reasons and silence notifications
  const logStrategyResults = (results: ReturnType<typeof useStrategies>['results']) => {
    const boostActive = isBoostModeActive();
    const boostStatus = boostActive ? '[🚀 وضع التنشيط: نشط]' : '';
    
    // Core strategies
    results.breakouts.slice(0, 3).forEach((result) => {
      addLogEntry(
        `[الاختراق:S10] ${result.symbol} | $${parseFloat(result.price).toFixed(4)} | ${result.entryReason}`,
        'warning'
      );
    });

    results.rsiBounces.slice(0, 3).forEach((result) => {
      addLogEntry(
        `[الارتداد:S65] ${result.symbol} | $${parseFloat(result.price).toFixed(4)} | ${result.entryReason}`,
        'warning'
      );
    });

    // Scalping strategy
    results.scalpings.slice(0, 3).forEach((result) => {
      addLogEntry(
        `[النطاق:S20] ${result.symbol} | $${parseFloat(result.price).toFixed(4)} | ${result.entryReason}`,
        'warning'
      );
    });

    // Experimental strategies with boost tag
    if (results.institutionals.length > 0) {
      results.institutionals.slice(0, 2).forEach((result) => {
        addLogEntry(
          `[المؤسسي:تجريبي] ${result.symbol} | $${parseFloat(result.price).toFixed(4)} | ${result.entryReason}`,
          'info'
        );
      });
    } else {
      addLogEntry(
        `[المؤسسي🏛️]: لا توجد فرص تطابق شروط السيولة العالية (>$50M) والتذبذب المنخفض (<3%) حالياً ${boostStatus}`,
        'info'
      );
    }

    if (results.crossovers.length > 0) {
      results.crossovers.slice(0, 2).forEach((result) => {
        addLogEntry(
          `[التقاطعات:تجريبي] ${result.symbol} | $${parseFloat(result.price).toFixed(4)} | ${result.entryReason}`,
          'info'
        );
      });
    } else {
      const rsiRange = boostActive ? '35-65' : '45-55';
      addLogEntry(
        `[التقاطعات⚡]: لا توجد فرص في نطاق RSI المحايد (${rsiRange}) مع حجم كافٍ حالياً ${boostStatus}`,
        'info'
      );
    }

    // Log boost mode status once
    if (boostActive) {
      const remainingMs = BOOST_MODE_DURATION - (Date.now() - boostModeStart);
      const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
      const remainingMins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      addLogEntry(
        `[تنشيط المحركات] وضع التعزيز نشط | متبقي: ${remainingHours}س ${remainingMins}د | RSI مرن للاستراتيجيات التجريبية`,
        'success'
      );
    }
  };

  return { results, logStrategyResults };
};
