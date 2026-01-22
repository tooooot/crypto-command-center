import { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from '@/components/Header';
import { EventLog } from '@/components/EventLog';
import { DiagnosticBundle } from '@/components/DiagnosticBundle';
import { MarketGrid } from '@/components/MarketGrid';
import { useEventLog } from '@/hooks/useEventLog';
import { useBinanceData } from '@/hooks/useBinanceData';
import { useStrategies } from '@/hooks/useStrategies';
import { saveSession, getSession, initDB } from '@/lib/indexedDB';

const INITIAL_BALANCE = 100;

const Index = () => {
  const [virtualBalance, setVirtualBalance] = useState(INITIAL_BALANCE);
  const { logs, addLogEntry, clearAllLogs } = useEventLog();
  const { coins, loading, error, lastUpdate, refetch } = useBinanceData(addLogEntry);
  const { results, logStrategyResults } = useStrategies(coins, addLogEntry);
  const lastLoggedUpdate = useRef<string | null>(null);

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

  // Log strategy results when coins update
  useEffect(() => {
    if (coins.length > 0 && lastUpdate) {
      const updateKey = lastUpdate.toISOString();
      if (lastLoggedUpdate.current !== updateKey) {
        lastLoggedUpdate.current = updateKey;
        
        addLogEntry(`[فحص_الاستراتيجيات] جاري تحليل ${coins.length} عملة...`, 'info');
        
        if (results.totalBreakouts > 0 || results.totalRsiBounces > 0) {
          logStrategyResults(results);
        }
        
        addLogEntry(
          `[نتائج_الفحص] استراتيجية 10: ${results.totalBreakouts} | استراتيجية 65: ${results.totalRsiBounces}`,
          results.totalBreakouts > 0 || results.totalRsiBounces > 0 ? 'warning' : 'info'
        );
      }
    }
  }, [coins, lastUpdate, results, logStrategyResults, addLogEntry]);

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
      <Header isConnected={!error && coins.length > 0} lastUpdate={lastUpdate} />

      <main className="flex-1 container py-4 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-7rem)]">
          {/* Right Panel - Event Log (RTL: appears on right) */}
          <div className="lg:col-span-3 h-full min-h-[300px]">
            <EventLog logs={logs} onClear={clearAllLogs} />
          </div>

          {/* Center Panel - Market Grid */}
          <div className="lg:col-span-6 h-full min-h-[400px]">
            <MarketGrid coins={coins} loading={loading} onRefresh={refetch} />
          </div>

          {/* Left Panel - Diagnostic Bundle (RTL: appears on left) */}
          <div className="lg:col-span-3 h-full min-h-[300px]">
            <DiagnosticBundle
              totalScanned={coins.length}
              opportunities={opportunities}
              virtualBalance={virtualBalance}
              lastUpdate={lastUpdate}
              breakoutCount={results.totalBreakouts}
              rsiBounceCount={results.totalRsiBounces}
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
