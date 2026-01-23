import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { CoinData } from './useBinanceData';
import { StrategyResult } from './useStrategies';
import { Position, ClosedTrade, PerformanceStats, PendingOpportunity } from './usePaperTrading';

const VIRTUAL_TRADE_AMOUNT = 100; // 100 USDT per trade in virtual mode
const DEFAULT_TRAILING_STOP_PERCENT = 1;
const FEE_PERCENT = 0.1;
const MAX_OPEN_POSITIONS = 10;
const PROFIT_LOCK_THRESHOLD = 3;
const PROFIT_LOCK_LEVEL = 2;

export const useVirtualTrading = (
  initialBalance: number,
  coins: CoinData[],
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
) => {
  const [virtualBalance, setVirtualBalance] = useState(initialBalance);
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [pendingOpportunities, setPendingOpportunities] = useState<PendingOpportunity[]>([]);
  const processedOpportunities = useRef<Set<string>>(new Set());

  // Calculate values
  const openPositionsValue = useMemo(() => 
    positions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0),
    [positions]
  );
  const totalPortfolioValue = virtualBalance + openPositionsValue;

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

  // Open position (LOCAL - no server)
  const openPosition = useCallback((opportunity: StrategyResult, skipConfirmation: boolean = false) => {
    const existingPosition = positions.find(p => p.symbol === opportunity.symbol);
    if (existingPosition) return;

    if (virtualBalance < VIRTUAL_TRADE_AMOUNT) {
      addLogEntry(`[افتراضي] الرصيد غير كافٍ للتداول`, 'warning');
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

    const fee = VIRTUAL_TRADE_AMOUNT * (FEE_PERCENT / 100);
    const entryPrice = parseFloat(opportunity.price);
    const quantity = (VIRTUAL_TRADE_AMOUNT - fee) / entryPrice;
    
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
      investedAmount: VIRTUAL_TRADE_AMOUNT,
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
    setVirtualBalance(prev => prev - VIRTUAL_TRADE_AMOUNT);

    addLogEntry(
      `[افتراضي:شراء] ${opportunity.symbol} | $${entryPrice.toFixed(6)} | ${quantity.toFixed(4)}`,
      'success'
    );
  }, [positions, virtualBalance, addLogEntry]);

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
    setVirtualBalance(prev => prev + netValue);

    const pnlSign = pnlAmount >= 0 ? '+' : '';
    addLogEntry(
      `[افتراضي:${reason}] ${position.symbol} | ${pnlSign}${pnlPercent.toFixed(2)}% (${pnlSign}$${pnlAmount.toFixed(2)})`,
      isWin ? 'success' : 'error'
    );
  }, [addLogEntry]);

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
          // Use position's dynamic trailing stop percent
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

  // Process opportunities - skipConfirmation bypasses manual confirmation when auto-trading is ON
  const processOpportunities = useCallback((opportunities: StrategyResult[], skipConfirmation: boolean = false) => {
    if (positions.length >= MAX_OPEN_POSITIONS) return;

    const availableSlots = MAX_OPEN_POSITIONS - positions.length;
    let openedCount = 0;

    for (const opportunity of opportunities) {
      if (openedCount >= availableSlots) break;
      
      const opportunityKey = `${opportunity.symbol}-${opportunity.strategy}`;
      
      if (!processedOpportunities.current.has(opportunityKey)) {
        openPosition(opportunity, skipConfirmation);
        processedOpportunities.current.add(opportunityKey);
        openedCount++;
        
        setTimeout(() => {
          processedOpportunities.current.delete(opportunityKey);
        }, 60000);
      }
    }
  }, [positions.length, openPosition]);

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
    setVirtualBalance(initialBalance);
    addLogEntry(`[افتراضي] تم إعادة ضبط المحفظة إلى ${initialBalance} USDT`, 'info');
  }, [initialBalance, addLogEntry]);

  return {
    virtualBalance,
    positions,
    closedTrades,
    performanceStats,
    pendingOpportunities,
    processOpportunities,
    manualClosePosition,
    confirmPendingOpportunity,
    dismissPendingOpportunity,
    hardReset,
    openPositionsCount: positions.length,
    openPositionsValue,
    totalPortfolioValue,
  };
};
