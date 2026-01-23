import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { CoinData } from './useBinanceData';
import { StrategyResult } from './useStrategies';
import { Position, ClosedTrade, PerformanceStats, PendingOpportunity } from './usePaperTrading';

const DEFAULT_TRAILING_STOP_PERCENT = 1;
const FEE_PERCENT = 0.1;
const MAX_OPEN_POSITIONS = 10;
const PROFIT_LOCK_THRESHOLD = 3;
const PROFIT_LOCK_LEVEL = 2;

export type StrategyType = 'breakout' | 'rsi_bounce' | 'experimental';

export interface StrategyEngineConfig {
  name: string;
  nameAr: string;
  type: StrategyType;
  initialBalance: number;
  tradeAmount: number;
  tag: string;
}

export interface StrategyEngineState {
  balance: number;
  positions: Position[];
  closedTrades: ClosedTrade[];
  pendingOpportunities: PendingOpportunity[];
  performanceStats: PerformanceStats;
  openPositionsValue: number;
  totalPortfolioValue: number;
  openPositionsCount: number;
  roi: number;
}

export const useStrategyEngine = (
  config: StrategyEngineConfig,
  coins: CoinData[],
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
) => {
  const [balance, setBalance] = useState(config.initialBalance);
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [pendingOpportunities, setPendingOpportunities] = useState<PendingOpportunity[]>([]);
  const [autoTrading, setAutoTrading] = useState(false);
  const processedOpportunities = useRef<Set<string>>(new Set());

  // Calculate values
  const openPositionsValue = useMemo(() => 
    positions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0),
    [positions]
  );
  const totalPortfolioValue = balance + openPositionsValue;
  
  // ROI calculation
  const roi = useMemo(() => 
    ((totalPortfolioValue - config.initialBalance) / config.initialBalance) * 100,
    [totalPortfolioValue, config.initialBalance]
  );

  // Performance stats
  const performanceStats: PerformanceStats = useMemo(() => ({
    totalPnL: closedTrades.reduce((sum, trade) => sum + trade.pnlAmount, 0),
    totalPnLPercent: closedTrades.length > 0 
      ? closedTrades.reduce((sum, trade) => sum + trade.pnlPercent, 0) / closedTrades.length 
      : 0,
    winningTrades: closedTrades.filter(t => t.isWin).length,
    losingTrades: closedTrades.filter(t => !t.isWin).length,
    winRate: closedTrades.length > 0 
      ? (closedTrades.filter(t => t.isWin).length / closedTrades.length) * 100 
      : 0,
    totalTrades: closedTrades.length,
  }), [closedTrades]);

  // Open position
  const openPosition = useCallback((opportunity: StrategyResult, skipConfirmation: boolean = false) => {
    const existingPosition = positions.find(p => p.symbol === opportunity.symbol);
    if (existingPosition) return;

    if (balance < config.tradeAmount) {
      addLogEntry(`[${config.tag}] الرصيد غير كافٍ للتداول`, 'warning');
      return;
    }

    if (!skipConfirmation) {
      const pendingId = crypto.randomUUID();
      setPendingOpportunities(prev => [...prev, {
        id: pendingId,
        opportunity,
        detectedAt: new Date(),
      }]);
      return;
    }

    const fee = config.tradeAmount * (FEE_PERCENT / 100);
    const entryPrice = parseFloat(opportunity.price);
    const quantity = (config.tradeAmount - fee) / entryPrice;
    
    // Use dynamic trailing stop from opportunity ATR, or default
    const trailingStopPercent = opportunity.atr 
      ? Math.max(0.5, Math.min(3, 1 + (opportunity.atr * 0.3))) 
      : DEFAULT_TRAILING_STOP_PERCENT;
    const trailingStopPrice = entryPrice * (1 - trailingStopPercent / 100);

    const newPosition: Position = {
      id: crypto.randomUUID(),
      symbol: opportunity.symbol,
      entryPrice,
      currentPrice: entryPrice,
      quantity,
      investedAmount: config.tradeAmount,
      highestPrice: entryPrice,
      trailingStopPrice,
      trailingStopPercent,
      strategy: opportunity.strategy,
      strategyName: opportunity.strategyName,
      entryReason: opportunity.entryReason || opportunity.strategyName,
      openedAt: new Date(),
      pnlPercent: -FEE_PERCENT,
      pnlAmount: -fee,
    };

    setPositions(prev => [...prev, newPosition]);
    setBalance(prev => prev - config.tradeAmount);

    addLogEntry(
      `[${config.tag}:شراء] ${opportunity.symbol} | $${entryPrice.toFixed(6)} | ${quantity.toFixed(4)}`,
      'success'
    );
  }, [positions, balance, config, addLogEntry]);

  // Confirm pending
  const confirmPendingOpportunity = useCallback((pendingId: string) => {
    const pending = pendingOpportunities.find(p => p.id === pendingId);
    if (!pending) return;
    setPendingOpportunities(prev => prev.filter(p => p.id !== pendingId));
    openPosition(pending.opportunity, true);
  }, [pendingOpportunities, openPosition]);

  // Dismiss pending
  const dismissPendingOpportunity = useCallback((pendingId: string) => {
    setPendingOpportunities(prev => prev.filter(p => p.id !== pendingId));
  }, []);

  // Close position
  const closePosition = useCallback((position: Position, currentPrice: number, reason: string) => {
    const exitFee = (position.quantity * currentPrice) * (FEE_PERCENT / 100);
    const grossValue = position.quantity * currentPrice;
    const netValue = grossValue - exitFee;
    const pnlAmount = netValue - position.investedAmount;
    const pnlPercent = (pnlAmount / position.investedAmount) * 100;
    const isWin = pnlAmount > 0;

    const closedTrade: ClosedTrade = {
      id: position.id,
      symbol: position.symbol,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      quantity: position.quantity,
      investedAmount: position.investedAmount,
      pnlPercent,
      pnlAmount,
      strategy: position.strategy,
      openedAt: position.openedAt,
      closedAt: new Date(),
      isWin,
    };

    setClosedTrades(prev => [...prev, closedTrade]);
    setPositions(prev => prev.filter(p => p.id !== position.id));
    setBalance(prev => prev + netValue);

    const pnlSign = pnlAmount >= 0 ? '+' : '';
    addLogEntry(
      `[${config.tag}:${reason}] ${position.symbol} | ${pnlSign}${pnlPercent.toFixed(2)}% (${pnlSign}$${pnlAmount.toFixed(2)})`,
      isWin ? 'success' : 'error'
    );
  }, [config.tag, addLogEntry]);

  // Update prices and check trailing stops
  useEffect(() => {
    if (coins.length === 0 || positions.length === 0) return;

    setPositions(prevPositions => {
      const updatedPositions: Position[] = [];
      const positionsToClose: { position: Position; currentPrice: number }[] = [];

      prevPositions.forEach(position => {
        const coin = coins.find(c => c.symbol === position.symbol);
        if (!coin) {
          updatedPositions.push(position);
          return;
        }

        const currentPrice = parseFloat(coin.price);
        let newHighestPrice = position.highestPrice;
        let newTrailingStopPrice = position.trailingStopPrice;

        const exitFee = (position.quantity * currentPrice) * (FEE_PERCENT / 100);
        const grossValue = position.quantity * currentPrice;
        const netValue = grossValue - exitFee;
        const pnlAmount = netValue - position.investedAmount;
        const pnlPercent = (pnlAmount / position.investedAmount) * 100;

        if (currentPrice > position.highestPrice) {
          newHighestPrice = currentPrice;
          newTrailingStopPrice = currentPrice * (1 - position.trailingStopPercent / 100);
        }
        
        if (pnlPercent > PROFIT_LOCK_THRESHOLD) {
          const lockPrice = position.entryPrice * (1 + PROFIT_LOCK_LEVEL / 100);
          if (newTrailingStopPrice < lockPrice) {
            newTrailingStopPrice = lockPrice;
          }
        }

        if (currentPrice <= newTrailingStopPrice) {
          positionsToClose.push({ position, currentPrice });
          return;
        }

        updatedPositions.push({
          ...position,
          currentPrice,
          highestPrice: newHighestPrice,
          trailingStopPrice: newTrailingStopPrice,
          pnlPercent,
          pnlAmount,
        });
      });

      positionsToClose.forEach(({ position, currentPrice }) => {
        setTimeout(() => closePosition(position, currentPrice, 'وقف_زاحف'), 0);
      });

      return updatedPositions;
    });
  }, [coins, closePosition]);

  // Process opportunities - filter by strategy type
  const processOpportunities = useCallback((opportunities: StrategyResult[], skipConfirmation: boolean = false) => {
    if (positions.length >= MAX_OPEN_POSITIONS) return;

    // Filter opportunities by this engine's strategy type
    const filteredOpportunities = opportunities.filter(opp => {
      if (config.type === 'breakout') return opp.strategy === 'breakout';
      if (config.type === 'rsi_bounce') return opp.strategy === 'rsi_bounce';
      if (config.type === 'experimental') return true; // Accept all for experimental
      return false;
    });

    const availableSlots = MAX_OPEN_POSITIONS - positions.length;
    let openedCount = 0;

    for (const opportunity of filteredOpportunities) {
      if (openedCount >= availableSlots) break;
      
      const opportunityKey = `${opportunity.symbol}-${config.type}`;
      
      if (!processedOpportunities.current.has(opportunityKey)) {
        openPosition(opportunity, skipConfirmation);
        processedOpportunities.current.add(opportunityKey);
        openedCount++;
        
        setTimeout(() => {
          processedOpportunities.current.delete(opportunityKey);
        }, 60000);
      }
    }
  }, [positions.length, openPosition, config.type]);

  // Manual close
  const manualClosePosition = useCallback((positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (position) {
      closePosition(position, position.currentPrice, 'بيع_يدوي');
    }
  }, [positions, closePosition]);

  // Reset
  const hardReset = useCallback(() => {
    setPositions([]);
    setClosedTrades([]);
    setPendingOpportunities([]);
    processedOpportunities.current.clear();
    setBalance(config.initialBalance);
    addLogEntry(`[${config.tag}] تم إعادة ضبط المحفظة إلى ${config.initialBalance} USDT`, 'info');
  }, [config, addLogEntry]);

  // Toggle auto trading
  const toggleAutoTrading = useCallback((enabled: boolean) => {
    setAutoTrading(enabled);
    addLogEntry(
      enabled 
        ? `[${config.tag}] ✓ تم تفعيل التداول الآلي` 
        : `[${config.tag}] ⚠ تم تفعيل التداول اليدوي`,
      enabled ? 'success' : 'warning'
    );
  }, [config.tag, addLogEntry]);

  return {
    config,
    balance,
    positions,
    closedTrades,
    performanceStats,
    pendingOpportunities,
    autoTrading,
    processOpportunities,
    manualClosePosition,
    confirmPendingOpportunity,
    dismissPendingOpportunity,
    hardReset,
    toggleAutoTrading,
    openPositionsCount: positions.length,
    openPositionsValue,
    totalPortfolioValue,
    roi,
    state: {
      balance,
      positions,
      closedTrades,
      pendingOpportunities,
      performanceStats,
      openPositionsValue,
      totalPortfolioValue,
      openPositionsCount: positions.length,
      roi,
    } as StrategyEngineState,
  };
};

export type StrategyEngine = ReturnType<typeof useStrategyEngine>;
