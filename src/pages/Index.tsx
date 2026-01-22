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

const INITIAL_BALANCE = 100;

const Index = () => {
  const [virtualBalance, setVirtualBalance] = useState(INITIAL_BALANCE);
  const [isPaused, setIsPaused] = useState(false);
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

  // Handle hard reset (positions only)
  const handleHardReset = () => {
    hardReset(INITIAL_BALANCE);
  };

  // Handle full system reset (everything)
  const handleSystemReset = useCallback(async () => {
    await fullSystemReset();
    hardReset(INITIAL_BALANCE);
    reloadLogs();
    addLogEntry(`[إعادة_تعيين_النظام] تم تصفير جميع البيانات. الرصيد: ${INITIAL_BALANCE} USDT`, 'warning');
  }, [hardReset, reloadLogs, addLogEntry]);

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

  // Initialize IndexedDB and load session
  useEffect(() => {
    const init = async () => {
      await initDB();
      addLogEntry('تم تهيئة النظام. تم إنشاء اتصال IndexedDB.', 'success');
      
      const session = await getSession();
      if (session) {
        setVirtualBalance(session.virtualBalance);
        addLogEntry(`تم استعادة الجلسة. الرصيد: ${session.virtualBalance.toFixed(2)} USDT`, 'info');
      } else {
        addLogEntry(`تم إنشاء جلسة جديدة. الرصيد الافتراضي: ${INITIAL_BALANCE} USDT`, 'info');
      }
    };
    init();
  }, []);

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
                initialBalance={INITIAL_BALANCE}
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
