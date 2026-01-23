import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { CoinData } from './useBinanceData';
import { StrategyResult, StrategyId } from './useStrategies';
import { Position, ClosedTrade, PerformanceStats, PendingOpportunity } from './usePaperTrading';
import { StrategyType } from '@/components/dashboard/BalanceCard';

const VIRTUAL_TRADE_AMOUNT = 100; // 100 USDT per trade in virtual mode
const DEFAULT_TRAILING_STOP_PERCENT = 1;
const FEE_PERCENT = 0.1;
const MAX_OPEN_POSITIONS = 5; // Per strategy
const PROFIT_LOCK_THRESHOLD = 3;
const PROFIT_LOCK_LEVEL = 2;

// Core strategies get 5,000 USDT each (الكنز)
const CORE_STRATEGY_BALANCE = 5000;
// Experimental strategies share remaining budget
const EXPERIMENTAL_STRATEGY_BALANCE = 2500;

// Strategy configurations
interface StrategyConfig {
  id: StrategyId;
  label: string;
  tag: string;
  initialBalance: number;
  isExperimental: boolean;
}

const STRATEGY_CONFIGS: Record<StrategyId, StrategyConfig> = {
  breakout: { id: 'breakout', label: 'الاختراق', tag: '[الاختراق]', initialBalance: CORE_STRATEGY_BALANCE, isExperimental: false },
  rsi_bounce: { id: 'rsi_bounce', label: 'الارتداد', tag: '[الارتداد]', initialBalance: CORE_STRATEGY_BALANCE, isExperimental: false },
  institutional: { id: 'institutional', label: 'المؤسسي', tag: '[المؤسسي]', initialBalance: EXPERIMENTAL_STRATEGY_BALANCE, isExperimental: true },
  crossover: { id: 'crossover', label: 'التقاطعات', tag: '[التقاطعات]', initialBalance: EXPERIMENTAL_STRATEGY_BALANCE, isExperimental: true },
};

// Map StrategyType to StrategyId
const strategyTypeToId = (type: StrategyType): StrategyId | null => {
  if (type === 'breakout') return 'breakout';
  if (type === 'rsiBounce') return 'rsi_bounce';
  if (type === 'institutional') return 'institutional';
  if (type === 'crossover') return 'crossover';
  return null;
};

// Map StrategyId to StrategyType
const strategyIdToType = (id: StrategyId): StrategyType => {
  if (id === 'rsi_bounce') return 'rsiBounce';
  return id as StrategyType;
};

interface StrategyState {
  balance: number;
  positions: Position[];
  closedTrades: ClosedTrade[];
  pendingOpportunities: PendingOpportunity[];
  processedKeys: Set<string>;
}

const createInitialState = (config: StrategyConfig): StrategyState => ({
  balance: config.initialBalance,
  positions: [],
  closedTrades: [],
  pendingOpportunities: [],
  processedKeys: new Set(),
});

export const useIsolatedVirtualTrading = (
  coins: CoinData[],
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
) => {
  // Separate state for each strategy
  const [breakoutState, setBreakoutState] = useState<Omit<StrategyState, 'processedKeys'>>(() => ({
    balance: CORE_STRATEGY_BALANCE,
    positions: [],
    closedTrades: [],
    pendingOpportunities: [],
  }));
  
  const [rsiBounceState, setRsiBounceState] = useState<Omit<StrategyState, 'processedKeys'>>(() => ({
    balance: CORE_STRATEGY_BALANCE,
    positions: [],
    closedTrades: [],
    pendingOpportunities: [],
  }));
  
  const [institutionalState, setInstitutionalState] = useState<Omit<StrategyState, 'processedKeys'>>(() => ({
    balance: EXPERIMENTAL_STRATEGY_BALANCE,
    positions: [],
    closedTrades: [],
    pendingOpportunities: [],
  }));
  
  const [crossoverState, setCrossoverState] = useState<Omit<StrategyState, 'processedKeys'>>(() => ({
    balance: EXPERIMENTAL_STRATEGY_BALANCE,
    positions: [],
    closedTrades: [],
    pendingOpportunities: [],
  }));

  // Processed keys refs
  const processedBreakout = useRef<Set<string>>(new Set());
  const processedRsiBounce = useRef<Set<string>>(new Set());
  const processedInstitutional = useRef<Set<string>>(new Set());
  const processedCrossover = useRef<Set<string>>(new Set());

  // Helper to get state and setter by strategy ID
  const getStrategyStateAndSetter = (strategyId: StrategyId) => {
    switch (strategyId) {
      case 'breakout':
        return { state: breakoutState, setState: setBreakoutState, processed: processedBreakout, config: STRATEGY_CONFIGS.breakout };
      case 'rsi_bounce':
        return { state: rsiBounceState, setState: setRsiBounceState, processed: processedRsiBounce, config: STRATEGY_CONFIGS.rsi_bounce };
      case 'institutional':
        return { state: institutionalState, setState: setInstitutionalState, processed: processedInstitutional, config: STRATEGY_CONFIGS.institutional };
      case 'crossover':
        return { state: crossoverState, setState: setCrossoverState, processed: processedCrossover, config: STRATEGY_CONFIGS.crossover };
    }
  };

  // Calculate performance stats for a strategy
  const calculateStats = (closedTrades: ClosedTrade[]): PerformanceStats => ({
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

  // Calculate open positions value
  const calculateOpenValue = (positions: Position[]) =>
    positions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0);

  // Memoized stats for each strategy
  const breakoutStats = useMemo(() => calculateStats(breakoutState.closedTrades), [breakoutState.closedTrades]);
  const rsiBounceStats = useMemo(() => calculateStats(rsiBounceState.closedTrades), [rsiBounceState.closedTrades]);
  const institutionalStats = useMemo(() => calculateStats(institutionalState.closedTrades), [institutionalState.closedTrades]);
  const crossoverStats = useMemo(() => calculateStats(crossoverState.closedTrades), [crossoverState.closedTrades]);

  // Open positions values
  const breakoutOpenValue = useMemo(() => calculateOpenValue(breakoutState.positions), [breakoutState.positions]);
  const rsiBounceOpenValue = useMemo(() => calculateOpenValue(rsiBounceState.positions), [rsiBounceState.positions]);
  const institutionalOpenValue = useMemo(() => calculateOpenValue(institutionalState.positions), [institutionalState.positions]);
  const crossoverOpenValue = useMemo(() => calculateOpenValue(crossoverState.positions), [crossoverState.positions]);

  // Close position helper
  const closePosition = useCallback((
    position: Position,
    currentPrice: number,
    reason: string,
    strategyId: StrategyId
  ) => {
    const { setState, config } = getStrategyStateAndSetter(strategyId);
    
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

    setState(prev => ({
      ...prev,
      closedTrades: [...prev.closedTrades, closedTrade],
      positions: prev.positions.filter(p => p.id !== position.id),
      balance: prev.balance + netValue,
    }));

    const pnlSign = pnlAmount >= 0 ? '+' : '';
    const experimentalTag = config.isExperimental ? ':تجريبي' : '';
    addLogEntry(
      `${config.tag}${experimentalTag}:${reason}] ${position.symbol} | ${pnlSign}${pnlPercent.toFixed(2)}%`,
      isWin ? 'success' : 'error'
    );
  }, [addLogEntry]);

  // Open position helper
  const openPosition = useCallback((
    opportunity: StrategyResult,
    skipConfirmation: boolean,
    strategyId: StrategyId
  ) => {
    const { state, setState, processed, config } = getStrategyStateAndSetter(strategyId);
    
    const existingPosition = state.positions.find(p => p.symbol === opportunity.symbol);
    if (existingPosition) return;

    if (state.balance < VIRTUAL_TRADE_AMOUNT) {
      addLogEntry(`${config.tag} الرصيد غير كافٍ`, 'warning');
      return;
    }

    if (!skipConfirmation) {
      const pendingId = crypto.randomUUID();
      setState(prev => ({
        ...prev,
        pendingOpportunities: [...prev.pendingOpportunities, {
          id: pendingId,
          opportunity,
          detectedAt: new Date(),
        }],
      }));
      const experimentalTag = config.isExperimental ? ':تجريبي' : '';
      addLogEntry(`${config.tag}${experimentalTag}:انتظار] ${opportunity.symbol} | $${parseFloat(opportunity.price).toFixed(6)}`, 'warning');
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

    setState(prev => ({
      ...prev,
      positions: [...prev.positions, newPosition],
      balance: prev.balance - VIRTUAL_TRADE_AMOUNT,
    }));

    const experimentalTag = config.isExperimental ? ':تجريبي' : '';
    addLogEntry(
      `${config.tag}${experimentalTag}:شراء] ${opportunity.symbol} | $${entryPrice.toFixed(6)}`,
      'success'
    );
  }, [breakoutState, rsiBounceState, institutionalState, crossoverState, addLogEntry]);

  // Process opportunities - routes to correct strategy engine
  const processOpportunities = useCallback((
    opportunities: StrategyResult[], 
    skipConfirmation: boolean,
    strategyFilter: StrategyType
  ) => {
    opportunities.forEach(opportunity => {
      const strategyId = opportunity.strategy;
      const { state, processed, config } = getStrategyStateAndSetter(strategyId);
      
      // Check if this strategy matches the filter
      const filterMatch = strategyFilter === 'all' || 
        (strategyFilter === 'breakout' && strategyId === 'breakout') ||
        (strategyFilter === 'rsiBounce' && strategyId === 'rsi_bounce') ||
        (strategyFilter === 'institutional' && strategyId === 'institutional') ||
        (strategyFilter === 'crossover' && strategyId === 'crossover');
      
      if (!filterMatch) return;
      
      const opportunityKey = `${opportunity.symbol}-${strategyId}`;
      
      if (state.positions.length >= MAX_OPEN_POSITIONS) return;
      if (processed.current.has(opportunityKey)) return;
      
      openPosition(opportunity, skipConfirmation, strategyId);
      processed.current.add(opportunityKey);
      setTimeout(() => processed.current.delete(opportunityKey), 60000);
    });
  }, [openPosition]);

  // Update prices and check trailing stops for ALL strategies
  useEffect(() => {
    if (coins.length === 0) return;

    const updatePositions = (
      strategyId: StrategyId,
      setState: React.Dispatch<React.SetStateAction<Omit<StrategyState, 'processedKeys'>>>
    ) => {
      setState(prevState => {
        const updatedPositions: Position[] = [];
        const positionsToClose: { position: Position; currentPrice: number }[] = [];

        prevState.positions.forEach(position => {
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
          setTimeout(() => closePosition(position, currentPrice, 'وقف_زاحف', strategyId), 0);
        });

        return { ...prevState, positions: updatedPositions };
      });
    };

    updatePositions('breakout', setBreakoutState);
    updatePositions('rsi_bounce', setRsiBounceState);
    updatePositions('institutional', setInstitutionalState);
    updatePositions('crossover', setCrossoverState);
  }, [coins, closePosition]);

  // Confirm pending
  const confirmPending = useCallback((pendingId: string, strategyId: StrategyId) => {
    const { state, setState } = getStrategyStateAndSetter(strategyId);
    const pending = state.pendingOpportunities.find(p => p.id === pendingId);
    if (!pending) return;
    
    setState(prev => ({
      ...prev,
      pendingOpportunities: prev.pendingOpportunities.filter(p => p.id !== pendingId),
    }));
    openPosition(pending.opportunity, true, strategyId);
  }, [openPosition]);

  // Dismiss pending
  const dismissPending = useCallback((pendingId: string, strategyId: StrategyId) => {
    const { setState } = getStrategyStateAndSetter(strategyId);
    setState(prev => ({
      ...prev,
      pendingOpportunities: prev.pendingOpportunities.filter(p => p.id !== pendingId),
    }));
  }, []);

  // Manual close
  const manualClose = useCallback((positionId: string, strategyId: StrategyId) => {
    const { state } = getStrategyStateAndSetter(strategyId);
    const position = state.positions.find(p => p.id === positionId);
    if (position) {
      closePosition(position, position.currentPrice, 'بيع_يدوي', strategyId);
    }
  }, [closePosition]);

  // Reset functions
  const resetStrategy = useCallback((strategyId: StrategyId) => {
    const { setState, processed, config } = getStrategyStateAndSetter(strategyId);
    setState({
      balance: config.initialBalance,
      positions: [],
      closedTrades: [],
      pendingOpportunities: [],
    });
    processed.current.clear();
    addLogEntry(`${config.tag} تم إعادة الضبط إلى ${config.initialBalance} USDT`, 'info');
  }, [addLogEntry]);

  const resetAll = useCallback(() => {
    resetStrategy('breakout');
    resetStrategy('rsi_bounce');
    resetStrategy('institutional');
    resetStrategy('crossover');
    addLogEntry(`[افتراضي] تم إعادة ضبط جميع الاستراتيجيات`, 'info');
  }, [resetStrategy, addLogEntry]);

  // Get data based on selected strategy filter
  const getDataForStrategy = useCallback((strategy: StrategyType) => {
    const strategyId = strategyTypeToId(strategy);
    
    if (strategyId) {
      const { state, config } = getStrategyStateAndSetter(strategyId);
      const stats = strategyId === 'breakout' ? breakoutStats :
                    strategyId === 'rsi_bounce' ? rsiBounceStats :
                    strategyId === 'institutional' ? institutionalStats : crossoverStats;
      const openValue = strategyId === 'breakout' ? breakoutOpenValue :
                        strategyId === 'rsi_bounce' ? rsiBounceOpenValue :
                        strategyId === 'institutional' ? institutionalOpenValue : crossoverOpenValue;

      return {
        balance: state.balance,
        positions: state.positions,
        closedTrades: state.closedTrades,
        pendingOpportunities: state.pendingOpportunities,
        performanceStats: stats,
        openPositionsValue: openValue,
        totalPortfolioValue: state.balance + openValue,
        confirmPending: (id: string) => confirmPending(id, strategyId),
        dismissPending: (id: string) => dismissPending(id, strategyId),
        manualClose: (id: string) => manualClose(id, strategyId),
        reset: () => resetStrategy(strategyId),
        isExperimental: config.isExperimental,
        label: config.label,
        initialBalance: config.initialBalance,
      };
    }
    
    // Combined view (all strategies)
    const allPositions = [...breakoutState.positions, ...rsiBounceState.positions, ...institutionalState.positions, ...crossoverState.positions];
    const allClosedTrades = [...breakoutState.closedTrades, ...rsiBounceState.closedTrades, ...institutionalState.closedTrades, ...crossoverState.closedTrades];
    const allPending = [...breakoutState.pendingOpportunities, ...rsiBounceState.pendingOpportunities, ...institutionalState.pendingOpportunities, ...crossoverState.pendingOpportunities];
    const totalBalance = breakoutState.balance + rsiBounceState.balance + institutionalState.balance + crossoverState.balance;
    const totalOpenValue = breakoutOpenValue + rsiBounceOpenValue + institutionalOpenValue + crossoverOpenValue;
    const combinedStats = calculateStats(allClosedTrades);

    return {
      balance: totalBalance,
      positions: allPositions,
      closedTrades: allClosedTrades,
      pendingOpportunities: allPending,
      performanceStats: combinedStats,
      openPositionsValue: totalOpenValue,
      totalPortfolioValue: totalBalance + totalOpenValue,
      confirmPending: (id: string) => {
        confirmPending(id, 'breakout');
        confirmPending(id, 'rsi_bounce');
        confirmPending(id, 'institutional');
        confirmPending(id, 'crossover');
      },
      dismissPending: (id: string) => {
        dismissPending(id, 'breakout');
        dismissPending(id, 'rsi_bounce');
        dismissPending(id, 'institutional');
        dismissPending(id, 'crossover');
      },
      manualClose: (id: string) => {
        manualClose(id, 'breakout');
        manualClose(id, 'rsi_bounce');
        manualClose(id, 'institutional');
        manualClose(id, 'crossover');
      },
      reset: resetAll,
      isExperimental: false,
      label: 'الكل',
      initialBalance: CORE_STRATEGY_BALANCE * 2 + EXPERIMENTAL_STRATEGY_BALANCE * 2,
    };
  }, [
    breakoutState, rsiBounceState, institutionalState, crossoverState,
    breakoutStats, rsiBounceStats, institutionalStats, crossoverStats,
    breakoutOpenValue, rsiBounceOpenValue, institutionalOpenValue, crossoverOpenValue,
    confirmPending, dismissPending, manualClose, resetStrategy, resetAll,
  ]);

  return {
    processOpportunities,
    getDataForStrategy,
    resetAll,
    // Individual strategy data
    breakout: {
      balance: breakoutState.balance,
      positions: breakoutState.positions,
      closedTrades: breakoutState.closedTrades,
      pending: breakoutState.pendingOpportunities,
      stats: breakoutStats,
      openPositionsValue: breakoutOpenValue,
      totalPortfolio: breakoutState.balance + breakoutOpenValue,
    },
    rsiBounce: {
      balance: rsiBounceState.balance,
      positions: rsiBounceState.positions,
      closedTrades: rsiBounceState.closedTrades,
      pending: rsiBounceState.pendingOpportunities,
      stats: rsiBounceStats,
      openPositionsValue: rsiBounceOpenValue,
      totalPortfolio: rsiBounceState.balance + rsiBounceOpenValue,
    },
    institutional: {
      balance: institutionalState.balance,
      positions: institutionalState.positions,
      closedTrades: institutionalState.closedTrades,
      pending: institutionalState.pendingOpportunities,
      stats: institutionalStats,
      openPositionsValue: institutionalOpenValue,
      totalPortfolio: institutionalState.balance + institutionalOpenValue,
    },
    crossover: {
      balance: crossoverState.balance,
      positions: crossoverState.positions,
      closedTrades: crossoverState.closedTrades,
      pending: crossoverState.pendingOpportunities,
      stats: crossoverStats,
      openPositionsValue: crossoverOpenValue,
      totalPortfolio: crossoverState.balance + crossoverOpenValue,
    },
  };
};
