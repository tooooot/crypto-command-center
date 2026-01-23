import { useState, useCallback, useEffect, useRef } from 'react';
import { CoinData } from './useBinanceData';
import { StrategyResult } from './useStrategies';
import { playProfitSound } from '@/lib/sounds';
import { SYSTEM_VERSION } from '@/lib/version';

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
  trailingStopPercent: number;
  strategy: string;
  strategyName: string;
  entryReason: string;
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
  sellOrderId?: number;
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

// ═══════════════════════════════════════════════════════════════════════════
// v2.4-LIVE-ONLY: PERMANENT LIVE TRADING - NO PAPER/VIRTUAL MODE
// ═══════════════════════════════════════════════════════════════════════════
const TRADE_PERCENT = 40; // 40% of available balance per trade
const MIN_TRADE_AMOUNT = 10; // Binance minimum: 10 USDT
const RESERVED_BALANCE = 5; // Reserve 5 USDT for fees
const DEFAULT_TRAILING_STOP_PERCENT = 1;
const FEE_PERCENT = 0.1;
const SLIPPAGE_PERCENT = 0.2; // 0.2% slippage tolerance for market orders
const MAX_OPEN_POSITIONS = 10;
const PROFIT_LOCK_THRESHOLD = 3;
const PROFIT_LOCK_LEVEL = 2;
const UNIVERSAL_AUTO_BUY_THRESHOLD = 60; // Any score >= 60 = instant buy
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_INTERVAL = 3000;
const API_TIMEOUT = 3000;

// Binance Mainnet API - ONLY REAL TRADING
const SUPABASE_URL = 'https://lpwhiqtclpiuozxdaipc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwd2hpcXRjbHBpdW96eGRhaXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTgyODQsImV4cCI6MjA4NDY3NDI4NH0.qV4dfR1ccUQokIflxyfQpkmfs_R4p5HOUWrCdHitAPs';
const BINANCE_MAINNET_ENDPOINT = `${SUPABASE_URL}/functions/v1/binance-mainnet-trade`;

// Calculate dynamic trade amount based on REAL Binance balance
const calculateTradeAmount = (balance: number): number => {
  const available = balance - RESERVED_BALANCE;
  if (available < MIN_TRADE_AMOUNT) return 0;
  const percentAmount = (available * TRADE_PERCENT) / 100;
  return Math.max(MIN_TRADE_AMOUNT, percentAmount);
};

// Fetch with timeout helper
const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number = API_TIMEOUT): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Fetch REAL balance from Binance Mainnet
export const fetchBinanceBalance = async (): Promise<{ success: boolean; balance: number; latency: number }> => {
  const requestId = Date.now().toString(36).toUpperCase();
  const startTime = performance.now();
  
  console.log(`[${SYSTEM_VERSION}:BALANCE:${requestId}] ════════════════════════════════════`);
  console.log(`[${SYSTEM_VERSION}:BALANCE:${requestId}] FETCHING REAL BINANCE BALANCE`);
  
  try {
    const response = await fetchWithTimeout(BINANCE_MAINNET_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action: 'balance' }),
    });
    
    const elapsed = Math.round(performance.now() - startTime);
    const data = await response.json();
    
    console.log(`[${SYSTEM_VERSION}:BALANCE:${requestId}] Response: ${JSON.stringify(data)}`);
    console.log(`[${SYSTEM_VERSION}:BALANCE:${requestId}] Latency: ${elapsed}ms`);
    console.log(`[${SYSTEM_VERSION}:BALANCE:${requestId}] ════════════════════════════════════`);
    
    if (data.success && typeof data.data?.balance === 'number') {
      return { success: true, balance: data.data.balance, latency: elapsed };
    }
    return { success: false, balance: 0, latency: elapsed };
  } catch (error) {
    const elapsed = Math.round(performance.now() - startTime);
    console.error(`[${SYSTEM_VERSION}:BALANCE:${requestId}] ERROR: ${(error as Error).message}`);
    return { success: false, balance: 0, latency: elapsed };
  }
};

// Check Binance Mainnet health and get balance
const checkMainnetHealth = async (): Promise<{ online: boolean; latency: number; balance?: number }> => {
  const result = await fetchBinanceBalance();
  return { 
    online: result.success, 
    latency: result.latency, 
    balance: result.balance 
  };
};

// Send trade directly to Binance Mainnet via Edge Function
// CRITICAL: Only returns success=true when valid orderId is received
const sendTradeToMainnet = async (tradeData: {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
}): Promise<{ success: boolean; orderId?: number; error?: string; latency: number }> => {
  const requestId = Date.now().toString(36).toUpperCase();
  const startTime = performance.now();
  
  console.log(`[${SYSTEM_VERSION}:ORDER:${requestId}] ════════════════════════════════════`);
  console.log(`[${SYSTEM_VERSION}:ORDER:${requestId}] BINANCE MAINNET ${tradeData.side} ORDER`);
  console.log(`[${SYSTEM_VERSION}:ORDER:${requestId}] Symbol: ${tradeData.symbol}`);
  console.log(`[${SYSTEM_VERSION}:ORDER:${requestId}] Quantity: ${tradeData.quantity}`);
  console.log(`[${SYSTEM_VERSION}:ORDER:${requestId}] ────────────────────────────────────`);
  
  try {
    const response = await fetchWithTimeout(BINANCE_MAINNET_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ 
        action: 'order',
        symbol: tradeData.symbol,
        side: tradeData.side,
        quantity: tradeData.quantity,
      }),
    });
    
    const elapsed = Math.round(performance.now() - startTime);
    const data = await response.json();
    
    console.log(`[${SYSTEM_VERSION}:ORDER:${requestId}] Response: ${JSON.stringify(data)}`);
    console.log(`[${SYSTEM_VERSION}:ORDER:${requestId}] Latency: ${elapsed}ms`);
    console.log(`[${SYSTEM_VERSION}:ORDER:${requestId}] ════════════════════════════════════`);
    
    // CRITICAL: Only mark as SUCCESS if we receive a valid Binance orderId
    const orderId = data.data?.orderId;
    if (data.success && orderId && typeof orderId === 'number') {
      console.log(`[${SYSTEM_VERSION}:ORDER:${requestId}] ✓ VALID ORDER ID: ${orderId}`);
      return { success: true, orderId, latency: elapsed };
    } else {
      // No valid orderId = NOT a successful trade
      const errorMsg = data.error || data.data?.msg || 'No valid orderId received';
      console.error(`[${SYSTEM_VERSION}:ORDER:${requestId}] ✗ REJECTED: ${errorMsg}`);
      return { success: false, error: errorMsg, latency: elapsed };
    }
    
  } catch (error) {
    const elapsed = Math.round(performance.now() - startTime);
    const isTimeout = (error as Error).name === 'AbortError';
    console.error(`[${SYSTEM_VERSION}:ORDER:${requestId}] ERROR: ${(error as Error).message}`);
    return { success: false, error: isTimeout ? 'Timeout (3s)' : (error as Error).message, latency: elapsed };
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

  // Execute a buy order via Binance Mainnet - ONLY SUCCESS WITH VALID ORDER ID
  const executeBuyOrder = useCallback(async (opportunity: StrategyResult, tradeAmount: number): Promise<{ success: boolean; orderId?: number }> => {
    addLogEntry(`[${SYSTEM_VERSION}:MAINNET] جاري التحقق من الاتصال بـ Binance...`, 'info');
    const health = await checkMainnetHealth();
    
    if (!health.online) {
      addLogEntry(`[${SYSTEM_VERSION}:MAINNET] ✗ الاتصال غير متاح (${health.latency}ms)`, 'error');
      return { success: false };
    }
    
    // Sync balance from Binance
    if (health.balance !== undefined) {
      setVirtualBalance(health.balance);
      addLogEntry(`[${SYSTEM_VERSION}:MAINNET] ✓ الرصيد الحقيقي: ${health.balance.toFixed(2)} USDT (${health.latency}ms)`, 'info');
    }
    
    const entryPrice = parseFloat(opportunity.price);
    const priceWithSlippage = entryPrice * (1 + SLIPPAGE_PERCENT / 100);
    const fee = tradeAmount * (FEE_PERCENT / 100);
    const quantity = (tradeAmount - fee) / priceWithSlippage;

    addLogEntry(`[${SYSTEM_VERSION}:BUY] ${opportunity.symbol} | سعر: $${entryPrice.toFixed(6)} | كمية: ${quantity.toFixed(4)} | مبلغ: ${tradeAmount.toFixed(2)} USDT`, 'info');
    
    const result = await sendTradeToMainnet({
      symbol: opportunity.symbol,
      side: 'BUY',
      quantity: quantity.toFixed(6),
    });

    // CRITICAL: Only SUCCESS if we have valid orderId
    if (result.success && result.orderId) {
      addLogEntry(
        `[${SYSTEM_VERSION}:SUCCESS] ✓ تم تنفيذ الشراء | Order ID: ${result.orderId} (${result.latency}ms)`,
        'success'
      );
      return { success: true, orderId: result.orderId };
    } else {
      addLogEntry(`[${SYSTEM_VERSION}:REJECTED] ✗ ${result.error || 'لم يتم استلام Order ID صالح'}`, 'error');
      return { success: false };
    }
  }, [addLogEntry, setVirtualBalance]);

  // Reserved amount tracking for pending trades
  const [reservedLiquidity, setReservedLiquidity] = useState(0);

  // Execute with auto-retry logic - LIVE ONLY (syncs balance from Binance)
  const executeWithRetry = useCallback(async (
    opportunity: StrategyResult,
    pendingId?: string,
    currentRetry: number = 0
  ): Promise<{ success: boolean; tradeAmount: number; orderId?: number }> => {
    // Calculate dynamic trade amount from REAL balance
    const tradeAmount = calculateTradeAmount(virtualBalance);
    
    if (tradeAmount <= 0) {
      addLogEntry(`[${SYSTEM_VERSION}:رفض] الرصيد غير كافٍ (${virtualBalance.toFixed(2)} USDT) - الحد الأدنى: ${MIN_TRADE_AMOUNT} USDT`, 'error');
      return { success: false, tradeAmount: 0 };
    }

    // Reserve liquidity on first attempt
    if (currentRetry === 0) {
      setReservedLiquidity(prev => prev + tradeAmount);
      setVirtualBalance(prev => prev - tradeAmount);
      addLogEntry(`[${SYSTEM_VERSION}:حجز] تم حجز ${tradeAmount.toFixed(2)} USDT لشراء ${opportunity.symbol}`, 'info');
    }

    // Update pending status
    if (pendingId) {
      setPendingOpportunities(prev => prev.map(p => 
        p.id === pendingId 
          ? { ...p, executionStatus: (currentRetry > 0 ? 'retrying' : 'buying') as ExecutionStatus, retryCount: currentRetry, reservedAmount: tradeAmount }
          : p
      ));
    }

    addLogEntry(`[${SYSTEM_VERSION}:تنفيذ${currentRetry > 0 ? `:محاولة ${currentRetry + 1}` : ''}] جاري شراء ${opportunity.symbol} بـ ${tradeAmount.toFixed(2)} USDT...`, 'info');
    
    const result = await executeBuyOrder(opportunity, tradeAmount);
    
    if (result.success && result.orderId) {
      // Trade successful with VALID ORDER ID - keep the deducted amount
      setReservedLiquidity(prev => Math.max(0, prev - tradeAmount));
      
      if (pendingId) {
        setPendingOpportunities(prev => prev.map(p => 
          p.id === pendingId ? { ...p, executionStatus: 'executed' as ExecutionStatus } : p
        ));
        setTimeout(() => {
          setPendingOpportunities(prev => prev.filter(p => p.id !== pendingId));
        }, 3000);
      }
      return { success: true, tradeAmount, orderId: result.orderId };
    }
    
    // Failed - check if we should retry
    if (currentRetry < MAX_RETRY_ATTEMPTS) {
      addLogEntry(`[${SYSTEM_VERSION}:إعادة] فشل شراء ${opportunity.symbol} - إعادة المحاولة خلال 3 ثوانٍ (${currentRetry + 1}/${MAX_RETRY_ATTEMPTS})`, 'warning');
      
      if (pendingId) {
        setPendingOpportunities(prev => prev.map(p => 
          p.id === pendingId ? { ...p, executionStatus: 'retrying' as ExecutionStatus, retryCount: currentRetry + 1 } : p
        ));
      }
      
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
      return executeWithRetry(opportunity, pendingId, currentRetry + 1);
    }
    
    // Final failure - release reserved liquidity
    setReservedLiquidity(prev => Math.max(0, prev - tradeAmount));
    setVirtualBalance(prev => prev + tradeAmount);
    addLogEntry(`[${SYSTEM_VERSION}:تحرير] تم إرجاع ${tradeAmount.toFixed(2)} USDT بعد فشل نهائي`, 'warning');
    
    if (pendingId) {
      setPendingOpportunities(prev => prev.map(p => 
        p.id === pendingId ? { ...p, executionStatus: 'failed' as ExecutionStatus } : p
      ));
    }
    
    return { success: false, tradeAmount: 0 };
  }, [executeBuyOrder, virtualBalance, setVirtualBalance, addLogEntry]);

  // Open a new position - LIVE ONLY
  const openPosition = useCallback(async (opportunity: StrategyResult, skipConfirmation: boolean = false) => {
    const existingPosition = positions.find(p => p.symbol === opportunity.symbol);
    if (existingPosition) return;

    const availableBalance = virtualBalance - RESERVED_BALANCE - reservedLiquidity;
    const estimatedTradeAmount = calculateTradeAmount(availableBalance);
    
    if (estimatedTradeAmount <= 0) {
      addLogEntry(`[${SYSTEM_VERSION}:رفض] الرصيد غير كافٍ (${availableBalance.toFixed(2)} USDT) - الحد الأدنى: ${MIN_TRADE_AMOUNT} USDT`, 'error');
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
        `[${SYSTEM_VERSION}:انتظار] ${opportunity.symbol} | $${parseFloat(opportunity.price).toFixed(6)} | ${estimatedTradeAmount.toFixed(2)} USDT ← اضغط "شراء"`,
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
      reservedAmount: estimatedTradeAmount,
    }]);
    
    const result = await executeWithRetry(opportunity, pendingId);
    if (!result.success || !result.orderId) return;

    const tradeAmount = result.tradeAmount;
    const fee = tradeAmount * (FEE_PERCENT / 100);
    const entryPrice = parseFloat(opportunity.price);
    const quantity = (tradeAmount - fee) / entryPrice;
    
    const trailingStopPercent = opportunity.atr 
      ? Math.max(0.5, Math.min(3, 1 + (opportunity.atr * 0.3))) 
      : DEFAULT_TRAILING_STOP_PERCENT;
    const trailingStopPrice = entryPrice * (1 - trailingStopPercent / 100);

    const newPosition: Position = {
      id: crypto.randomUUID(),
      symbol: opportunity.symbol,
      entryPrice,
      currentPrice: entryPrice,
      binanceOrderId: result.orderId,
      quantity,
      investedAmount: tradeAmount,
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
      `[${SYSTEM_VERSION}:شراء] ✓ ${opportunity.symbol} | Order ID: ${result.orderId} | ${tradeAmount.toFixed(2)} USDT`,
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

  // Close a position via Binance Mainnet - REQUIRES VALID ORDER ID
  const closePosition = useCallback(async (position: Position, currentPrice: number, reason: string) => {
    const exitFee = (position.quantity * currentPrice) * (FEE_PERCENT / 100);
    const grossValue = position.quantity * currentPrice;
    const netValue = grossValue - exitFee;
    const pnlAmount = netValue - position.investedAmount;
    const pnlPercent = (pnlAmount / position.investedAmount) * 100;
    const isWin = pnlAmount > 0;

    addLogEntry(`[${SYSTEM_VERSION}:SELL] جاري إرسال أمر بيع ${position.symbol}...`, 'info');
    
    const result = await sendTradeToMainnet({
      symbol: position.symbol,
      side: 'SELL',
      quantity: position.quantity.toFixed(6),
    });

    // CRITICAL: Only log SUCCESS if we have valid orderId
    if (result.success && result.orderId) {
      addLogEntry(
        `[${SYSTEM_VERSION}:SELL:SUCCESS] ✓ ${position.symbol} | Order ID: ${result.orderId} (${result.latency}ms)`,
        'success'
      );
    } else {
      addLogEntry(`[${SYSTEM_VERSION}:SELL:REJECTED] ✗ ${result.error || 'لم يتم استلام Order ID صالح'}`, 'error');
      // Don't close the position locally if sell failed
      return;
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
      sellOrderId: result.orderId,
    };

    setClosedTrades(prev => [...prev, closedTrade]);
    setPositions(prev => prev.filter(p => p.id !== position.id));
    
    // Sync balance from Binance after selling
    const balanceResult = await fetchBinanceBalance();
    if (balanceResult.success) {
      setVirtualBalance(balanceResult.balance);
      addLogEntry(`[${SYSTEM_VERSION}:SYNC] الرصيد الجديد: ${balanceResult.balance.toFixed(2)} USDT`, 'info');
    }

    const pnlSign = pnlAmount >= 0 ? '+' : '';
    const logType = isWin ? 'success' : 'error';
    
    if (isWin) {
      playProfitSound();
    }
    
    addLogEntry(
      `[${reason}] ${position.symbol} | ${pnlSign}${pnlPercent.toFixed(2)}% (${pnlSign}$${pnlAmount.toFixed(4)})`,
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

  // v2.4-LIVE-ONLY: Process opportunities - AUTO-EXECUTE when score >= 60
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
        const opportunityScore = opportunity.score || 0;
        const shouldAutoExecute = opportunityScore >= UNIVERSAL_AUTO_BUY_THRESHOLD;
        const estimatedAmount = calculateTradeAmount(virtualBalance);
        
        if (shouldAutoExecute && estimatedAmount > 0) {
          addLogEntry(`[${SYSTEM_VERSION}:تنفيذ_فوري] ${opportunity.symbol} | تقييم: ${opportunityScore}/100 ≥ 60 | ${estimatedAmount.toFixed(2)} USDT`, 'success');
        }
        
        openPosition(opportunity, skipConfirmation || shouldAutoExecute);
        processedOpportunities.current.add(opportunityKey);
        openedCount++;
        
        setTimeout(() => {
          processedOpportunities.current.delete(opportunityKey);
        }, 60000);
      }
    }
  }, [positions.length, virtualBalance, openPosition, addLogEntry]);

  // Manual close position
  const manualClosePosition = useCallback((positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (position) {
      closePosition(position, position.currentPrice, 'بيع_يدوي');
    }
  }, [positions, closePosition]);

  // Hard reset - syncs balance from Binance
  const hardReset = useCallback(async (initialBalance: number) => {
    setPositions([]);
    setClosedTrades([]);
    setPendingOpportunities([]);
    processedOpportunities.current.clear();
    
    // Sync REAL balance from Binance
    const result = await fetchBinanceBalance();
    if (result.success) {
      setVirtualBalance(result.balance);
      addLogEntry(`[${SYSTEM_VERSION}:RESET] تم المزامنة مع Binance | الرصيد: ${result.balance.toFixed(2)} USDT`, 'success');
    } else {
      setVirtualBalance(initialBalance);
      addLogEntry(`[${SYSTEM_VERSION}:RESET] فشل المزامنة - استخدام ${initialBalance} USDT`, 'warning');
    }
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
