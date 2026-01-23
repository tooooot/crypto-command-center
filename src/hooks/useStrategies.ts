import { useMemo, useRef, useEffect } from 'react';
import { CoinData } from './useBinanceData';
import { SYSTEM_VERSION } from '@/lib/version';

// v2.1-Live - Ultra Flexible Entry System
const VERSION = SYSTEM_VERSION;

// Core strategies (الكنز): breakout, rsi_bounce, scalping
// Experimental strategies (تجريبية): institutional, crossover
export type StrategyId = 'breakout' | 'rsi_bounce' | 'institutional' | 'crossover' | 'scalping';

// Boost mode for experimental strategies (3 hours window)
const BOOST_MODE_DURATION = 3 * 60 * 60 * 1000; // 3 hours in ms
const boostModeStart = Date.now();
const isBoostModeActive = () => Date.now() - boostModeStart < BOOST_MODE_DURATION;

// Strategy Manifests (قوانين الاستراتيجية)
export const STRATEGY_MANIFESTS = {
  breakout: {
    name: 'S10 - الاختراق',
    rules: [
      'حد التذبذب: ≤ 10%',
      'RSI المسموح: حتى 90 مع حجم ≥ 1.8x',
      'الحد الأدنى للتغير: +1.0%',
      'مبلغ الصفقة: 1000 USDT',
    ],
  },
  rsi_bounce: {
    name: 'S65 - ارتداد RSI',
    rules: [
      'شرط الدخول: عبور RSI من تحت 35 إلى فوق 35',
      'مبلغ الصفقة: 1000 USDT',
    ],
  },
  scalping: {
    name: 'S20 - النطاق',
    rules: [
      'تذبذب منخفض: < 1.5%',
      'RSI: بين 33-42',
      'حجم التداول: > $10M',
      'TP: 1.2% | SL: 0.8%',
      'مبلغ الصفقة: 1000 USDT',
    ],
  },
  institutional: {
    name: 'المؤسسي',
    rules: [
      'سيولة عالية: > $50M',
      'تذبذب منخفض: < 10%',
      'مبلغ الصفقة: 1000 USDT',
    ],
  },
  crossover: {
    name: 'التقاطعات',
    rules: [
      'RSI محايد: 35-65 (وضع التنشيط) أو 45-55',
      'حجم: > 1.8x',
      'مبلغ الصفقة: 1000 USDT',
    ],
  },
};

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
  score?: number; // تقييم الفرصة من 100
}

export const getVersion = () => VERSION;

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
      // CORE STRATEGIES (الكنز) - v2.1 Flexible Entry
      // ═══════════════════════════════════════════════════════════════
      
      // Strategy 10: Breakout Detection with Volume Confirmation
      // v2.1-Final: Allow volatility up to 10%, RSI up to 90 if volume >= 1.8x, price change >= 1.0%
      const isBreakoutVolumeSufficient = volumeMultiplier >= 1.8; // Lowered from 2.5x to 1.8x
      const isBreakoutRSIAllowed = isBreakoutVolumeSufficient ? rsiValue <= 90 : rsiValue <= 70;
      const isBreakoutVolatilityAllowed = volatilityPercent <= 10;
      
      if (changePercent >= 1.0 && isBreakoutVolumeSufficient && isBreakoutRSIAllowed && isBreakoutVolatilityAllowed) { // Lowered from 1.5% to 1.0%
        // Calculate opportunity score (0-100)
        const volumeScore = Math.min(40, (volumeMultiplier / 5) * 40);
        const rsiScore = rsiValue < 70 ? 30 : (90 - rsiValue) / 20 * 30;
        const stabilityScore = Math.max(0, 30 - volatilityPercent * 3);
        const totalScore = Math.round(volumeScore + rsiScore + stabilityScore);
        
        const entryReason = `اختراق +${changePercent.toFixed(2)}% | حجم ${volumeMultiplier.toFixed(1)}x | RSI ${rsiValue.toFixed(0)} | تذبذب ${volatilityPercent.toFixed(1)}%`;
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
          score: totalScore,
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
      // EXPERIMENTAL STRATEGIES (تجريبية) - v2.1 Flexible Entry
      // ═══════════════════════════════════════════════════════════════
      
      // 🏛️ Institutional Strategy: High Volume + Stable Movement
      // v2.1: Allow volatility up to 10% (raised from 3%)
      const institutionalRSIPass = boostActive ? true : (rsiValue < 70);
      if (volume24h > 50000000 && volatilityPercent < 10 && changePercent > 0.3 && changePercent < 5 && institutionalRSIPass) {
        const volumeScore = Math.min(40, (volume24h / 100000000) * 40);
        const rsiScore = rsiValue < 50 ? 30 : 30 - ((rsiValue - 50) / 40 * 30);
        const stabilityScore = Math.max(0, 30 - volatilityPercent * 3);
        const totalScore = Math.round(volumeScore + rsiScore + stabilityScore);
        
        const boostTag = boostActive ? ' [🚀وضع التنشيط]' : '';
        const entryReason = `حجم مؤسسي $${(volume24h / 1000000).toFixed(0)}M | تذبذب ${volatilityPercent.toFixed(1)}%${boostTag}`;
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
          score: totalScore,
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

  // Log strategy detections with detailed reasons and FORCED silence notifications
  const logStrategyResults = (results: ReturnType<typeof useStrategies>['results']) => {
    const boostActive = isBoostModeActive();
    const boostStatus = boostActive ? '[🚀 وضع التنشيط: نشط]' : '';
    
    // === CORE STRATEGIES (الكنز) ===
    
    // S10: Breakout
    if (results.breakouts.length > 0) {
      results.breakouts.slice(0, 3).forEach((result) => {
        addLogEntry(
          `[${VERSION}][الاختراق:S10] ${result.symbol} | $${parseFloat(result.price).toFixed(4)} | تقييم: ${result.score || 0}/100 | ${result.entryReason}`,
          'warning'
        );
      });
    } else {
      // FORCED: Technical reason for no S10 opportunities
      addLogEntry(
        `[${VERSION}][الاختراق:S10] لا فرص حالياً | السبب: لا يوجد أصل يحقق (تغير ≥1.5% + حجم ≥2.5x + تذبذب ≤10%)`,
        'info'
      );
    }

    // S65: RSI Bounce
    if (results.rsiBounces.length > 0) {
      results.rsiBounces.slice(0, 3).forEach((result) => {
        addLogEntry(
          `[${VERSION}][الارتداد:S65] ${result.symbol} | $${parseFloat(result.price).toFixed(4)} | ${result.entryReason}`,
          'warning'
        );
      });
    } else {
      // FORCED: Technical reason for no S65 opportunities
      addLogEntry(
        `[${VERSION}][الارتداد:S65] لا فرص حالياً | السبب: لا يوجد عبور RSI من تحت 35 إلى فوق 35`,
        'info'
      );
    }

    // S20: Scalping
    if (results.scalpings.length > 0) {
      results.scalpings.slice(0, 3).forEach((result) => {
        addLogEntry(
          `[${VERSION}][النطاق:S20] ${result.symbol} | $${parseFloat(result.price).toFixed(4)} | ${result.entryReason}`,
          'warning'
        );
      });
    } else {
      // FORCED: Technical reason for no S20 opportunities
      addLogEntry(
        `[${VERSION}][النطاق:S20] لا فرص حالياً | السبب: لا يوجد أصل يحقق (تذبذب <1.5% + RSI 33-42 + حجم >$10M)`,
        'info'
      );
    }

    // === EXPERIMENTAL STRATEGIES (تجريبية) ===
    
    if (results.institutionals.length > 0) {
      results.institutionals.slice(0, 2).forEach((result) => {
        addLogEntry(
          `[${VERSION}][المؤسسي:تجريبي] ${result.symbol} | تقييم: ${result.score || 0}/100 | ${result.entryReason}`,
          'info'
        );
      });
    } else {
      addLogEntry(
        `[${VERSION}][المؤسسي🏛️] لا فرص حالياً | السبب: لا يوجد أصل (سيولة >$50M + تذبذب <10%) ${boostStatus}`,
        'info'
      );
    }

    if (results.crossovers.length > 0) {
      results.crossovers.slice(0, 2).forEach((result) => {
        addLogEntry(
          `[${VERSION}][التقاطعات:تجريبي] ${result.symbol} | ${result.entryReason}`,
          'info'
        );
      });
    } else {
      const rsiRange = boostActive ? '35-65' : '45-55';
      addLogEntry(
        `[${VERSION}][التقاطعات⚡] لا فرص حالياً | السبب: لا يوجد RSI محايد (${rsiRange}) مع حجم ≥1.8x ${boostStatus}`,
        'info'
      );
    }

    // Boost mode status
    if (boostActive) {
      const remainingMs = BOOST_MODE_DURATION - (Date.now() - boostModeStart);
      const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
      const remainingMins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      addLogEntry(
        `[${VERSION}][تنشيط المحركات] وضع التعزيز نشط | متبقي: ${remainingHours}س ${remainingMins}د`,
        'success'
      );
    }
  };

  return { results, logStrategyResults, version: VERSION };
};
