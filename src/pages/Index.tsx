import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Header } from '@/components/Header';
import { EventLog } from '@/components/EventLog';
import { DiagnosticBundle } from '@/components/DiagnosticBundle';
import { MarketGrid } from '@/components/MarketGrid';
import { OpenPositions } from '@/components/OpenPositions';
import { PerformanceStats } from '@/components/PerformanceStats';
import { PendingTrades } from '@/components/PendingTrades';
import { useEventLog } from '@/hooks/useEventLog';
import { useBinanceData } from '@/hooks/useBinanceData';
import { useStrategies } from '@/hooks/useStrategies';
import { useOpportunityRanker } from '@/hooks/useOpportunityRanker';
import { usePaperTrading } from '@/hooks/usePaperTrading';
import { useServerConnection } from '@/hooks/useServerConnection';
import { saveSession, getSession, initDB, fullSystemReset, clearLogs } from '@/lib/indexedDB';

const FALLBACK_BALANCE = 100;

const Index = () => {
  const [virtualBalance, setVirtualBalance] = useState(FALLBACK_BALANCE);
  const [isPaused, setIsPaused] = useState(false);
  const [isBalanceLoaded, setIsBalanceLoaded] = useState(false);
  const [isManualConfirmMode, setIsManualConfirmMode] = useState(true); // Manual confirmation for first trade
  const { logs, addLogEntry, clearAllLogs, reloadLogs } = useEventLog();
  const { coins, loading, error, lastUpdate, refetch, markSymbolInvalid } = useBinanceData(addLogEntry);
  const { results, logStrategyResults } = useStrategies(coins, addLogEntry);
  
  // Combine all opportunities for ranking
  const allOpportunities = useMemo(() => {
    return [...results.breakouts, ...results.rsiBounces];
  }, [results]);
  
  // Use the opportunity ranker
  const { rankedOpportunities, goldenOpportunity, logGoldenOpportunity, totalOpportunities: rankedTotal } = useOpportunityRanker(
    allOpportunities,
    coins,
    addLogEntry
  );
  const {
    positions,
    performanceStats,
    pendingOpportunities,
    processOpportunities,
    manualClosePosition,
    confirmPendingOpportunity,
    dismissPendingOpportunity,
    hardReset,
    openPositionsCount,
    openPositionsValue,
    totalPortfolioValue,
  } = usePaperTrading(virtualBalance, setVirtualBalance, coins, addLogEntry, isManualConfirmMode);
  
  // Server connection hook
  const { isConnected: serverConnected, isChecking: isCheckingServer, verifyConnection } = useServerConnection(addLogEntry);
  
  const lastLoggedUpdate = useRef<string | null>(null);

  // Fetch real balance from Binance Mainnet API
  const fetchMainnetBalance = useCallback(async (): Promise<number | null> => {
    try {
      const response = await fetch('https://lpwhiqtclpiuozxdaipc.supabase.co/functions/v1/binance-mainnet-trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwd2hpcXRjbHBpdW96eGRhaXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTgyODQsImV4cCI6MjA4NDY3NDI4NH0.qV4dfR1ccUQokIflxyfQpkmfs_R4p5HOUWrCdHitAPs',
        },
        body: JSON.stringify({ action: 'balance' }),
      });
      const result = await response.json();
      
      if (result.success && result.data?.balance !== undefined) {
        addLogEntry('[MAINNET] ✓ تم الربط مع حساب Binance الحقيقي', 'success');
        return result.data.balance;
      } else {
        addLogEntry(`[MAINNET] ⚠ فشل جلب الرصيد: ${result.error || result.data?.msg || 'Unknown'}`, 'warning');
        return null;
      }
    } catch (error: any) {
      addLogEntry(`[MAINNET] ✗ خطأ في الاتصال: ${error.message}`, 'error');
      return null;
    }
  }, [addLogEntry]);

  // Handle hard reset - fetch real balance from Mainnet
  const handleHardReset = useCallback(async () => {
    addLogEntry('[إعادة_ضبط] جاري جلب الرصيد الحقيقي من Binance Mainnet...', 'info');
    const realBalance = await fetchMainnetBalance();
    
    if (realBalance !== null) {
      hardReset(realBalance);
      addLogEntry(`[إعادة_ضبط] ✓ تم تحديث الرصيد: ${realBalance.toFixed(2)} USDT`, 'success');
    } else {
      hardReset(FALLBACK_BALANCE);
      addLogEntry(`[إعادة_ضبط] فشل جلب الرصيد. استخدام الرصيد الافتراضي: ${FALLBACK_BALANCE} USDT`, 'warning');
    }
  }, [hardReset, fetchMainnetBalance, addLogEntry]);

  // Handle full system reset
  const handleSystemReset = useCallback(async () => {
    await fullSystemReset();
    
    addLogEntry('[إعادة_تعيين_النظام] جاري جلب الرصيد الحقيقي من Binance Mainnet...', 'info');
    const realBalance = await fetchMainnetBalance();
    
    if (realBalance !== null) {
      hardReset(realBalance);
      reloadLogs();
      addLogEntry(`[إعادة_تعيين_النظام] ✓ تم تصفير جميع البيانات. الرصيد الحقيقي: ${realBalance.toFixed(2)} USDT`, 'success');
    } else {
      hardReset(FALLBACK_BALANCE);
      reloadLogs();
      addLogEntry(`[إعادة_تعيين_النظام] تم تصفير البيانات. الرصيد الافتراضي: ${FALLBACK_BALANCE} USDT`, 'warning');
    }
  }, [hardReset, reloadLogs, addLogEntry, fetchMainnetBalance]);

  // Handle pause toggle
  const handleTogglePause = useCallback(() => {
    setIsPaused(prev => {
      const newState = !prev;
      addLogEntry(
        newState 
          ? '[إيقاف_مؤقت] تم إيقاف المحرك عن فتح صفقات جديدة' 
          : '[استئناف] تم استئناف المحرك',
        newState ? 'warning' : 'success'
      );
      return newState;
    });
  }, [addLogEntry]);

  // Initialize IndexedDB and fetch real balance from Binance Mainnet
  useEffect(() => {
    const init = async () => {
      await initDB();
      addLogEntry('تم تهيئة النظام. وضع التداول الحقيقي (Mainnet).', 'success');
      addLogEntry('[وضع_التأكيد] يجب الموافقة يدوياً على أول صفقة', 'warning');
      
      // Fetch real balance from Binance Mainnet API
      addLogEntry('[MAINNET] جاري جلب الرصيد الحقيقي من Binance...', 'info');
      const realBalance = await fetchMainnetBalance();
      
      if (realBalance !== null) {
        setVirtualBalance(realBalance);
        setIsBalanceLoaded(true);
        addLogEntry(`[MAINNET] ✓ الرصيد الحقيقي: ${realBalance.toFixed(2)} USDT`, 'success');
      } else {
        const session = await getSession();
        if (session) {
          setVirtualBalance(session.virtualBalance);
          addLogEntry(`تم استعادة الجلسة. الرصيد: ${session.virtualBalance.toFixed(2)} USDT`, 'info');
        } else {
          addLogEntry(`فشل جلب الرصيد. استخدام الرصيد الافتراضي: ${FALLBACK_BALANCE} USDT`, 'warning');
        }
        setIsBalanceLoaded(true);
      }
    };
    init();
  }, [fetchMainnetBalance]);

  // Log strategy results and process opportunities when coins update
  useEffect(() => {
    if (coins.length > 0 && lastUpdate) {
      const updateKey = lastUpdate.toISOString();
      if (lastLoggedUpdate.current !== updateKey) {
        lastLoggedUpdate.current = updateKey;
        
        addLogEntry(`[فحص_الاستراتيجيات] جاري تحليل ${coins.length} عملة...`, 'info');
        
        if (results.totalBreakouts > 0 || results.totalRsiBounces > 0) {
          logStrategyResults(results);
          
          // Log the golden opportunity if found
          if (goldenOpportunity) {
            logGoldenOpportunity();
          }
          
          // Process opportunities (only if not paused) - use ranked opportunities
          if (!isPaused) {
            processOpportunities(allOpportunities);
          }
        }
        
        addLogEntry(
          `[نتائج_الفحص] استراتيجية 10: ${results.totalBreakouts} | استراتيجية 65: ${results.totalRsiBounces}${goldenOpportunity ? ` | 🏆 ${goldenOpportunity.symbol}` : ''}${isPaused ? ' [متوقف]' : ''}`,
          results.totalBreakouts > 0 || results.totalRsiBounces > 0 ? 'warning' : 'info'
        );
      }
    }
  }, [coins, lastUpdate, results, logStrategyResults, addLogEntry, processOpportunities, isPaused, goldenOpportunity, logGoldenOpportunity, allOpportunities]);

  // Save session on changes
  useEffect(() => {
    if (coins.length > 0) {
      saveSession({
        id: 'main',
        virtualBalance,
        lastUpdate: new Date().toISOString(),
        totalScanned: coins.length,
        opportunities: results.totalBreakouts + results.totalRsiBounces,
      });
    }
  }, [coins, virtualBalance, results]);

  // After first confirmed trade, disable manual confirmation mode
  useEffect(() => {
    if (positions.length > 0 && isManualConfirmMode) {
      // Keep manual mode for safety - user can toggle this off manually if needed
    }
  }, [positions.length, isManualConfirmMode]);

  const opportunities = useMemo(() => {
    return results.totalBreakouts + results.totalRsiBounces;
  }, [results]);

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <Header 
        isConnected={!error && coins.length > 0} 
        lastUpdate={lastUpdate}
        isPaused={isPaused}
        onTogglePause={handleTogglePause}
        onSystemReset={handleSystemReset}
        onVerifyServer={verifyConnection}
        isCheckingServer={isCheckingServer}
        serverConnected={serverConnected}
        positions={positions}
      />

      <main className="flex-1 container py-4 px-4">
        {/* Pending Trades Alert */}
        {pendingOpportunities.length > 0 && (
          <div className="mb-4">
            <PendingTrades
              pendingOpportunities={pendingOpportunities}
              rankedOpportunities={rankedOpportunities}
              onConfirm={confirmPendingOpportunity}
              onDismiss={dismissPendingOpportunity}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Right Panel - Event Log */}
          <div className="lg:col-span-3 space-y-4">
            <EventLog 
              logs={logs} 
              onClear={clearAllLogs} 
              diagnosticData={{
                virtualBalance,
                openPositionsValue,
                totalPortfolioValue,
                totalScanned: coins.length,
                opportunities,
                openPositions: openPositionsCount,
                totalTrades: performanceStats.totalTrades,
                winRate: performanceStats.winRate,
                totalPnL: performanceStats.totalPnL,
              }}
            />
          </div>

          {/* Center Panel - Market Grid + Open Positions */}
          <div className="lg:col-span-6 space-y-4">
            <div className="h-[400px]">
              <MarketGrid coins={coins} loading={loading} onRefresh={refetch} />
            </div>
            <div className="h-[250px]">
              <OpenPositions 
                positions={positions} 
                onClosePosition={manualClosePosition}
                onHardReset={handleHardReset}
              />
            </div>
          </div>

          {/* Left Panel - Performance Stats & Diagnostic Bundle */}
          <div className="lg:col-span-3 space-y-4">
            <div className="h-[300px]">
              <PerformanceStats
                stats={performanceStats}
                virtualBalance={virtualBalance}
                initialBalance={FALLBACK_BALANCE}
                openPositionsValue={openPositionsValue}
                totalPortfolioValue={totalPortfolioValue}
              />
            </div>
            <DiagnosticBundle
              totalScanned={coins.length}
              opportunities={opportunities}
              virtualBalance={virtualBalance}
              lastUpdate={lastUpdate}
              breakoutCount={results.totalBreakouts}
              rsiBounceCount={results.totalRsiBounces}
              openPositions={openPositionsCount}
              totalTrades={performanceStats.totalTrades}
              winRate={performanceStats.winRate}
              totalPnL={performanceStats.totalPnL}
              openPositionsValue={openPositionsValue}
              totalPortfolioValue={totalPortfolioValue}
            />
          </div>
        </div>
      </main>

      {/* Scanline overlay effect */}
      <div className="fixed inset-0 pointer-events-none scanline opacity-30" />
    </div>
  );
};

export default Index;
