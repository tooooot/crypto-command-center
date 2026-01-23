import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { CoinData } from './useBinanceData';
import { StrategyResult } from './useStrategies';
import { Position, ClosedTrade, PerformanceStats, PendingOpportunity } from './usePaperTrading';
import { StrategyType } from '@/components/dashboard/BalanceCard';

const VIRTUAL_TRADE_AMOUNT = 100; // 100 USDT per trade in virtual mode
const DEFAULT_TRAILING_STOP_PERCENT = 1;
const FEE_PERCENT = 0.1;
const MAX_OPEN_POSITIONS = 5; // Per strategy
const PROFIT_LOCK_THRESHOLD = 3;
const PROFIT_LOCK_LEVEL = 2;
const STRATEGY_INITIAL_BALANCE = 5000; // 5,000 USDT per strategy

export interface StrategyEngine {
  balance: number;
  positions: Position[];
  closedTrades: ClosedTrade[];
  pendingOpportunities: PendingOpportunity[];
  performanceStats: PerformanceStats;
  openPositionsValue: number;
  totalPortfolioValue: number;
  processOpportunities: (opportunities: StrategyResult[], skipConfirmation: boolean) => void;
  confirmPendingOpportunity: (id: string) => void;
  dismissPendingOpportunity: (id: string) => void;
  manualClosePosition: (id: string) => void;
  hardReset: () => void;
}

const createStrategyEngine = (
  strategyType: 'breakout' | 'rsiBounce',
  coins: CoinData[],
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
): StrategyEngine => {
  let balance = STRATEGY_INITIAL_BALANCE;
  let positions: Position[] = [];
  let closedTrades: ClosedTrade[] = [];
  let pendingOpportunities: PendingOpportunity[] = [];
  const processedOpportunities = new Set<string>();

  const strategyTag = strategyType === 'breakout' ? '[الاختراق]' : '[الارتداد]';

  const getOpenPositionsValue = () => 
    positions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0);

  const getPerformanceStats = (): PerformanceStats => ({
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
  });

  return {
    get balance() { return balance; },
    get positions() { return positions; },
    get closedTrades() { return closedTrades; },
    get pendingOpportunities() { return pendingOpportunities; },
    get performanceStats() { return getPerformanceStats(); },
    get openPositionsValue() { return getOpenPositionsValue(); },
    get totalPortfolioValue() { return balance + getOpenPositionsValue(); },
    
    processOpportunities: () => {},
    confirmPendingOpportunity: () => {},
    dismissPendingOpportunity: () => {},
    manualClosePosition: () => {},
    hardReset: () => {
      balance = STRATEGY_INITIAL_BALANCE;
      positions = [];
      closedTrades = [];
      pendingOpportunities = [];
      processedOpportunities.clear();
      addLogEntry(`${strategyTag} تم إعادة ضبط المحفظة`, 'info');
    },
  };
};

export const useIsolatedVirtualTrading = (
  coins: CoinData[],
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
) => {
  // Separate state for each strategy
  const [breakoutBalance, setBreakoutBalance] = useState(STRATEGY_INITIAL_BALANCE);
  const [rsiBounceBalance, setRsiBounceBalance] = useState(STRATEGY_INITIAL_BALANCE);
  
  const [breakoutPositions, setBreakoutPositions] = useState<Position[]>([]);
  const [rsiBouncePositions, setRsiBouncePositions] = useState<Position[]>([]);
  
  const [breakoutClosedTrades, setBreakoutClosedTrades] = useState<ClosedTrade[]>([]);
  const [rsiBounceClosedTrades, setRsiBounceClosedTrades] = useState<ClosedTrade[]>([]);
  
  const [breakoutPending, setBreakoutPending] = useState<PendingOpportunity[]>([]);
  const [rsiBoundPending, setRsiBoundPending] = useState<PendingOpportunity[]>([]);
  
  const processedBreakout = useRef<Set<string>>(new Set());
  const processedRsiBounce = useRef<Set<string>>(new Set());

  // Calculate values for Breakout
  const breakoutOpenPositionsValue = useMemo(() => 
    breakoutPositions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0),
    [breakoutPositions]
  );
  const breakoutTotalPortfolio = breakoutBalance + breakoutOpenPositionsValue;

  // Calculate values for RSI Bounce
  const rsiBounceOpenPositionsValue = useMemo(() => 
    rsiBouncePositions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0),
    [rsiBouncePositions]
  );
  const rsiBoundTotalPortfolio = rsiBounceBalance + rsiBounceOpenPositionsValue;

  // Performance stats for Breakout
  const breakoutStats: PerformanceStats = useMemo(() => ({
    totalPnL: breakoutClosedTrades.reduce((sum, trade) => sum + trade.pnlAmount, 0),
    totalPnLPercent: breakoutClosedTrades.length > 0 
      ? breakoutClosedTrades.reduce((sum, trade) => sum + trade.pnlPercent, 0) / breakoutClosedTrades.length 
      : 0,
    winningTrades: breakoutClosedTrades.filter(t => t.isWin).length,
    losingTrades: breakoutClosedTrades.filter(t => !t.isWin).length,
    winRate: breakoutClosedTrades.length > 0 
      ? (breakoutClosedTrades.filter(t => t.isWin).length / breakoutClosedTrades.length) * 100 
      : 0,
    totalTrades: breakoutClosedTrades.length,
  }), [breakoutClosedTrades]);

  // Performance stats for RSI Bounce
  const rsiBounceStats: PerformanceStats = useMemo(() => ({
    totalPnL: rsiBounceClosedTrades.reduce((sum, trade) => sum + trade.pnlAmount, 0),
    totalPnLPercent: rsiBounceClosedTrades.length > 0 
      ? rsiBounceClosedTrades.reduce((sum, trade) => sum + trade.pnlPercent, 0) / rsiBounceClosedTrades.length 
      : 0,
    winningTrades: rsiBounceClosedTrades.filter(t => t.isWin).length,
    losingTrades: rsiBounceClosedTrades.filter(t => !t.isWin).length,
    winRate: rsiBounceClosedTrades.length > 0 
      ? (rsiBounceClosedTrades.filter(t => t.isWin).length / rsiBounceClosedTrades.length) * 100 
      : 0,
    totalTrades: rsiBounceClosedTrades.length,
  }), [rsiBounceClosedTrades]);

  // Combined stats for "all" view
  const combinedStats: PerformanceStats = useMemo(() => {
    const allClosed = [...breakoutClosedTrades, ...rsiBounceClosedTrades];
    return {
      totalPnL: allClosed.reduce((sum, trade) => sum + trade.pnlAmount, 0),
      totalPnLPercent: allClosed.length > 0 
        ? allClosed.reduce((sum, trade) => sum + trade.pnlPercent, 0) / allClosed.length 
        : 0,
      winningTrades: allClosed.filter(t => t.isWin).length,
      losingTrades: allClosed.filter(t => !t.isWin).length,
      winRate: allClosed.length > 0 
        ? (allClosed.filter(t => t.isWin).length / allClosed.length) * 100 
        : 0,
      totalTrades: allClosed.length,
    };
  }, [breakoutClosedTrades, rsiBounceClosedTrades]);

  // Close position helper
  const closeBreakoutPosition = useCallback((position: Position, currentPrice: number, reason: string) => {
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

    setBreakoutClosedTrades(prev => [...prev, closedTrade]);
    setBreakoutPositions(prev => prev.filter(p => p.id !== position.id));
    setBreakoutBalance(prev => prev + netValue);

    const pnlSign = pnlAmount >= 0 ? '+' : '';
    addLogEntry(
      `[الاختراق:${reason}] ${position.symbol} | ${pnlSign}${pnlPercent.toFixed(2)}%`,
      isWin ? 'success' : 'error'
    );
  }, [addLogEntry]);

  const closeRsiBouncePosition = useCallback((position: Position, currentPrice: number, reason: string) => {
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

    setRsiBounceClosedTrades(prev => [...prev, closedTrade]);
    setRsiBouncePositions(prev => prev.filter(p => p.id !== position.id));
    setRsiBounceBalance(prev => prev + netValue);

    const pnlSign = pnlAmount >= 0 ? '+' : '';
    addLogEntry(
      `[الارتداد:${reason}] ${position.symbol} | ${pnlSign}${pnlPercent.toFixed(2)}%`,
      isWin ? 'success' : 'error'
    );
  }, [addLogEntry]);

  // Open position for Breakout
  const openBreakoutPosition = useCallback((opportunity: StrategyResult, skipConfirmation: boolean) => {
    const existingPosition = breakoutPositions.find(p => p.symbol === opportunity.symbol);
    if (existingPosition) return;

    if (breakoutBalance < VIRTUAL_TRADE_AMOUNT) {
      addLogEntry(`[الاختراق] الرصيد غير كافٍ`, 'warning');
      return;
    }

    if (!skipConfirmation) {
      const pendingId = crypto.randomUUID();
      setBreakoutPending(prev => [...prev, {
        id: pendingId,
        opportunity,
        detectedAt: new Date(),
      }]);
      addLogEntry(`[الاختراق:انتظار] ${opportunity.symbol} | $${parseFloat(opportunity.price).toFixed(6)}`, 'warning');
      return;
    }

    const fee = VIRTUAL_TRADE_AMOUNT * (FEE_PERCENT / 100);
    const entryPrice = parseFloat(opportunity.price);
    const quantity = (VIRTUAL_TRADE_AMOUNT - fee) / entryPrice;
    
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

    setBreakoutPositions(prev => [...prev, newPosition]);
    setBreakoutBalance(prev => prev - VIRTUAL_TRADE_AMOUNT);

    addLogEntry(
      `[الاختراق:شراء] ${opportunity.symbol} | $${entryPrice.toFixed(6)}`,
      'success'
    );
  }, [breakoutPositions, breakoutBalance, addLogEntry]);

  // Open position for RSI Bounce
  const openRsiBouncePosition = useCallback((opportunity: StrategyResult, skipConfirmation: boolean) => {
    const existingPosition = rsiBouncePositions.find(p => p.symbol === opportunity.symbol);
    if (existingPosition) return;

    if (rsiBounceBalance < VIRTUAL_TRADE_AMOUNT) {
      addLogEntry(`[الارتداد] الرصيد غير كافٍ`, 'warning');
      return;
    }

    if (!skipConfirmation) {
      const pendingId = crypto.randomUUID();
      setRsiBoundPending(prev => [...prev, {
        id: pendingId,
        opportunity,
        detectedAt: new Date(),
      }]);
      addLogEntry(`[الارتداد:انتظار] ${opportunity.symbol} | $${parseFloat(opportunity.price).toFixed(6)}`, 'warning');
      return;
    }

    const fee = VIRTUAL_TRADE_AMOUNT * (FEE_PERCENT / 100);
    const entryPrice = parseFloat(opportunity.price);
    const quantity = (VIRTUAL_TRADE_AMOUNT - fee) / entryPrice;
    
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

    setRsiBouncePositions(prev => [...prev, newPosition]);
    setRsiBounceBalance(prev => prev - VIRTUAL_TRADE_AMOUNT);

    addLogEntry(
      `[الارتداد:شراء] ${opportunity.symbol} | $${entryPrice.toFixed(6)}`,
      'success'
    );
  }, [rsiBouncePositions, rsiBounceBalance, addLogEntry]);

  // Process opportunities - routes to correct strategy engine
  const processOpportunities = useCallback((
    opportunities: StrategyResult[], 
    skipConfirmation: boolean,
    strategyFilter: StrategyType
  ) => {
    opportunities.forEach(opportunity => {
      const opportunityKey = `${opportunity.symbol}-${opportunity.strategy}`;
      
      // Route based on strategy type
      if (opportunity.strategy === 'breakout') {
        if (strategyFilter !== 'rsiBounce') { // Allow if 'all' or 'breakout'
          if (breakoutPositions.length >= MAX_OPEN_POSITIONS) return;
          if (!processedBreakout.current.has(opportunityKey)) {
            openBreakoutPosition(opportunity, skipConfirmation);
            processedBreakout.current.add(opportunityKey);
            setTimeout(() => processedBreakout.current.delete(opportunityKey), 60000);
          }
        }
      } else if (opportunity.strategy === 'rsi_bounce') {
        if (strategyFilter !== 'breakout') { // Allow if 'all' or 'rsiBounce'
          if (rsiBouncePositions.length >= MAX_OPEN_POSITIONS) return;
          if (!processedRsiBounce.current.has(opportunityKey)) {
            openRsiBouncePosition(opportunity, skipConfirmation);
            processedRsiBounce.current.add(opportunityKey);
            setTimeout(() => processedRsiBounce.current.delete(opportunityKey), 60000);
          }
        }
      }
    });
  }, [breakoutPositions.length, rsiBouncePositions.length, openBreakoutPosition, openRsiBouncePosition]);

  // Update prices and check trailing stops for BOTH strategies
  useEffect(() => {
    if (coins.length === 0) return;

    // Update Breakout positions
    setBreakoutPositions(prevPositions => {
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
        setTimeout(() => closeBreakoutPosition(position, currentPrice, 'وقف_زاحف'), 0);
      });

      return updatedPositions;
    });

    // Update RSI Bounce positions
    setRsiBouncePositions(prevPositions => {
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
        setTimeout(() => closeRsiBouncePosition(position, currentPrice, 'وقف_زاحف'), 0);
      });

      return updatedPositions;
    });
  }, [coins, closeBreakoutPosition, closeRsiBouncePosition]);

  // Confirm pending
  const confirmBreakoutPending = useCallback((pendingId: string) => {
    const pending = breakoutPending.find(p => p.id === pendingId);
    if (!pending) return;
    setBreakoutPending(prev => prev.filter(p => p.id !== pendingId));
    openBreakoutPosition(pending.opportunity, true);
  }, [breakoutPending, openBreakoutPosition]);

  const confirmRsiBoundPending = useCallback((pendingId: string) => {
    const pending = rsiBoundPending.find(p => p.id === pendingId);
    if (!pending) return;
    setRsiBoundPending(prev => prev.filter(p => p.id !== pendingId));
    openRsiBouncePosition(pending.opportunity, true);
  }, [rsiBoundPending, openRsiBouncePosition]);

  // Dismiss pending
  const dismissBreakoutPending = useCallback((pendingId: string) => {
    setBreakoutPending(prev => prev.filter(p => p.id !== pendingId));
  }, []);

  const dismissRsiBoundPending = useCallback((pendingId: string) => {
    setRsiBoundPending(prev => prev.filter(p => p.id !== pendingId));
  }, []);

  // Manual close
  const manualCloseBreakout = useCallback((positionId: string) => {
    const position = breakoutPositions.find(p => p.id === positionId);
    if (position) {
      closeBreakoutPosition(position, position.currentPrice, 'بيع_يدوي');
    }
  }, [breakoutPositions, closeBreakoutPosition]);

  const manualCloseRsiBounce = useCallback((positionId: string) => {
    const position = rsiBouncePositions.find(p => p.id === positionId);
    if (position) {
      closeRsiBouncePosition(position, position.currentPrice, 'بيع_يدوي');
    }
  }, [rsiBouncePositions, closeRsiBouncePosition]);

  // Reset functions
  const resetBreakout = useCallback(() => {
    setBreakoutPositions([]);
    setBreakoutClosedTrades([]);
    setBreakoutPending([]);
    processedBreakout.current.clear();
    setBreakoutBalance(STRATEGY_INITIAL_BALANCE);
    addLogEntry(`[الاختراق] تم إعادة الضبط إلى ${STRATEGY_INITIAL_BALANCE} USDT`, 'info');
  }, [addLogEntry]);

  const resetRsiBounce = useCallback(() => {
    setRsiBouncePositions([]);
    setRsiBounceClosedTrades([]);
    setRsiBoundPending([]);
    processedRsiBounce.current.clear();
    setRsiBounceBalance(STRATEGY_INITIAL_BALANCE);
    addLogEntry(`[الارتداد] تم إعادة الضبط إلى ${STRATEGY_INITIAL_BALANCE} USDT`, 'info');
  }, [addLogEntry]);

  const resetAll = useCallback(() => {
    resetBreakout();
    resetRsiBounce();
    addLogEntry(`[افتراضي] تم إعادة ضبط جميع الاستراتيجيات`, 'info');
  }, [resetBreakout, resetRsiBounce, addLogEntry]);

  // Get data based on selected strategy filter
  const getDataForStrategy = useCallback((strategy: StrategyType) => {
    if (strategy === 'breakout') {
      return {
        balance: breakoutBalance,
        positions: breakoutPositions,
        closedTrades: breakoutClosedTrades,
        pendingOpportunities: breakoutPending,
        performanceStats: breakoutStats,
        openPositionsValue: breakoutOpenPositionsValue,
        totalPortfolioValue: breakoutTotalPortfolio,
        confirmPending: confirmBreakoutPending,
        dismissPending: dismissBreakoutPending,
        manualClose: manualCloseBreakout,
        reset: resetBreakout,
      };
    } else if (strategy === 'rsiBounce') {
      return {
        balance: rsiBounceBalance,
        positions: rsiBouncePositions,
        closedTrades: rsiBounceClosedTrades,
        pendingOpportunities: rsiBoundPending,
        performanceStats: rsiBounceStats,
        openPositionsValue: rsiBounceOpenPositionsValue,
        totalPortfolioValue: rsiBoundTotalPortfolio,
        confirmPending: confirmRsiBoundPending,
        dismissPending: dismissRsiBoundPending,
        manualClose: manualCloseRsiBounce,
        reset: resetRsiBounce,
      };
    } else {
      // Combined view
      return {
        balance: breakoutBalance + rsiBounceBalance,
        positions: [...breakoutPositions, ...rsiBouncePositions],
        closedTrades: [...breakoutClosedTrades, ...rsiBounceClosedTrades],
        pendingOpportunities: [...breakoutPending, ...rsiBoundPending],
        performanceStats: combinedStats,
        openPositionsValue: breakoutOpenPositionsValue + rsiBounceOpenPositionsValue,
        totalPortfolioValue: breakoutTotalPortfolio + rsiBoundTotalPortfolio,
        confirmPending: (id: string) => {
          confirmBreakoutPending(id);
          confirmRsiBoundPending(id);
        },
        dismissPending: (id: string) => {
          dismissBreakoutPending(id);
          dismissRsiBoundPending(id);
        },
        manualClose: (id: string) => {
          manualCloseBreakout(id);
          manualCloseRsiBounce(id);
        },
        reset: resetAll,
      };
    }
  }, [
    breakoutBalance, breakoutPositions, breakoutClosedTrades, breakoutPending, breakoutStats,
    breakoutOpenPositionsValue, breakoutTotalPortfolio,
    rsiBounceBalance, rsiBouncePositions, rsiBounceClosedTrades, rsiBoundPending, rsiBounceStats,
    rsiBounceOpenPositionsValue, rsiBoundTotalPortfolio,
    combinedStats,
    confirmBreakoutPending, confirmRsiBoundPending,
    dismissBreakoutPending, dismissRsiBoundPending,
    manualCloseBreakout, manualCloseRsiBounce,
    resetBreakout, resetRsiBounce, resetAll,
  ]);

  return {
    processOpportunities,
    getDataForStrategy,
    resetAll,
    // Individual strategy data
    breakout: {
      balance: breakoutBalance,
      positions: breakoutPositions,
      closedTrades: breakoutClosedTrades,
      pending: breakoutPending,
      stats: breakoutStats,
      openPositionsValue: breakoutOpenPositionsValue,
      totalPortfolio: breakoutTotalPortfolio,
    },
    rsiBounce: {
      balance: rsiBounceBalance,
      positions: rsiBouncePositions,
      closedTrades: rsiBounceClosedTrades,
      pending: rsiBoundPending,
      stats: rsiBounceStats,
      openPositionsValue: rsiBounceOpenPositionsValue,
      totalPortfolio: rsiBoundTotalPortfolio,
    },
  };
};
