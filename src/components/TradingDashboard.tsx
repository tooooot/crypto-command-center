import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Activity, Wifi, WifiOff, RefreshCw, Radio, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BalanceCard } from '@/components/dashboard/BalanceCard';
import { GoldenOpportunity } from '@/components/dashboard/GoldenOpportunity';
import { OpportunitiesList } from '@/components/dashboard/OpportunitiesList';
import { PositionsList } from '@/components/dashboard/PositionsList';
import { CompactLogs } from '@/components/dashboard/CompactLogs';
import { useEventLog } from '@/hooks/useEventLog';
import { useBinanceData } from '@/hooks/useBinanceData';
import { useStrategies } from '@/hooks/useStrategies';
import { useOpportunityRanker } from '@/hooks/useOpportunityRanker';
import { usePaperTrading } from '@/hooks/usePaperTrading';
import { useVirtualTrading } from '@/hooks/useVirtualTrading';
import { useAutoSync } from '@/hooks/useAutoSync';
import { initDB, fullSystemReset } from '@/lib/indexedDB';

const FALLBACK_BALANCE = 100;
const VIRTUAL_INITIAL_BALANCE = 10000;

export const TradingDashboard = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'virtual'>('live');
  const [liveBalance, setLiveBalance] = useState(FALLBACK_BALANCE);
  const [isPaused, setIsPaused] = useState(false);
  const [isBalanceLoaded, setIsBalanceLoaded] = useState(false);
  const [liveAutoTrading, setLiveAutoTrading] = useState(false);
  const [virtualAutoTrading, setVirtualAutoTrading] = useState(false);

  // Shared hooks
  const { logs, addLogEntry, clearAllLogs, reloadLogs } = useEventLog();
  const { coins, loading, error, lastUpdate, refetch } = useBinanceData(addLogEntry);
  const { results, logStrategyResults } = useStrategies(coins, addLogEntry);

  // Auto-sync with server
  const handleBalanceUpdate = useCallback((balance: number) => {
    setLiveBalance(balance);
    setIsBalanceLoaded(true);
  }, []);
  
  const { syncData, isSyncing, lastSync, serverOnline, latency: serverLatency } = useAutoSync(
    addLogEntry,
    handleBalanceUpdate
  );

  // Combine opportunities
  const allOpportunities = useMemo(() => {
    return [...results.breakouts, ...results.rsiBounces];
  }, [results]);

  // Opportunity ranker
  const { rankedOpportunities, goldenOpportunity, logGoldenOpportunity } = useOpportunityRanker(
    allOpportunities,
    coins,
    addLogEntry
  );

  // Live trading hook (sends to server)
  const liveTradingHook = usePaperTrading(liveBalance, setLiveBalance, coins, addLogEntry, true);

  // Virtual trading hook (local only)
  const virtualTradingHook = useVirtualTrading(VIRTUAL_INITIAL_BALANCE, coins, addLogEntry);

  // Get active trading hook based on tab
  const activeTradingHook = activeTab === 'live' ? liveTradingHook : virtualTradingHook;
  const activeBalance = activeTab === 'live' ? liveBalance : virtualTradingHook.virtualBalance;
  const activeInitialBalance = activeTab === 'live' ? FALLBACK_BALANCE : VIRTUAL_INITIAL_BALANCE;

  const lastLoggedUpdate = useRef<string | null>(null);

  // Initialize
  useEffect(() => {
    const init = async () => {
      await initDB();
      addLogEntry('تم تهيئة النظام. نظام المسار المزدوج (Live/Virtual).', 'success');
      
      // Fetch real balance
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
          setLiveBalance(result.data.balance);
          setIsBalanceLoaded(true);
          addLogEntry(`[LIVE] ✓ الرصيد الحقيقي: ${result.data.balance.toFixed(2)} USDT`, 'success');
        }
      } catch {
        setIsBalanceLoaded(true);
        addLogEntry(`[LIVE] ⚠ استخدام الرصيد الافتراضي`, 'warning');
      }
    };
    init();
  }, []);

  // Handle auto-trading toggle with logging
  const handleLiveAutoTradingChange = useCallback((enabled: boolean) => {
    setLiveAutoTrading(enabled);
    addLogEntry(
      enabled ? '[LIVE] ✓ تم تفعيل التداول الآلي' : '[LIVE] ⚠ تم تفعيل التداول اليدوي',
      enabled ? 'success' : 'warning'
    );
  }, [addLogEntry]);

  const handleVirtualAutoTradingChange = useCallback((enabled: boolean) => {
    setVirtualAutoTrading(enabled);
    addLogEntry(
      enabled ? '[افتراضي] ✓ تم تفعيل التداول الآلي' : '[افتراضي] ⚠ تم تفعيل التداول اليدوي',
      enabled ? 'success' : 'warning'
    );
  }, [addLogEntry]);

  // Process opportunities based on active tab and auto-trading setting
  useEffect(() => {
    if (coins.length > 0 && lastUpdate) {
      const updateKey = lastUpdate.toISOString();
      if (lastLoggedUpdate.current !== updateKey) {
        lastLoggedUpdate.current = updateKey;
        
        if (results.totalBreakouts > 0 || results.totalRsiBounces > 0) {
          logStrategyResults(results);
          
          if (goldenOpportunity) {
            logGoldenOpportunity();
          }
          
          // Only auto-execute if auto-trading is enabled for the active tab
          const isAutoTradingEnabled = activeTab === 'live' ? liveAutoTrading : virtualAutoTrading;
          
          if (!isPaused && isAutoTradingEnabled) {
            // Auto mode: skip confirmation
            allOpportunities.forEach(opp => {
              if (activeTab === 'live') {
                liveTradingHook.processOpportunities([opp]);
              } else {
                virtualTradingHook.processOpportunities([opp]);
              }
            });
          } else if (!isPaused) {
            // Manual mode: add to pending (requires confirmation)
            activeTradingHook.processOpportunities(allOpportunities);
          }
        }
      }
    }
  }, [coins, lastUpdate, results, allOpportunities, isPaused, activeTab, liveAutoTrading, virtualAutoTrading]);

  // Handle golden opportunity buy
  const handleGoldenBuy = useCallback(() => {
    if (goldenOpportunity && activeTradingHook.pendingOpportunities.length > 0) {
      const pending = activeTradingHook.pendingOpportunities.find(
        p => p.opportunity.symbol === goldenOpportunity.symbol
      );
      if (pending) {
        activeTradingHook.confirmPendingOpportunity(pending.id);
      }
    }
  }, [goldenOpportunity, activeTradingHook]);

  const isConnected = !error && coins.length > 0;
  const opportunities = results.totalBreakouts + results.totalRsiBounces;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Compact Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border/50">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Activity className="w-5 h-5 text-terminal-green" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-terminal-green rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">CryptoZen</h1>
              <p className="text-[10px] text-muted-foreground">v2.0.0-AR</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Sync Status */}
            <div className="flex items-center gap-2 text-xs">
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-terminal-amber' : 'text-muted-foreground'}`} />
              <span className="text-muted-foreground font-mono">
                {lastSync ? lastSync.toLocaleTimeString('ar-SA', { hour12: false }) : '--:--'}
              </span>
              {serverLatency > 0 && (
                <span className={`text-[10px] font-mono ${serverLatency < 500 ? 'text-terminal-green' : 'text-terminal-amber'}`}>
                  {serverLatency}ms
                </span>
              )}
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-terminal-green" />
                  <span className="w-1.5 h-1.5 bg-terminal-green rounded-full animate-pulse" />
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-terminal-red" />
                  <span className="w-1.5 h-1.5 bg-terminal-red rounded-full" />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-4 pb-24">
        {/* Mode Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'live' | 'virtual')} className="w-full mb-4">
          <TabsList className="w-full grid grid-cols-2 h-12 rounded-xl bg-secondary/50 p-1">
            <TabsTrigger 
              value="live" 
              className="rounded-lg data-[state=active]:bg-terminal-green/20 data-[state=active]:text-terminal-green flex items-center gap-2"
            >
              <Radio className="w-4 h-4" />
              <span className="font-bold">تداول حقيقي</span>
            </TabsTrigger>
            <TabsTrigger 
              value="virtual"
              className="rounded-lg data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span className="font-bold">تداول افتراضي</span>
            </TabsTrigger>
          </TabsList>

          {/* Live Trading Tab */}
          <TabsContent value="live" className="mt-4 space-y-4">
            {/* Golden Opportunity */}
            <GoldenOpportunity 
              opportunity={goldenOpportunity} 
              onBuy={handleGoldenBuy}
              isLive={true}
            />

            {/* Balance Card */}
            <BalanceCard
              balance={liveBalance}
              openPositionsValue={liveTradingHook.openPositionsValue}
              totalPortfolioValue={liveTradingHook.totalPortfolioValue}
              initialBalance={FALLBACK_BALANCE}
              totalPnL={liveTradingHook.performanceStats.totalPnL}
              winRate={liveTradingHook.performanceStats.winRate}
              isLive={true}
              autoTrading={liveAutoTrading}
              onAutoTradingChange={handleLiveAutoTradingChange}
            />

            {/* Pending Opportunities */}
            <OpportunitiesList
              pendingOpportunities={liveTradingHook.pendingOpportunities}
              rankedOpportunities={rankedOpportunities}
              onConfirm={liveTradingHook.confirmPendingOpportunity}
              onDismiss={liveTradingHook.dismissPendingOpportunity}
              isLive={true}
            />

            {/* Positions */}
            <PositionsList
              openPositions={liveTradingHook.positions}
              closedTrades={liveTradingHook.closedTrades}
              onClosePosition={liveTradingHook.manualClosePosition}
            />
          </TabsContent>

          {/* Virtual Trading Tab */}
          <TabsContent value="virtual" className="mt-4 space-y-4">
            {/* Golden Opportunity */}
            <GoldenOpportunity 
              opportunity={goldenOpportunity} 
              onBuy={handleGoldenBuy}
              isLive={false}
            />

            {/* Balance Card */}
            <BalanceCard
              balance={virtualTradingHook.virtualBalance}
              openPositionsValue={virtualTradingHook.openPositionsValue}
              totalPortfolioValue={virtualTradingHook.totalPortfolioValue}
              initialBalance={VIRTUAL_INITIAL_BALANCE}
              totalPnL={virtualTradingHook.performanceStats.totalPnL}
              winRate={virtualTradingHook.performanceStats.winRate}
              isLive={false}
              autoTrading={virtualAutoTrading}
              onAutoTradingChange={handleVirtualAutoTradingChange}
            />

            {/* Pending Opportunities */}
            <OpportunitiesList
              pendingOpportunities={virtualTradingHook.pendingOpportunities}
              rankedOpportunities={rankedOpportunities}
              onConfirm={virtualTradingHook.confirmPendingOpportunity}
              onDismiss={virtualTradingHook.dismissPendingOpportunity}
              isLive={false}
            />

            {/* Positions */}
            <PositionsList
              openPositions={virtualTradingHook.positions}
              closedTrades={virtualTradingHook.closedTrades}
              onClosePosition={virtualTradingHook.manualClosePosition}
            />

            {/* Reset Button */}
            <Button
              variant="outline"
              onClick={virtualTradingHook.hardReset}
              className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
            >
              إعادة ضبط المحفظة الافتراضية (10,000 USDT)
            </Button>
          </TabsContent>
        </Tabs>

        {/* Logs Section - Always visible */}
        <CompactLogs
          logs={logs}
          onClear={clearAllLogs}
          diagnosticData={{
            virtualBalance: activeBalance,
            openPositionsValue: activeTradingHook.openPositionsValue,
            totalPortfolioValue: activeTradingHook.totalPortfolioValue,
            totalScanned: coins.length,
            opportunities,
            openPositions: activeTradingHook.openPositionsCount,
            totalTrades: activeTradingHook.performanceStats.totalTrades,
            winRate: activeTradingHook.performanceStats.winRate,
            totalPnL: activeTradingHook.performanceStats.totalPnL,
          }}
          isLive={activeTab === 'live'}
        />
      </main>

      {/* Scanline Effect */}
      <div className="fixed inset-0 pointer-events-none scanline opacity-20" />
    </div>
  );
};

export default TradingDashboard;
