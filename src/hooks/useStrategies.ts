import { useMemo, useRef, useEffect } from 'react';
import { CoinData } from './useBinanceData';
import { SYSTEM_VERSION } from '@/lib/version';

// v2.3-S20-Only: Only Scalping Strategy Active (others disabled but types kept for compatibility)
const VERSION = SYSTEM_VERSION;

// Keep all strategy types for compatibility, but only 'scalping' produces results
export type StrategyId = 'breakout' | 'rsi_bounce' | 'institutional' | 'crossover' | 'scalping';

// Strategy Manifests - Only S20 is active
export const STRATEGY_MANIFESTS = {
  scalping: {
    name: 'S20 - النطاق (المحرك الوحيد النشط)',
    rules: [
      'تذبذب منخفض: < 3%',
      'RSI: بين 30-50',
      'حجم التداول: > $5M',
      'TP: 1.2% | SL: 0.8%',
      'مبلغ الصفقة: 40% من الرصيد (الحد الأدنى 10 USDT)',
      'تقييم ≥ 60 = شراء فوري',
    ],
  },
  // Disabled strategies - kept for type compatibility
  breakout: { name: 'S10 - معطل', rules: ['معطل في v2.3'] },
  rsi_bounce: { name: 'S65 - معطل', rules: ['معطل في v2.3'] },
  institutional: { name: 'المؤسسي - معطل', rules: ['معطل في v2.3'] },
  crossover: { name: 'التقاطعات - معطل', rules: ['معطل في v2.3'] },
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
    // v2.3-S20-Only: Only scalping strategy is active
    const scalpings: StrategyResult[] = [];

    coins.forEach((coin) => {
      const changePercent = parseFloat(coin.priceChangePercent);
      const volume24h = parseFloat(coin.quoteVolume);
      const rsiValue = calculateSimulatedRSI(changePercent);
      const atr = calculateATR(coin);
      const volatilityPercent = atr;
      const volumeMultiplier = calculateVolumeMultiplier(coin);
      
      // ═══════════════════════════════════════════════════════════════
      // 📊 S20: SCALPING STRATEGY - المحرك الوحيد النشط
      // Expanded conditions for TRX, ZEC and similar assets
      // ═══════════════════════════════════════════════════════════════
      
      // v2.3: Expanded conditions: volatility < 3%, RSI 30-50, Volume > $5M
      // This allows TRX (high volume, stable) and ZEC to qualify
      if (volatilityPercent < 3 && rsiValue >= 30 && rsiValue <= 50 && changePercent > -0.5 && changePercent < 2 && volume24h >= 5000000) {
        // Calculate opportunity score (0-100)
        const volumeScore = Math.min(40, (volume24h / 50000000) * 40); // High volume = better
        const rsiScore = rsiValue >= 35 && rsiValue <= 45 ? 30 : 20; // Optimal RSI zone
        const stabilityScore = Math.max(0, 30 - volatilityPercent * 10); // Low volatility = better
        const totalScore = Math.round(volumeScore + rsiScore + stabilityScore);
        
        const takeProfitPercent = 1.2; // Fixed 1.2% TP
        const entryReason = `نطاق S20 | حجم $${(volume24h / 1000000).toFixed(0)}M | تذبذب ${volatilityPercent.toFixed(2)}% | RSI ${rsiValue.toFixed(0)} | TP:1.2% SL:0.8%`;
        scalpings.push({
          symbol: coin.symbol,
          price: coin.price,
          priceChangePercent: coin.priceChangePercent,
          strategy: 'scalping',
          strategyName: 'سكالبينج النطاق S20',
          entryReason,
          volumeMultiplier,
          rsiValue,
          atr,
          volatilityPercent,
          isExperimental: false,
          takeProfitPercent,
          score: totalScore,
        });
      }
    });

    return {
      // v2.3-S20-Only: Only scalping results returned
      scalpings,
      totalScalpings: scalpings.length,
      // Disabled strategies return empty
      breakouts: [] as StrategyResult[],
      rsiBounces: [] as StrategyResult[],
      institutionals: [] as StrategyResult[],
      crossovers: [] as StrategyResult[],
      totalBreakouts: 0,
      totalRsiBounces: 0,
      totalInstitutionals: 0,
      totalCrossovers: 0,
    };
  }, [coins]);

  // v2.3-S20-Only: Log only S20 results - no experimental tags
  const logStrategyResults = (results: ReturnType<typeof useStrategies>['results']) => {
    // S20: Scalping - المحرك الوحيد النشط
    if (results.scalpings.length > 0) {
      results.scalpings.slice(0, 5).forEach((result) => {
        addLogEntry(
          `[${VERSION}][النطاق:S20:LIVE] ${result.symbol} | $${parseFloat(result.price).toFixed(4)} | تقييم: ${result.score || 0}/100 | ${result.entryReason}`,
          'warning'
        );
      });
    } else {
      addLogEntry(
        `[${VERSION}][النطاق:S20:LIVE] لا فرص حالياً | البحث عن أصول (تذبذب <3% + RSI 30-50 + حجم >$5M)`,
        'info'
      );
    }
  };

  return { results, logStrategyResults, version: VERSION };
};
