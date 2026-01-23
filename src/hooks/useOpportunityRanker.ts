import { useMemo } from 'react';
import { CoinData } from './useBinanceData';
import { StrategyResult } from './useStrategies';

export interface RankedOpportunity extends StrategyResult {
  score: number;
  volumeScore: number;
  rsiScore: number;
  volatilityScore: number;
  rankReason: string;
  volume24h: number;
  volatilityPercent: number;
  estimatedRSI: number;
  dynamicTrailingStop: number; // وقف زاحف ديناميكي بناءً على ATR
}

// Calculate simulated RSI based on price change momentum (0-100)
const calculateSimulatedRSI = (priceChangePercent: number): number => {
  const normalized = Math.max(-10, Math.min(10, priceChangePercent));
  return 50 + (normalized * 4);
};

// Calculate volatility (high-low range as percentage of current price)
const calculateVolatility = (coin: CoinData): number => {
  const high = parseFloat(coin.highPrice);
  const low = parseFloat(coin.lowPrice);
  const current = parseFloat(coin.price);
  if (current === 0) return 0;
  return ((high - low) / current) * 100;
};

export const useOpportunityRanker = (
  opportunities: StrategyResult[],
  coins: CoinData[],
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
) => {
  const rankedOpportunities = useMemo(() => {
    if (opportunities.length === 0) return [];

    const ranked: RankedOpportunity[] = opportunities.map(opp => {
      const coin = coins.find(c => c.symbol === opp.symbol);
      const volume24h = coin ? parseFloat(coin.quoteVolume) : 0;
      const priceChange = parseFloat(opp.priceChangePercent);
      const estimatedRSI = opp.rsiValue ?? calculateSimulatedRSI(priceChange);
      const volatilityPercent = opp.volatilityPercent ?? (coin ? calculateVolatility(coin) : 0);
      
      // Calculate dynamic trailing stop based on ATR (volatility)
      // Higher volatility = wider stop to avoid premature exits
      // Base: 1%, adjusted by ATR factor (0.5x to 2x)
      const atrValue = opp.atr ?? volatilityPercent;
      const dynamicTrailingStop = Math.max(0.5, Math.min(3, 1 + (atrValue * 0.3)));

      // Volume Score (0-40 points) - Higher is better
      // Top volume coins get higher scores
      const volumeScore = Math.min(40, (volume24h / 10000000) * 10);

      // RSI Score (0-30 points)
      // For RSI bounce: closer to 30 is better
      // For breakout: stronger momentum (higher RSI) is better
      let rsiScore = 0;
      if (opp.strategy === 'rsi_bounce') {
        // RSI closer to 30 = better bounce potential
        rsiScore = estimatedRSI < 40 ? 30 - (estimatedRSI - 20) : 0;
      } else {
        // For breakout: momentum strength (50-70 range ideal)
        rsiScore = estimatedRSI > 50 && estimatedRSI < 75 ? 25 : 15;
      }
      rsiScore = Math.max(0, Math.min(30, rsiScore));

      // Volatility Score (0-30 points) - Lower volatility is better for stability
      // Coins with less random swings are more predictable
      const volatilityScore = Math.max(0, 30 - volatilityPercent);

      const totalScore = volumeScore + rsiScore + volatilityScore;

      // Generate reason
      let rankReason = '';
      if (volumeScore >= 30) {
        rankReason = 'حجم تداول ضخم';
      } else if (rsiScore >= 25) {
        rankReason = opp.strategy === 'rsi_bounce' ? 'RSI ممتاز للارتداد' : 'زخم قوي للاختراق';
      } else if (volatilityScore >= 25) {
        rankReason = 'استقرار سعري عالي';
      } else {
        rankReason = 'توازن جيد';
      }

      return {
        ...opp,
        score: totalScore,
        volumeScore,
        rsiScore,
        volatilityScore,
        rankReason,
        volume24h,
        volatilityPercent,
        estimatedRSI,
        dynamicTrailingStop,
      };
    });

    // Sort by score (highest first)
    ranked.sort((a, b) => b.score - a.score);

    return ranked;
  }, [opportunities, coins]);

  // Get the golden opportunity (best one)
  const goldenOpportunity = rankedOpportunities.length > 0 ? rankedOpportunities[0] : null;

  // Log the golden opportunity
  const logGoldenOpportunity = () => {
    if (goldenOpportunity) {
      const volumeM = (goldenOpportunity.volume24h / 1000000).toFixed(2);
      addLogEntry(
        `🏆 [الفرصة_الذهبية] العملة: ${goldenOpportunity.symbol} | النقاط: ${goldenOpportunity.score.toFixed(1)}/100 | السبب: ${goldenOpportunity.rankReason}`,
        'success'
      );
      addLogEntry(
        `   📊 الحجم: $${volumeM}M | RSI: ${goldenOpportunity.estimatedRSI.toFixed(0)} | التذبذب: ${goldenOpportunity.volatilityPercent.toFixed(2)}%`,
        'info'
      );
    }
  };

  return {
    rankedOpportunities,
    goldenOpportunity,
    logGoldenOpportunity,
    totalOpportunities: rankedOpportunities.length,
  };
};
