import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Header } from '@/components/Header';
import { EventLog } from '@/components/EventLog';
import { DiagnosticBundle } from '@/components/DiagnosticBundle';
import { MarketGrid } from '@/components/MarketGrid';
import { OpenPositions } from '@/components/OpenPositions';
import { PerformanceStats } from '@/components/PerformanceStats';
import { useEventLog } from '@/hooks/useEventLog';
import { useBinanceData } from '@/hooks/useBinanceData';
import { useStrategies } from '@/hooks/useStrategies';
import { usePaperTrading } from '@/hooks/usePaperTrading';
import { saveSession, getSession, initDB, fullSystemReset, clearLogs } from '@/lib/indexedDB';

const FALLBACK_BALANCE = 100; // Fallback if API fails

const Index = () => {
  const [virtualBalance, setVirtualBalance] = useState(FALLBACK_BALANCE);
  const [isPaused, setIsPaused] = useState(false);
  const [isBalanceLoaded, setIsBalanceLoaded] = useState(false);
  const { logs, addLogEntry, clearAllLogs, reloadLogs } = useEventLog();
  const { coins, loading, error, lastUpdate, refetch } = useBinanceData(addLogEntry);
  const { results, logStrategyResults } = useStrategies(coins, addLogEntry);
  const {
    positions,
    performanceStats,
    processOpportunities,
    manualClosePosition,
    hardReset,
    openPositionsCount,
    openPositionsValue,
    totalPortfolioValue,
  } = usePaperTrading(virtualBalance, setVirtualBalance, coins, addLogEntry);
  const lastLoggedUpdate = useRef<string | null>(null);

  // Fetch real balance from Binance Testnet API
  const fetchTestnetBalance = useCallback(async (): Promise<number | null> => {
    try {
      const response = await fetch('https://lpwhiqtclpiuozxdaipc.supabase.co/functions/v1/binance-testnet-trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwd2hpcXRjbHBpdW96eGRhaXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTgyODQsImV4cCI6MjA4NDY3NDI4NH0.qV4dfR1ccUQokIflxyfQpkmfs_R4p5HOUWrCdHitAPs',
        },
        body: JSON.stringify({ action: 'balance' }),
      });
      const result = await response.json();
      
      if (result.success && result.data?.balance !== undefined) {
        addLogEntry('[TESTNET] ✓ تم الربط مع تطبيق بينانس (Mock Trading)', 'success');
        return parseFloat(result.data.balance);
      } else {
        addLogEntry(`[TESTNET] ⚠ فشل جلب الرصيد: ${result.error || 'Unknown'}`, 'warning');
        return null;
      }
    } catch (error: any) {
      addLogEntry(`[TESTNET] ✗ خطأ في الاتصال: ${error.message}`, 'error');
      return null;
    }
  }, [addLogEntry]);

  // Handle hard reset - fetch real balance from Testnet
  const handleHardReset = useCallback(async () => {
    addLogEntry('[إعادة_ضبط] جاري جلب الرصيد الحقيقي من Binance Testnet...', 'info');
    const realBalance = await fetchTestnetBalance();
    
    if (realBalance !== null) {
      hardReset(realBalance);
      addLogEntry(`[إعادة_ضبط] ✓ تم تحديث الرصيد: ${realBalance.toFixed(2)} USDT`, 'success');
    } else {
      hardReset(FALLBACK_BALANCE);
      addLogEntry(`[إعادة_ضبط] فشل جلب الرصيد. استخدام الرصيد الافتراضي: ${FALLBACK_BALANCE} USDT`, 'warning');
    }
  }, [hardReset, fetchTestnetBalance, addLogEntry]);

  // Handle full system reset (everything) - fetch real balance
  const handleSystemReset = useCallback(async () => {
    await fullSystemReset();
    
    addLogEntry('[إعادة_تعيين_النظام] جاري جلب الرصيد الحقيقي من Binance Testnet...', 'info');
    const realBalance = await fetchTestnetBalance();
    
    if (realBalance !== null) {
      hardReset(realBalance);
      reloadLogs();
      addLogEntry(`[إعادة_تعيين_النظام] ✓ تم تصفير جميع البيانات. الرصيد الحقيقي: ${realBalance.toFixed(2)} USDT`, 'success');
    } else {
      hardReset(FALLBACK_BALANCE);
      reloadLogs();
      addLogEntry(`[إعادة_تعيين_النظام] تم تصفير البيانات. الرصيد الافتراضي: ${FALLBACK_BALANCE} USDT`, 'warning');
    }
  }, [hardReset, reloadLogs, addLogEntry, fetchTestnetBalance]);

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

  // Initialize IndexedDB and fetch real balance from Binance Testnet
  useEffect(() => {
    const init = async () => {
      await initDB();
      addLogEntry('تم تهيئة النظام. تم إنشاء اتصال IndexedDB.', 'success');
      
      // Fetch real balance from Binance Testnet API
      addLogEntry('[TESTNET] جاري جلب الرصيد الحقيقي من Binance...', 'info');
      const realBalance = await fetchTestnetBalance();
      
      if (realBalance !== null) {
        setVirtualBalance(realBalance);
        setIsBalanceLoaded(true);
        addLogEntry(`[TESTNET] ✓ الرصيد الحقيقي: ${realBalance.toFixed(2)} USDT`, 'success');
      } else {
        // Fallback to session or default
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
  }, [fetchTestnetBalance]);

  // Log strategy results and process opportunities when coins update
  useEffect(() => {
    if (coins.length > 0 && lastUpdate) {
      const updateKey = lastUpdate.toISOString();
      if (lastLoggedUpdate.current !== updateKey) {
        lastLoggedUpdate.current = updateKey;
        
        addLogEntry(`[فحص_الاستراتيجيات] جاري تحليل ${coins.length} عملة...`, 'info');
        
        if (results.totalBreakouts > 0 || results.totalRsiBounces > 0) {
          logStrategyResults(results);
          
          // Process opportunities for paper trading (only if not paused)
          if (!isPaused) {
            const allOpportunities = [...results.breakouts, ...results.rsiBounces];
            processOpportunities(allOpportunities);
          }
        }
        
        addLogEntry(
          `[نتائج_الفحص] استراتيجية 10: ${results.totalBreakouts} | استراتيجية 65: ${results.totalRsiBounces}${isPaused ? ' [متوقف]' : ''}`,
          results.totalBreakouts > 0 || results.totalRsiBounces > 0 ? 'warning' : 'info'
        );
      }
    }
  }, [coins, lastUpdate, results, logStrategyResults, addLogEntry, processOpportunities, isPaused]);

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
        positions={positions}
      />

      <main className="flex-1 container py-4 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Right Panel - Event Log (RTL: appears on right) */}
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

          {/* Left Panel - Performance Stats & Diagnostic Bundle (RTL: appears on left) */}
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
