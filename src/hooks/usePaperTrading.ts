import { useState, useCallback, useEffect, useRef } from 'react';
import { CoinData } from './useBinanceData';
import { StrategyResult } from './useStrategies';
import { playProfitSound } from '@/lib/sounds';

export interface Position {
  id: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  investedAmount: number;
  highestPrice: number;
  trailingStopPrice: number;
  strategy: string;
  strategyName: string;
  openedAt: Date;
  pnlPercent: number;
  pnlAmount: number;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  investedAmount: number;
  pnlPercent: number;
  pnlAmount: number;
  strategy: string;
  openedAt: Date;
  closedAt: Date;
  isWin: boolean;
}

export interface PerformanceStats {
  totalPnL: number;
  totalPnLPercent: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalTrades: number;
}

const TRADE_AMOUNT = 10; // USDT per trade
const TRAILING_STOP_PERCENT = 1; // 1% trailing stop
const FEE_PERCENT = 0.1; // 0.1% fee per transaction
const MIN_BALANCE_FOR_TRADE = 10; // Minimum balance required to open a trade
const MAX_OPEN_POSITIONS = 10; // Maximum concurrent positions
const PROFIT_LOCK_THRESHOLD = 3; // Lock profit when PnL > 3%
const PROFIT_LOCK_LEVEL = 2; // Lock at 2% profit

export const usePaperTrading = (
  virtualBalance: number,
  setVirtualBalance: React.Dispatch<React.SetStateAction<number>>,
  coins: CoinData[],
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
) => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const processedOpportunities = useRef<Set<string>>(new Set());

  // Calculate total value of open positions
  const openPositionsValue = positions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0);
  const totalPortfolioValue = virtualBalance + openPositionsValue;

  // Calculate performance stats
  const performanceStats: PerformanceStats = {
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
  };

  // Open a new position
  const openPosition = useCallback((opportunity: StrategyResult) => {
    // Check if we already have a position for this symbol
    const existingPosition = positions.find(p => p.symbol === opportunity.symbol);
    if (existingPosition) return;

    // Check if we have enough balance (minimum 10 USDT required)
    if (virtualBalance < MIN_BALANCE_FOR_TRADE) {
      addLogEntry(`[رفض_الصفقة] الرصيد غير كافٍ (${virtualBalance.toFixed(2)} USDT) - يجب أن يكون 10 USDT على الأقل`, 'error');
      return;
    }

    const fee = TRADE_AMOUNT * (FEE_PERCENT / 100);
    const totalCost = TRADE_AMOUNT;
    
    // Additional safety check - ensure balance won't go below 0
    if (virtualBalance - totalCost < 0) {
      addLogEntry(`[رفض_الصفقة] الرصيد غير كافٍ لفتح صفقة ${opportunity.symbol}`, 'error');
      return;
    }

    const entryPrice = parseFloat(opportunity.price);
    const quantity = (TRADE_AMOUNT - fee) / entryPrice;
    const trailingStopPrice = entryPrice * (1 - TRAILING_STOP_PERCENT / 100);

    const newPosition: Position = {
      id: crypto.randomUUID(),
      symbol: opportunity.symbol,
      entryPrice,
      currentPrice: entryPrice,
      quantity,
      investedAmount: TRADE_AMOUNT,
      highestPrice: entryPrice,
      trailingStopPrice,
      strategy: opportunity.strategy,
      strategyName: opportunity.strategyName,
      openedAt: new Date(),
      pnlPercent: -FEE_PERCENT, // Start with fee deducted
      pnlAmount: -fee,
    };

    setPositions(prev => [...prev, newPosition]);
    setVirtualBalance(prev => Math.max(0, prev - TRADE_AMOUNT)); // Ensure balance never goes below 0

    addLogEntry(
      `[شراء_افتراضي] العملة: ${opportunity.symbol} | السعر: $${entryPrice.toFixed(6)} | الكمية: ${quantity.toFixed(4)} | الاستراتيجية: ${opportunity.strategyName}`,
      'success'
    );
  }, [positions, virtualBalance, setVirtualBalance, addLogEntry]);

  // Close a position
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
    const logType = isWin ? 'success' : 'error';
    
    // Play profit sound on winning trades
    if (isWin) {
      playProfitSound();
    }
    
    addLogEntry(
      `[${reason}] العملة: ${position.symbol} | السعر: $${currentPrice.toFixed(6)} | الربح/الخسارة: ${pnlSign}${pnlPercent.toFixed(2)}% (${pnlSign}$${pnlAmount.toFixed(4)})`,
      logType
    );
  }, [setVirtualBalance, addLogEntry]);

  // Update positions with current prices and check trailing stops
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

        // Calculate current PnL first
        const exitFee = (position.quantity * currentPrice) * (FEE_PERCENT / 100);
        const grossValue = position.quantity * currentPrice;
        const netValue = grossValue - exitFee;
        const pnlAmount = netValue - position.investedAmount;
        const pnlPercent = (pnlAmount / position.investedAmount) * 100;

        // Update highest price and trailing stop if price made new high
        let stopUpdated = false;
        let profitLocked = false;
        
        if (currentPrice > position.highestPrice) {
          newHighestPrice = currentPrice;
          newTrailingStopPrice = currentPrice * (1 - TRAILING_STOP_PERCENT / 100);
          stopUpdated = true;
        }
        
        // Profit lock: if PnL > 3%, raise stop to lock 2% profit
        if (pnlPercent > PROFIT_LOCK_THRESHOLD) {
          const lockPrice = position.entryPrice * (1 + PROFIT_LOCK_LEVEL / 100);
          if (newTrailingStopPrice < lockPrice) {
            newTrailingStopPrice = lockPrice;
            profitLocked = true;
          }
        }

        // Check if trailing stop is hit
        if (currentPrice <= newTrailingStopPrice) {
          positionsToClose.push({ position, currentPrice });
          return;
        }

        // Log trailing stop update with chaser format
        if (stopUpdated) {
          setTimeout(() => {
            addLogEntry(
              `[مطاردة] العملة: ${position.symbol} | السعر صعد لـ $${newHighestPrice.toFixed(6)} | الوقف ارتفع لـ $${newTrailingStopPrice.toFixed(6)}`,
              'success'
            );
          }, 0);
        }
        
        // Log profit lock
        if (profitLocked) {
          setTimeout(() => {
            addLogEntry(
              `[تأمين_ربح] العملة: ${position.symbol} | الربح ${pnlPercent.toFixed(2)}% > 3% | الوقف ارتفع لتأمين 2%`,
              'warning'
            );
          }, 0);
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

      // Close positions that hit trailing stop (outside of setState)
      positionsToClose.forEach(({ position, currentPrice }) => {
        setTimeout(() => {
          closePosition(position, currentPrice, 'بيع_وقف_زاحف');
        }, 0);
      });

      return updatedPositions;
    });
  }, [coins, closePosition]);

  // Process new opportunities - Smart Entry: max 10 positions (strict enforcement)
  const processOpportunities = useCallback((opportunities: StrategyResult[]) => {
    // Strict enforcement: do NOT open any new positions if at max
    if (positions.length >= MAX_OPEN_POSITIONS) {
      return; // Exit immediately, don't process any opportunities
    }

    const availableSlots = MAX_OPEN_POSITIONS - positions.length;
    let openedCount = 0;

    for (const opportunity of opportunities) {
      // Stop if we've filled all available slots
      if (openedCount >= availableSlots) break;
      
      const opportunityKey = `${opportunity.symbol}-${opportunity.strategy}`;
      
      // Check if already processed recently (within last minute)
      if (!processedOpportunities.current.has(opportunityKey)) {
        openPosition(opportunity);
        processedOpportunities.current.add(opportunityKey);
        openedCount++;
        
        // Clear from processed after 60 seconds
        setTimeout(() => {
          processedOpportunities.current.delete(opportunityKey);
        }, 60000);
      }
    }
  }, [positions.length, openPosition]);

  // Manual close position
  const manualClosePosition = useCallback((positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (position) {
      closePosition(position, position.currentPrice, 'بيع_يدوي');
    }
  }, [positions, closePosition]);

  // Hard reset - clear all positions and restore balance
  const hardReset = useCallback((initialBalance: number) => {
    setPositions([]);
    setClosedTrades([]);
    processedOpportunities.current.clear();
    setVirtualBalance(initialBalance);
    addLogEntry(`[إعادة_ضبط] تم تصفير المحفظة وإعادة الرصيد إلى ${initialBalance} USDT`, 'warning');
  }, [setVirtualBalance, addLogEntry]);

  return {
    positions,
    closedTrades,
    performanceStats,
    processOpportunities,
    manualClosePosition,
    hardReset,
    openPositionsCount: positions.length,
    openPositionsValue,
    totalPortfolioValue,
  };
};
