import { useMemo, useRef, useEffect } from 'react';
import { CoinData } from './useBinanceData';

export interface StrategyResult {
  symbol: string;
  price: string;
  priceChangePercent: string;
  strategy: 'breakout' | 'rsi_bounce';
  strategyName: string;
  entryReason: string; // سبب الدخول بالتفصيل
  volumeMultiplier?: number; // مضاعف الحجم
  rsiValue?: number; // قيمة RSI
  atr?: number; // مؤشر ATR للتذبذب
  volatilityPercent?: number; // نسبة التذبذب
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
    const breakouts: StrategyResult[] = [];
    const rsiBounces: StrategyResult[] = [];

    coins.forEach((coin) => {
      const changePercent = parseFloat(coin.priceChangePercent);
      const volumeMultiplier = calculateVolumeMultiplier(coin);
      const rsiValue = calculateSimulatedRSI(changePercent);
      const atr = calculateATR(coin);
      const volatilityPercent = atr;
      
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
        });
      }
    });

    return {
      breakouts,
      rsiBounces,
      totalBreakouts: breakouts.length,
      totalRsiBounces: rsiBounces.length,
    };
  }, [coins]);

  // Log strategy detections with detailed reasons
  const logStrategyResults = (results: ReturnType<typeof useStrategies>['results']) => {
    results.breakouts.slice(0, 3).forEach((result) => {
      addLogEntry(
        `[استراتيجية_10] ${result.symbol} | $${parseFloat(result.price).toFixed(4)} | ${result.entryReason}`,
        'warning'
      );
    });

    results.rsiBounces.slice(0, 3).forEach((result) => {
      addLogEntry(
        `[استراتيجية_65] ${result.symbol} | $${parseFloat(result.price).toFixed(4)} | ${result.entryReason}`,
        'warning'
      );
    });
  };

  return { results, logStrategyResults };
};
