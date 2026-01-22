import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { EventLog } from '@/components/EventLog';
import { DiagnosticBundle } from '@/components/DiagnosticBundle';
import { MarketGrid } from '@/components/MarketGrid';
import { useEventLog } from '@/hooks/useEventLog';
import { useBinanceData } from '@/hooks/useBinanceData';
import { saveSession, getSession, initDB } from '@/lib/indexedDB';

const INITIAL_BALANCE = 100;

const Index = () => {
  const [virtualBalance, setVirtualBalance] = useState(INITIAL_BALANCE);
  const { logs, addLogEntry, clearAllLogs } = useEventLog();
  const { coins, loading, error, lastUpdate, refetch } = useBinanceData(addLogEntry);

  // Initialize IndexedDB and load session
  useEffect(() => {
    const init = async () => {
      await initDB();
      addLogEntry('System initialized. IndexedDB connection established.', 'success');
      
      const session = await getSession();
      if (session) {
        setVirtualBalance(session.virtualBalance);
        addLogEntry(`Session restored. Balance: ${session.virtualBalance.toFixed(2)} USDT`, 'info');
      } else {
        addLogEntry(`New session created. Virtual balance: ${INITIAL_BALANCE} USDT`, 'info');
      }
    };
    init();
  }, []);

  // Save session on changes
  useEffect(() => {
    if (coins.length > 0) {
      saveSession({
        id: 'main',
        virtualBalance,
        lastUpdate: new Date().toISOString(),
        totalScanned: coins.length,
        opportunities: coins.filter(
          (c) => Math.abs(parseFloat(c.priceChangePercent)) > 5
        ).length,
      });
    }
  }, [coins, virtualBalance]);

  const opportunities = useMemo(() => {
    return coins.filter((c) => Math.abs(parseFloat(c.priceChangePercent)) > 5).length;
  }, [coins]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header isConnected={!error && coins.length > 0} lastUpdate={lastUpdate} />

      <main className="flex-1 container py-4 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-7rem)]">
          {/* Left Panel - Event Log */}
          <div className="lg:col-span-3 h-full min-h-[300px]">
            <EventLog logs={logs} onClear={clearAllLogs} />
          </div>

          {/* Center Panel - Market Grid */}
          <div className="lg:col-span-6 h-full min-h-[400px]">
            <MarketGrid coins={coins} loading={loading} onRefresh={refetch} />
          </div>

          {/* Right Panel - Diagnostic Bundle */}
          <div className="lg:col-span-3 h-full min-h-[300px]">
            <DiagnosticBundle
              totalScanned={coins.length}
              opportunities={opportunities}
              virtualBalance={virtualBalance}
              lastUpdate={lastUpdate}
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
