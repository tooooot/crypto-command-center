import { useState, useCallback, useEffect, useRef } from 'react';
import { CoinData } from './useBinanceData';
import { StrategyResult } from './useStrategies';
import { playProfitSound } from '@/lib/sounds';

export interface Position {
  id: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  binanceOrderId?: number;
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

export interface PendingOpportunity {
  id: string;
  opportunity: StrategyResult;
  detectedAt: Date;
}

export interface PerformanceStats {
  totalPnL: number;
  totalPnLPercent: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalTrades: number;
}

const TRADE_AMOUNT = 10; // 10 USDT minimum per trade
const TRAILING_STOP_PERCENT = 1; // 1% trailing stop
const FEE_PERCENT = 0.1; // 0.1% fee per transaction
const RESERVED_BALANCE = 12; // Reserve 12 USDT from total balance
const MIN_BALANCE_FOR_TRADE = 10; // Minimum 10 USDT
const MAX_OPEN_POSITIONS = 10; // Maximum concurrent positions
const PROFIT_LOCK_THRESHOLD = 3; // Lock profit when PnL > 3%
const PROFIT_LOCK_LEVEL = 2; // Lock at 2% profit

// Trade API Configuration - Direct to Vultr Server
const TRADE_API_URL = 'http://108.61.175.57/api/execute-trade';

const sendTradeToServer = async (tradeData: {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  strategyName: string;
}): Promise<any> => {
  try {
    const response = await fetch(TRADE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(tradeData),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Trade API error:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const usePaperTrading = (
  virtualBalance: number,
  setVirtualBalance: React.Dispatch<React.SetStateAction<number>>,
  coins: CoinData[],
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void,
  isManualConfirmMode: boolean = true // Default: require manual confirmation
) => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [pendingOpportunities, setPendingOpportunities] = useState<PendingOpportunity[]>([]);
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

  // Execute a buy order (called after manual confirmation or automatically)
  const executeBuyOrder = useCallback(async (opportunity: StrategyResult): Promise<boolean> => {
    const entryPrice = parseFloat(opportunity.price);
    const fee = TRADE_AMOUNT * (FEE_PERCENT / 100);
    const quantity = (TRADE_AMOUNT - fee) / entryPrice;

    addLogEntry(`[TRADE_API] جاري إرسال أمر شراء ${opportunity.symbol} إلى السيرفر...`, 'info');
    
    const result = await sendTradeToServer({
      symbol: opportunity.symbol,
      side: 'BUY',
      quantity: quantity.toFixed(6),
      price: opportunity.price,
      strategyName: opportunity.strategyName,
    });

    if (result.success) {
      addLogEntry(
        `[TRADE_API] ✓ تم إرسال أمر الشراء بنجاح | ${JSON.stringify(result.data || result)}`,
        'success'
      );
      return true;
    } else if (result.error?.includes('Invalid symbol')) {
      addLogEntry(`[TRADE_API] ⚠ عملة غير صالحة: ${opportunity.symbol} - تم استبعادها`, 'warning');
      return false;
    } else {
      addLogEntry(`[TRADE_API] ✗ فشل الشراء: ${result.error || 'خطأ غير معروف'}`, 'error');
      return false;
    }
  }, [addLogEntry]);

  // Open a new position (with or without manual confirmation)
  const openPosition = useCallback(async (opportunity: StrategyResult, skipConfirmation: boolean = false) => {
    // Check if we already have a position for this symbol
    const existingPosition = positions.find(p => p.symbol === opportunity.symbol);
    if (existingPosition) return;

    // Check balance (with 12 USDT reserved)
    const availableBalance = virtualBalance - RESERVED_BALANCE;
    if (availableBalance < MIN_BALANCE_FOR_TRADE) {
      addLogEntry(`[رفض_الصفقة] الرصيد المتاح غير كافٍ (${availableBalance.toFixed(2)} USDT) - يجب أن يكون ${MIN_BALANCE_FOR_TRADE} USDT على الأقل (محجوز: ${RESERVED_BALANCE} USDT)`, 'error');
      return;
    }

    // If manual confirmation mode and not skipping, add to pending
    if (isManualConfirmMode && !skipConfirmation) {
      const pendingId = crypto.randomUUID();
      setPendingOpportunities(prev => [...prev, {
        id: pendingId,
        opportunity,
        detectedAt: new Date(),
      }]);
      addLogEntry(
        `[انتظار_تأكيد] العملة: ${opportunity.symbol} | السعر: $${parseFloat(opportunity.price).toFixed(6)} | الاستراتيجية: ${opportunity.strategyName} ← اضغط "شراء الآن"`,
        'warning'
      );
      return;
    }

    // Execute the buy order
    const success = await executeBuyOrder(opportunity);
    if (!success) return;

    const fee = TRADE_AMOUNT * (FEE_PERCENT / 100);
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
      pnlPercent: -FEE_PERCENT,
      pnlAmount: -fee,
    };

    setPositions(prev => [...prev, newPosition]);
    setVirtualBalance(prev => Math.max(0, prev - TRADE_AMOUNT));

    addLogEntry(
      `[شراء] العملة: ${opportunity.symbol} | السعر: $${entryPrice.toFixed(6)} | الكمية: ${quantity.toFixed(4)} | الاستراتيجية: ${opportunity.strategyName}`,
      'success'
    );
  }, [positions, virtualBalance, setVirtualBalance, addLogEntry, isManualConfirmMode, executeBuyOrder]);

  // Confirm and execute a pending opportunity
  const confirmPendingOpportunity = useCallback(async (pendingId: string) => {
    const pending = pendingOpportunities.find(p => p.id === pendingId);
    if (!pending) return;

    // Remove from pending list
    setPendingOpportunities(prev => prev.filter(p => p.id !== pendingId));
    
    // Execute with confirmation bypassed
    await openPosition(pending.opportunity, true);
  }, [pendingOpportunities, openPosition]);

  // Dismiss a pending opportunity
  const dismissPendingOpportunity = useCallback((pendingId: string) => {
    setPendingOpportunities(prev => prev.filter(p => p.id !== pendingId));
    addLogEntry(`[رفض_يدوي] تم تجاهل الفرصة`, 'info');
  }, [addLogEntry]);

  // Close a position
  const closePosition = useCallback(async (position: Position, currentPrice: number, reason: string) => {
    const exitFee = (position.quantity * currentPrice) * (FEE_PERCENT / 100);
    const grossValue = position.quantity * currentPrice;
    const netValue = grossValue - exitFee;
    const pnlAmount = netValue - position.investedAmount;
    const pnlPercent = (pnlAmount / position.investedAmount) * 100;
    const isWin = pnlAmount > 0;

    // Send sell order to Trade API Server
    addLogEntry(`[TRADE_API] جاري إرسال أمر بيع ${position.symbol} إلى السيرفر...`, 'info');
    
    const result = await sendTradeToServer({
      symbol: position.symbol,
      side: 'SELL',
      quantity: position.quantity.toFixed(6),
      price: currentPrice.toString(),
      strategyName: position.strategyName,
    });

    if (result.success) {
      addLogEntry(
        `[TRADE_API] ✓ تم إرسال أمر البيع بنجاح | ${JSON.stringify(result.data || result)}`,
        'success'
      );
    } else if (result.error) {
      addLogEntry(`[TRADE_API] ⚠ خطأ: ${result.error}`, 'warning');
    }

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

        const exitFee = (position.quantity * currentPrice) * (FEE_PERCENT / 100);
        const grossValue = position.quantity * currentPrice;
        const netValue = grossValue - exitFee;
        const pnlAmount = netValue - position.investedAmount;
        const pnlPercent = (pnlAmount / position.investedAmount) * 100;

        let stopUpdated = false;
        let profitLocked = false;
        
        if (currentPrice > position.highestPrice) {
          newHighestPrice = currentPrice;
          newTrailingStopPrice = currentPrice * (1 - TRAILING_STOP_PERCENT / 100);
          stopUpdated = true;
        }
        
        if (pnlPercent > PROFIT_LOCK_THRESHOLD) {
          const lockPrice = position.entryPrice * (1 + PROFIT_LOCK_LEVEL / 100);
          if (newTrailingStopPrice < lockPrice) {
            newTrailingStopPrice = lockPrice;
            profitLocked = true;
          }
        }

        if (currentPrice <= newTrailingStopPrice) {
          positionsToClose.push({ position, currentPrice });
          return;
        }

        if (stopUpdated) {
          setTimeout(() => {
            addLogEntry(
              `[مطاردة] العملة: ${position.symbol} | السعر صعد لـ $${newHighestPrice.toFixed(6)} | الوقف ارتفع لـ $${newTrailingStopPrice.toFixed(6)}`,
              'success'
            );
          }, 0);
        }
        
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

      positionsToClose.forEach(({ position, currentPrice }) => {
        setTimeout(() => {
          closePosition(position, currentPrice, 'بيع_وقف_زاحف');
        }, 0);
      });

      return updatedPositions;
    });
  }, [coins, closePosition]);

  // Process new opportunities
  const processOpportunities = useCallback((opportunities: StrategyResult[]) => {
    if (positions.length >= MAX_OPEN_POSITIONS) {
      return;
    }

    const availableSlots = MAX_OPEN_POSITIONS - positions.length;
    let openedCount = 0;

    for (const opportunity of opportunities) {
      if (openedCount >= availableSlots) break;
      
      const opportunityKey = `${opportunity.symbol}-${opportunity.strategy}`;
      
      if (!processedOpportunities.current.has(opportunityKey)) {
        openPosition(opportunity);
        processedOpportunities.current.add(opportunityKey);
        openedCount++;
        
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

  // Hard reset
  const hardReset = useCallback((initialBalance: number) => {
    setPositions([]);
    setClosedTrades([]);
    setPendingOpportunities([]);
    processedOpportunities.current.clear();
    setVirtualBalance(initialBalance);
    addLogEntry(`[إعادة_ضبط] تم تصفير المحفظة وإعادة الرصيد إلى ${initialBalance} USDT`, 'warning');
  }, [setVirtualBalance, addLogEntry]);

  return {
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
