import { useMemo } from 'react';
import { CoinData } from './useBinanceData';

export interface StrategyResult {
  symbol: string;
  price: string;
  priceChangePercent: string;
  strategy: 'breakout' | 'rsi_bounce';
  strategyName: string;
}

// Simplified RSI calculation using price change momentum
// In real scenario, you'd need historical kline data for proper RSI
const calculateSimulatedRSI = (priceChangePercent: number): number => {
  // Map price change to RSI-like value (0-100)
  // Strong negative = low RSI, strong positive = high RSI
  const normalized = Math.max(-10, Math.min(10, priceChangePercent));
  return 50 + (normalized * 4);
};

export const useStrategies = (
  coins: CoinData[],
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
) => {
  const results = useMemo(() => {
    const breakouts: StrategyResult[] = [];
    const rsiBounces: StrategyResult[] = [];

    coins.forEach((coin) => {
      const changePercent = parseFloat(coin.priceChangePercent);
      
      // Strategy 10: Breakout Detection (≥1.5% explosion)
      if (changePercent >= 1.5) {
        breakouts.push({
          symbol: coin.symbol,
          price: coin.price,
          priceChangePercent: coin.priceChangePercent,
          strategy: 'breakout',
          strategyName: 'مرشح للاختراق',
        });
      }

      // Strategy 65: RSI Bounce Detection
      const simulatedRSI = calculateSimulatedRSI(changePercent);
      
      // RSI < 35 and starting to bounce (small positive or recovering)
      if (simulatedRSI < 35 && changePercent > -5 && changePercent < 0) {
        rsiBounces.push({
          symbol: coin.symbol,
          price: coin.price,
          priceChangePercent: coin.priceChangePercent,
          strategy: 'rsi_bounce',
          strategyName: 'ارتداد RSI',
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

  // Log strategy detections
  const logStrategyResults = (results: ReturnType<typeof useStrategies>['results']) => {
    results.breakouts.slice(0, 3).forEach((result) => {
      addLogEntry(
        `[استراتيجية_10] العملة: ${result.symbol} | السعر: $${parseFloat(result.price).toFixed(4)} | التغير: +${parseFloat(result.priceChangePercent).toFixed(2)}% ← ${result.strategyName}`,
        'warning'
      );
    });

    results.rsiBounces.slice(0, 3).forEach((result) => {
      addLogEntry(
        `[استراتيجية_65] العملة: ${result.symbol} | السعر: $${parseFloat(result.price).toFixed(4)} | التغير: ${parseFloat(result.priceChangePercent).toFixed(2)}% ← ${result.strategyName}`,
        'warning'
      );
    });
  };

  return { results, logStrategyResults };
};
