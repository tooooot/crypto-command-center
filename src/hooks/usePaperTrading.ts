import { useState, useCallback, useEffect, useRef } from 'react';
import { CoinData } from './useBinanceData';
import { StrategyResult } from './useStrategies';
import { playProfitSound } from '@/lib/sounds';

// Execution status for tracking trades
export type ExecutionStatus = 'idle' | 'buying' | 'executed' | 'retrying' | 'failed';

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
  trailingStopPercent: number; // Dynamic trailing stop percentage (ATR-based)
  strategy: string;
  strategyName: string;
  entryReason: string; // سبب الدخول
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
  executionStatus: ExecutionStatus;
  retryCount: number;
  reservedAmount: number;
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
const DEFAULT_TRAILING_STOP_PERCENT = 1; // 1% trailing stop (default)
const FEE_PERCENT = 0.1; // 0.1% fee per transaction
const RESERVED_BALANCE = 12; // Reserve 12 USDT from total balance
const MIN_BALANCE_FOR_TRADE = 10; // Minimum 10 USDT
const MAX_OPEN_POSITIONS = 10; // Maximum concurrent positions
const PROFIT_LOCK_THRESHOLD = 3; // Lock profit when PnL > 3%
const PROFIT_LOCK_LEVEL = 2; // Lock at 2% profit
const RESERVED_PER_TRADE = 500; // Reserve 500 USDT per pending trade
const MAX_RETRY_ATTEMPTS = 6; // Max retry attempts (30 seconds total)
const RETRY_INTERVAL = 5000; // 5 seconds between retries

// Trade API Configuration - Via Edge Function Proxy
const SUPABASE_URL = 'https://lpwhiqtclpiuozxdaipc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwd2hpcXRjbHBpdW96eGRhaXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTgyODQsImV4cCI6MjA4NDY3NDI4NH0.qV4dfR1ccUQokIflxyfQpkmfs_R4p5HOUWrCdHitAPs';
const PROXY_ENDPOINT = `${SUPABASE_URL}/functions/v1/trade-proxy`;

// Server Health Check (Handshake)
const checkServerHealth = async (): Promise<{ online: boolean; latency: number }> => {
  const requestId = Date.now().toString(36).toUpperCase();
  console.log(`[HEALTH:${requestId}] ════════════════════════════════════`);
  console.log(`[HEALTH:${requestId}] HANDSHAKE REQUEST`);
  console.log(`[HEALTH:${requestId}] Time: ${new Date().toISOString()}`);
  console.log(`[HEALTH:${requestId}] Endpoint: ${PROXY_ENDPOINT}`);
  
  const startTime = performance.now();
  
  try {
    const response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action: 'health' }),
    });
    
    const elapsed = Math.round(performance.now() - startTime);
    const data = await response.json();
    
    console.log(`[HEALTH:${requestId}] RESPONSE RECEIVED`);
    console.log(`[HEALTH:${requestId}] Status: ${response.status}`);
    console.log(`[HEALTH:${requestId}] Online: ${data.serverOnline}`);
    console.log(`[HEALTH:${requestId}] Latency: ${elapsed}ms`);
    console.log(`[HEALTH:${requestId}] Data:`, JSON.stringify(data, null, 2));
    console.log(`[HEALTH:${requestId}] ════════════════════════════════════`);
    
    return { 
      online: data.success && data.serverOnline, 
      latency: elapsed
    };
  } catch (error) {
    const elapsed = Math.round(performance.now() - startTime);
    console.error(`[HEALTH:${requestId}] ERROR`);
    console.error(`[HEALTH:${requestId}] Elapsed: ${elapsed}ms`);
    console.error(`[HEALTH:${requestId}] Message: ${(error as Error).message}`);
    console.error(`[HEALTH:${requestId}] ════════════════════════════════════`);
    return { online: false, latency: elapsed };
  }
};

// Send trade via Edge Function Proxy with Detailed Logging
const sendTradeToServer = async (tradeData: {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  strategyName: string;
}): Promise<any> => {
  const requestId = Date.now().toString(36).toUpperCase();
  const startTime = performance.now();
  
  // === REQUEST SENT ===
  console.log(`[TRADE:${requestId}] ════════════════════════════════════`);
  console.log(`[TRADE:${requestId}] REQUEST SENT`);
  console.log(`[TRADE:${requestId}] Time: ${new Date().toISOString()}`);
  console.log(`[TRADE:${requestId}] Endpoint: ${PROXY_ENDPOINT}`);
  console.log(`[TRADE:${requestId}] Payload:`, JSON.stringify(tradeData, null, 2));
  console.log(`[TRADE:${requestId}] ────────────────────────────────────`);
  
  try {
    const response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action: 'trade', ...tradeData }),
    });
    
    const elapsed = Math.round(performance.now() - startTime);
    const data = await response.json();
    
    // === RESPONSE RECEIVED ===
    console.log(`[TRADE:${requestId}] RESPONSE RECEIVED`);
    console.log(`[TRADE:${requestId}] Status Code: ${response.status}`);
    console.log(`[TRADE:${requestId}] Elapsed: ${elapsed}ms`);
    console.log(`[TRADE:${requestId}] Success: ${data.success}`);
    console.log(`[TRADE:${requestId}] Data:`, JSON.stringify(data, null, 2));
    console.log(`[TRADE:${requestId}] ════════════════════════════════════`);
    
    return { ...data, latency: elapsed };
    
  } catch (error) {
    const elapsed = Math.round(performance.now() - startTime);
    
    // === ERROR ===
    console.error(`[TRADE:${requestId}] ERROR DETAILS`);
    console.error(`[TRADE:${requestId}] Elapsed: ${elapsed}ms`);
    console.error(`[TRADE:${requestId}] Message: ${(error as Error).message}`);
    console.error(`[TRADE:${requestId}] Stack: ${(error as Error).stack}`);
    console.error(`[TRADE:${requestId}] ════════════════════════════════════`);
    
    return { success: false, error: (error as Error).message, latency: elapsed };
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

  // Execute a buy order with Handshake
  const executeBuyOrder = useCallback(async (opportunity: StrategyResult): Promise<boolean> => {
    // Step 1: Handshake - Check server health
    addLogEntry(`[HANDSHAKE] جاري التحقق من اتصال السيرفر...`, 'info');
    const health = await checkServerHealth();
    
    if (!health.online) {
      addLogEntry(`[HANDSHAKE] ✗ السيرفر غير متاح! Latency: ${health.latency}ms`, 'error');
      return false;
    }
    
    addLogEntry(`[HANDSHAKE] ✓ السيرفر متصل | Latency: ${health.latency}ms`, 'success');
    
    // Step 2: Execute trade
    const entryPrice = parseFloat(opportunity.price);
    const fee = TRADE_AMOUNT * (FEE_PERCENT / 100);
    const quantity = (TRADE_AMOUNT - fee) / entryPrice;

    addLogEntry(`[TRADE_API] جاري إرسال أمر شراء ${opportunity.symbol}...`, 'info');
    
    const result = await sendTradeToServer({
      symbol: opportunity.symbol,
      side: 'BUY',
      quantity: quantity.toFixed(6),
      price: opportunity.price,
      strategyName: opportunity.strategyName,
    });

    if (result.success) {
      addLogEntry(
        `[TRADE_API] ✓ تم الإرسال بنجاح (${result.latency}ms) | ${JSON.stringify(result.data || {})}`,
        'success'
      );
      return true;
    } else if (result.error?.includes('Invalid symbol')) {
      addLogEntry(`[TRADE_API] ⚠ عملة غير صالحة: ${opportunity.symbol}`, 'warning');
      return false;
    } else {
      addLogEntry(`[TRADE_API] ✗ فشل الشراء: ${result.error || 'خطأ غير معروف'}`, 'error');
      return false;
    }
  }, [addLogEntry]);

  // Reserved amount tracking for pending trades
  const [reservedLiquidity, setReservedLiquidity] = useState(0);

  // Execute with auto-retry logic
  const executeWithRetry = useCallback(async (
    opportunity: StrategyResult,
    pendingId?: string,
    currentRetry: number = 0
  ): Promise<boolean> => {
    // Reserve liquidity on first attempt
    if (currentRetry === 0 && virtualBalance >= RESERVED_PER_TRADE) {
      setReservedLiquidity(prev => prev + RESERVED_PER_TRADE);
      setVirtualBalance(prev => prev - RESERVED_PER_TRADE);
      addLogEntry(`[حجز_سيولة] تم حجز ${RESERVED_PER_TRADE} USDT لشراء ${opportunity.symbol}`, 'info');
    }

    // Update pending status
    if (pendingId) {
      setPendingOpportunities(prev => prev.map(p => 
        p.id === pendingId 
          ? { ...p, executionStatus: (currentRetry > 0 ? 'retrying' : 'buying') as ExecutionStatus, retryCount: currentRetry, reservedAmount: RESERVED_PER_TRADE }
          : p
      ));
    }

    addLogEntry(`[تنفيذ${currentRetry > 0 ? `:محاولة ${currentRetry + 1}` : ''}] جاري شراء ${opportunity.symbol}...`, 'info');
    
    const success = await executeBuyOrder(opportunity);
    
    if (success) {
      // Release reservation and deduct actual trade amount
      setReservedLiquidity(prev => Math.max(0, prev - RESERVED_PER_TRADE));
      setVirtualBalance(prev => prev + RESERVED_PER_TRADE - TRADE_AMOUNT);
      
      if (pendingId) {
        setPendingOpportunities(prev => prev.map(p => 
          p.id === pendingId ? { ...p, executionStatus: 'executed' as ExecutionStatus } : p
        ));
        // Remove after showing executed status briefly
        setTimeout(() => {
          setPendingOpportunities(prev => prev.filter(p => p.id !== pendingId));
        }, 3000);
      }
      return true;
    }
    
    // Failed - check if we should retry
    if (currentRetry < MAX_RETRY_ATTEMPTS) {
      addLogEntry(`[إعادة_محاولة] فشل شراء ${opportunity.symbol} - إعادة المحاولة خلال 5 ثوانٍ (${currentRetry + 1}/${MAX_RETRY_ATTEMPTS})`, 'warning');
      
      if (pendingId) {
        setPendingOpportunities(prev => prev.map(p => 
          p.id === pendingId ? { ...p, executionStatus: 'retrying' as ExecutionStatus, retryCount: currentRetry + 1 } : p
        ));
      }
      
      // Schedule retry
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
      return executeWithRetry(opportunity, pendingId, currentRetry + 1);
    }
    
    // Final failure - release reserved liquidity
    setReservedLiquidity(prev => Math.max(0, prev - RESERVED_PER_TRADE));
    setVirtualBalance(prev => prev + RESERVED_PER_TRADE);
    addLogEntry(`[تحرير_سيولة] تم إرجاع ${RESERVED_PER_TRADE} USDT بعد فشل نهائي لـ ${opportunity.symbol}`, 'warning');
    
    if (pendingId) {
      setPendingOpportunities(prev => prev.map(p => 
        p.id === pendingId ? { ...p, executionStatus: 'failed' as ExecutionStatus } : p
      ));
    }
    
    return false;
  }, [executeBuyOrder, virtualBalance, setVirtualBalance, addLogEntry]);

  // Open a new position (with or without manual confirmation)
  const openPosition = useCallback(async (opportunity: StrategyResult, skipConfirmation: boolean = false) => {
    // Check if we already have a position for this symbol
    const existingPosition = positions.find(p => p.symbol === opportunity.symbol);
    if (existingPosition) return;

    // Check balance (with 12 USDT reserved + reserved liquidity for pending trades)
    const availableBalance = virtualBalance - RESERVED_BALANCE - reservedLiquidity;
    if (availableBalance < MIN_BALANCE_FOR_TRADE) {
      addLogEntry(`[رفض_الصفقة] الرصيد المتاح غير كافٍ (${availableBalance.toFixed(2)} USDT) - محجوز: ${reservedLiquidity.toFixed(0)} USDT`, 'error');
      return;
    }

    // If manual confirmation mode and not skipping, add to pending
    if (isManualConfirmMode && !skipConfirmation) {
      const pendingId = crypto.randomUUID();
      setPendingOpportunities(prev => [...prev, {
        id: pendingId,
        opportunity,
        detectedAt: new Date(),
        executionStatus: 'idle' as ExecutionStatus,
        retryCount: 0,
        reservedAmount: 0,
      }]);
      addLogEntry(
        `[انتظار_تأكيد] العملة: ${opportunity.symbol} | السعر: $${parseFloat(opportunity.price).toFixed(6)} | الاستراتيجية: ${opportunity.strategyName} ← اضغط "شراء الآن"`,
        'warning'
      );
      return;
    }

    // Execute with auto-retry
    const pendingId = crypto.randomUUID();
    setPendingOpportunities(prev => [...prev, {
      id: pendingId,
      opportunity,
      detectedAt: new Date(),
      executionStatus: 'buying' as ExecutionStatus,
      retryCount: 0,
      reservedAmount: RESERVED_PER_TRADE,
    }]);
    
    const success = await executeWithRetry(opportunity, pendingId);
    if (!success) return;

    const fee = TRADE_AMOUNT * (FEE_PERCENT / 100);
    const entryPrice = parseFloat(opportunity.price);
    const quantity = (TRADE_AMOUNT - fee) / entryPrice;
    
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
      investedAmount: TRADE_AMOUNT,
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

    addLogEntry(
      `[شراء] العملة: ${opportunity.symbol} | السعر: $${entryPrice.toFixed(6)} | الكمية: ${quantity.toFixed(4)} | الاستراتيجية: ${opportunity.strategyName}`,
      'success'
    );
  }, [positions, virtualBalance, reservedLiquidity, setVirtualBalance, addLogEntry, isManualConfirmMode, executeWithRetry]);

  // Confirm and execute a pending opportunity with auto-retry
  const confirmPendingOpportunity = useCallback(async (pendingId: string) => {
    const pending = pendingOpportunities.find(p => p.id === pendingId);
    if (!pending) return;
    if (pending.executionStatus === 'buying' || pending.executionStatus === 'retrying') return;

    // Execute with auto-retry, keeping the pending entry for status tracking
    await executeWithRetry(pending.opportunity, pendingId);
  }, [pendingOpportunities, executeWithRetry]);

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

    // Send sell order via Proxy
    addLogEntry(`[TRADE_API] جاري إرسال أمر بيع ${position.symbol}...`, 'info');
    
    const result = await sendTradeToServer({
      symbol: position.symbol,
      side: 'SELL',
      quantity: position.quantity.toFixed(6),
      price: currentPrice.toString(),
      strategyName: position.strategyName,
    });

    if (result.success) {
      addLogEntry(
        `[TRADE_API] ✓ تم إرسال أمر البيع (${result.latency}ms)`,
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
          // Use position's dynamic trailing stop percent
          newTrailingStopPrice = currentPrice * (1 - position.trailingStopPercent / 100);
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

  // Process new opportunities - skipConfirmation bypasses manual confirmation when auto-trading is ON
  const processOpportunities = useCallback((opportunities: StrategyResult[], skipConfirmation: boolean = false) => {
    if (positions.length >= MAX_OPEN_POSITIONS) {
      return;
    }

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
