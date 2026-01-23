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

// v2.2-Live: Dynamic Position Sizing (Percentage-Based)
const TRADE_PERCENT = 40; // 40% of available balance per trade
const MIN_TRADE_AMOUNT = 10; // Binance minimum: 10 USDT
const RESERVED_BALANCE = 5; // Reserve 5 USDT for fees
const DEFAULT_TRAILING_STOP_PERCENT = 1; // 1% trailing stop (default)
const FEE_PERCENT = 0.1; // 0.1% fee per transaction
const SLIPPAGE_PERCENT = 0.2; // 0.2% slippage tolerance for market orders
const MAX_OPEN_POSITIONS = 10; // Maximum concurrent positions
const PROFIT_LOCK_THRESHOLD = 3; // Lock profit when PnL > 3%
const PROFIT_LOCK_LEVEL = 2; // Lock at 2% profit
const UNIVERSAL_AUTO_BUY_THRESHOLD = 60; // v2.2-Live: Any score >= 60 = instant buy
const MAX_RETRY_ATTEMPTS = 3; // Max retry attempts (9 seconds total)
const RETRY_INTERVAL = 3000; // 3 seconds between retries
const API_TIMEOUT = 3000; // 3 second timeout for all API calls

// Binance Mainnet API Configuration - Direct Connection
const SUPABASE_URL = 'https://lpwhiqtclpiuozxdaipc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwd2hpcXRjbHBpdW96eGRhaXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTgyODQsImV4cCI6MjA4NDY3NDI4NH0.qV4dfR1ccUQokIflxyfQpkmfs_R4p5HOUWrCdHitAPs';
const BINANCE_MAINNET_ENDPOINT = `${SUPABASE_URL}/functions/v1/binance-mainnet-trade`;

// Calculate dynamic trade amount based on current balance
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

// Check Binance Mainnet connection and get balance
const checkMainnetHealth = async (): Promise<{ online: boolean; latency: number; balance?: number }> => {
  const requestId = Date.now().toString(36).toUpperCase();
  console.log(`[v2.2-Live:HEALTH:${requestId}] ════════════════════════════════════`);
  console.log(`[v2.2-Live:HEALTH:${requestId}] BINANCE MAINNET CONNECTION TEST`);
  console.log(`[v2.2-Live:HEALTH:${requestId}] Time: ${new Date().toISOString()}`);
  console.log(`[v2.2-Live:HEALTH:${requestId}] Endpoint: ${BINANCE_MAINNET_ENDPOINT}`);
  
  const startTime = performance.now();
  
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
    
    console.log(`[v2.2-Live:HEALTH:${requestId}] RESPONSE RECEIVED`);
    console.log(`[v2.2-Live:HEALTH:${requestId}] Status: ${response.status}`);
    console.log(`[v2.2-Live:HEALTH:${requestId}] Success: ${data.success}`);
    console.log(`[v2.2-Live:HEALTH:${requestId}] Balance: ${data.data?.balance} USDT`);
    console.log(`[v2.2-Live:HEALTH:${requestId}] Latency: ${elapsed}ms`);
    console.log(`[v2.2-Live:HEALTH:${requestId}] ════════════════════════════════════`);
    
    return { 
      online: data.success, 
      latency: elapsed,
      balance: data.data?.balance,
    };
  } catch (error) {
    const elapsed = Math.round(performance.now() - startTime);
    const isTimeout = (error as Error).name === 'AbortError';
    console.error(`[v2.2-Live:HEALTH:${requestId}] ${isTimeout ? 'TIMEOUT' : 'ERROR'}`);
    console.error(`[v2.2-Live:HEALTH:${requestId}] Elapsed: ${elapsed}ms`);
    console.error(`[v2.2-Live:HEALTH:${requestId}] Message: ${(error as Error).message}`);
    console.error(`[v2.2-Live:HEALTH:${requestId}] ════════════════════════════════════`);
    return { online: false, latency: elapsed };
  }
};

// Send trade directly to Binance Mainnet via Edge Function
const sendTradeToMainnet = async (tradeData: {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
}): Promise<any> => {
  const requestId = Date.now().toString(36).toUpperCase();
  const startTime = performance.now();
  
  // === REQUEST SENT ===
  console.log(`[v2.2-Live:TRADE:${requestId}] ════════════════════════════════════`);
  console.log(`[v2.2-Live:TRADE:${requestId}] BINANCE MAINNET ORDER`);
  console.log(`[v2.2-Live:TRADE:${requestId}] Time: ${new Date().toISOString()}`);
  console.log(`[v2.2-Live:TRADE:${requestId}] Endpoint: ${BINANCE_MAINNET_ENDPOINT}`);
  console.log(`[v2.2-Live:TRADE:${requestId}] Payload:`, JSON.stringify(tradeData, null, 2));
  console.log(`[v2.2-Live:TRADE:${requestId}] ────────────────────────────────────`);
  
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
    
    // === RESPONSE RECEIVED ===
    console.log(`[v2.2-Live:TRADE:${requestId}] RESPONSE RECEIVED`);
    console.log(`[v2.2-Live:TRADE:${requestId}] Status Code: ${response.status}`);
    console.log(`[v2.2-Live:TRADE:${requestId}] Elapsed: ${elapsed}ms`);
    console.log(`[v2.2-Live:TRADE:${requestId}] Success: ${data.success}`);
    console.log(`[v2.2-Live:TRADE:${requestId}] Order ID: ${data.data?.orderId || 'N/A'}`);
    console.log(`[v2.2-Live:TRADE:${requestId}] Data:`, JSON.stringify(data, null, 2));
    console.log(`[v2.2-Live:TRADE:${requestId}] ════════════════════════════════════`);
    
    return { ...data, latency: elapsed, orderId: data.data?.orderId };
    
  } catch (error) {
    const elapsed = Math.round(performance.now() - startTime);
    const isTimeout = (error as Error).name === 'AbortError';
    
    // === ERROR ===
    console.error(`[v2.2-Live:TRADE:${requestId}] ${isTimeout ? 'TIMEOUT' : 'ERROR'}`);
    console.error(`[v2.2-Live:TRADE:${requestId}] Elapsed: ${elapsed}ms`);
    console.error(`[v2.2-Live:TRADE:${requestId}] Message: ${(error as Error).message}`);
    console.error(`[v2.2-Live:TRADE:${requestId}] ════════════════════════════════════`);
    
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

  // Execute a buy order via Binance Mainnet
  const executeBuyOrder = useCallback(async (opportunity: StrategyResult, tradeAmount: number): Promise<{ success: boolean; orderId?: number }> => {
    // Step 1: Check Binance Mainnet connection and balance
    addLogEntry(`[v2.2-Live:MAINNET] جاري الاتصال بـ Binance Mainnet...`, 'info');
    const health = await checkMainnetHealth();
    
    if (!health.online) {
      addLogEntry(`[v2.2-Live:MAINNET] ✗ غير متاح! Latency: ${health.latency}ms`, 'error');
      return { success: false };
    }
    
    addLogEntry(`[v2.2-Live:MAINNET] ✓ متصل | الرصيد الحقيقي: ${health.balance?.toFixed(2) || '??'} USDT | Latency: ${health.latency}ms`, 'success');
    
    // Step 2: Execute trade with slippage tolerance
    const entryPrice = parseFloat(opportunity.price);
    const priceWithSlippage = entryPrice * (1 + SLIPPAGE_PERCENT / 100); // 0.2% slippage for market order
    const fee = tradeAmount * (FEE_PERCENT / 100);
    const quantity = (tradeAmount - fee) / priceWithSlippage;

    addLogEntry(`[v2.2-Live:ORDER] ${opportunity.symbol} | سعر: $${entryPrice.toFixed(6)} | Slippage 0.2%: $${priceWithSlippage.toFixed(6)} | مبلغ: ${tradeAmount.toFixed(2)} USDT | كمية: ${quantity.toFixed(4)}`, 'info');
    
    const result = await sendTradeToMainnet({
      symbol: opportunity.symbol,
      side: 'BUY',
      quantity: quantity.toFixed(6),
    });

    if (result.success) {
      addLogEntry(
        `[v2.2-Live:SUCCESS] ✓ تم تنفيذ الأمر (${result.latency}ms) | Order ID: ${result.orderId || 'N/A'}`,
        'success'
      );
      return { success: true, orderId: result.orderId };
    } else if (result.error?.includes('Invalid symbol') || result.error?.includes('LOT_SIZE')) {
      addLogEntry(`[v2.2-Live:REJECT] ⚠ عملة غير صالحة أو كمية غير مقبولة: ${opportunity.symbol}`, 'warning');
      return { success: false };
    } else {
      addLogEntry(`[v2.2-Live:FAIL] ✗ فشل الشراء: ${result.error || 'خطأ غير معروف'}`, 'error');
      return { success: false };
    }
  }, [addLogEntry]);

  // Reserved amount tracking for pending trades
  const [reservedLiquidity, setReservedLiquidity] = useState(0);

  // Execute with auto-retry logic (v2.2-Live: Dynamic sizing)
  const executeWithRetry = useCallback(async (
    opportunity: StrategyResult,
    pendingId?: string,
    currentRetry: number = 0
  ): Promise<{ success: boolean; tradeAmount: number; orderId?: number }> => {
    // Calculate dynamic trade amount
    const tradeAmount = calculateTradeAmount(virtualBalance);
    
    if (tradeAmount <= 0) {
      addLogEntry(`[v2.2-Live:رفض] الرصيد غير كافٍ للتداول (${virtualBalance.toFixed(2)} USDT) - الحد الأدنى: ${MIN_TRADE_AMOUNT} USDT`, 'error');
      return { success: false, tradeAmount: 0 };
    }

    // Reserve liquidity on first attempt
    if (currentRetry === 0) {
      setReservedLiquidity(prev => prev + tradeAmount);
      setVirtualBalance(prev => prev - tradeAmount);
      addLogEntry(`[v2.2-Live:حجز] تم حجز ${tradeAmount.toFixed(2)} USDT لشراء ${opportunity.symbol}`, 'info');
    }

    // Update pending status
    if (pendingId) {
      setPendingOpportunities(prev => prev.map(p => 
        p.id === pendingId 
          ? { ...p, executionStatus: (currentRetry > 0 ? 'retrying' : 'buying') as ExecutionStatus, retryCount: currentRetry, reservedAmount: tradeAmount }
          : p
      ));
    }

    addLogEntry(`[v2.2-Live:تنفيذ${currentRetry > 0 ? `:محاولة ${currentRetry + 1}` : ''}] جاري شراء ${opportunity.symbol} بـ ${tradeAmount.toFixed(2)} USDT...`, 'info');
    
    const result = await executeBuyOrder(opportunity, tradeAmount);
    
    if (result.success) {
      // Trade successful - keep the deducted amount
      setReservedLiquidity(prev => Math.max(0, prev - tradeAmount));
      
      if (pendingId) {
        setPendingOpportunities(prev => prev.map(p => 
          p.id === pendingId ? { ...p, executionStatus: 'executed' as ExecutionStatus } : p
        ));
        // Remove after showing executed status briefly
        setTimeout(() => {
          setPendingOpportunities(prev => prev.filter(p => p.id !== pendingId));
        }, 3000);
      }
      return { success: true, tradeAmount, orderId: result.orderId };
    }
    
    // Failed - check if we should retry
    if (currentRetry < MAX_RETRY_ATTEMPTS) {
      addLogEntry(`[v2.2-Live:إعادة] فشل شراء ${opportunity.symbol} - إعادة المحاولة خلال 3 ثوانٍ (${currentRetry + 1}/${MAX_RETRY_ATTEMPTS})`, 'warning');
      
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
    setReservedLiquidity(prev => Math.max(0, prev - tradeAmount));
    setVirtualBalance(prev => prev + tradeAmount);
    addLogEntry(`[v2.2-Live:تحرير] تم إرجاع ${tradeAmount.toFixed(2)} USDT بعد فشل نهائي لـ ${opportunity.symbol}`, 'warning');
    
    if (pendingId) {
      setPendingOpportunities(prev => prev.map(p => 
        p.id === pendingId ? { ...p, executionStatus: 'failed' as ExecutionStatus } : p
      ));
    }
    
    return { success: false, tradeAmount: 0 };
  }, [executeBuyOrder, virtualBalance, setVirtualBalance, addLogEntry]);

  // Open a new position (with or without manual confirmation)
  const openPosition = useCallback(async (opportunity: StrategyResult, skipConfirmation: boolean = false) => {
    // Check if we already have a position for this symbol
    const existingPosition = positions.find(p => p.symbol === opportunity.symbol);
    if (existingPosition) return;

    // v2.2-Live: Check if we have enough balance for minimum trade
    const availableBalance = virtualBalance - RESERVED_BALANCE - reservedLiquidity;
    const estimatedTradeAmount = calculateTradeAmount(availableBalance);
    
    if (estimatedTradeAmount <= 0) {
      addLogEntry(`[v2.2-Live:رفض] الرصيد غير كافٍ (${availableBalance.toFixed(2)} USDT) - الحد الأدنى: ${MIN_TRADE_AMOUNT} USDT`, 'error');
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
        `[انتظار_تأكيد] العملة: ${opportunity.symbol} | السعر: $${parseFloat(opportunity.price).toFixed(6)} | المبلغ المقدر: ${estimatedTradeAmount.toFixed(2)} USDT ← اضغط "شراء الآن"`,
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
    if (!result.success) return;

    const tradeAmount = result.tradeAmount;
    const fee = tradeAmount * (FEE_PERCENT / 100);
    const entryPrice = parseFloat(opportunity.price);
    const quantity = (tradeAmount - fee) / entryPrice;
    
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
      `[v2.2-Live:شراء] ✓ ${opportunity.symbol} | السعر: $${entryPrice.toFixed(6)} | الكمية: ${quantity.toFixed(4)} | المبلغ: ${tradeAmount.toFixed(2)} USDT`,
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

  // Close a position via Binance Mainnet
  const closePosition = useCallback(async (position: Position, currentPrice: number, reason: string) => {
    const exitFee = (position.quantity * currentPrice) * (FEE_PERCENT / 100);
    const grossValue = position.quantity * currentPrice;
    const netValue = grossValue - exitFee;
    const pnlAmount = netValue - position.investedAmount;
    const pnlPercent = (pnlAmount / position.investedAmount) * 100;
    const isWin = pnlAmount > 0;

    // Send sell order via Binance Mainnet
    addLogEntry(`[v2.2-Live:SELL] جاري إرسال أمر بيع ${position.symbol}...`, 'info');
    
    const result = await sendTradeToMainnet({
      symbol: position.symbol,
      side: 'SELL',
      quantity: position.quantity.toFixed(6),
    });

    if (result.success) {
      addLogEntry(
        `[v2.2-Live:SELL] ✓ تم تنفيذ أمر البيع (${result.latency}ms) | Order ID: ${result.orderId || 'N/A'}`,
        'success'
      );
    } else if (result.error) {
      addLogEntry(`[v2.2-Live:SELL] ⚠ خطأ: ${result.error}`, 'warning');
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

  // v2.1-Live: Process opportunities - AUTO-EXECUTE when score >= 60
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
        // v2.2-Live: Universal Auto-Buy - ANY score >= 60 = instant execution
        const opportunityScore = opportunity.score || 0;
        const shouldAutoExecute = opportunityScore >= UNIVERSAL_AUTO_BUY_THRESHOLD;
        const estimatedAmount = calculateTradeAmount(virtualBalance);
        
        if (shouldAutoExecute && estimatedAmount > 0) {
          addLogEntry(`[v2.2-Live:تنفيذ_فوري] ${opportunity.symbol} | تقييم: ${opportunityScore}/100 ≥ 60 | المبلغ: ${estimatedAmount.toFixed(2)} USDT (${TRADE_PERCENT}% من الرصيد)`, 'success');
        }
        
        // Execute immediately if score >= 60 OR auto-trading is ON
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
