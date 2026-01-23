import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Activity, Wifi, WifiOff, RefreshCw, Radio, Zap, Wallet, Bot, TrendingUp, TrendingDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import { useIsolatedVirtualTrading } from '@/hooks/useIsolatedVirtualTrading';
import { useAutoSync } from '@/hooks/useAutoSync';
import { initDB, fullSystemReset } from '@/lib/indexedDB';

const FALLBACK_BALANCE = 100;
const VIRTUAL_INITIAL_BALANCE = 10000;

import { StrategyType } from '@/components/dashboard/BalanceCard';

export const TradingDashboard = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'virtual'>('live');
  const [liveBalance, setLiveBalance] = useState(FALLBACK_BALANCE);
  const [isPaused, setIsPaused] = useState(false);
  const [isBalanceLoaded, setIsBalanceLoaded] = useState(false);
  const [liveAutoTrading, setLiveAutoTrading] = useState(false);
  const [virtualAutoTrading, setVirtualAutoTrading] = useState(false);
  const [liveStrategy, setLiveStrategy] = useState<StrategyType>('all');
  const [virtualStrategy, setVirtualStrategy] = useState<StrategyType>('all');

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

  // Combine all opportunities
  const allOpportunities = useMemo(() => {
    return [...results.breakouts, ...results.rsiBounces, ...results.scalpings, ...results.institutionals, ...results.crossovers];
  }, [results]);

  // Filter opportunities based on selected strategy (for display and processing)
  const getFilteredOpportunities = useCallback((strategy: StrategyType) => {
    if (strategy === 'all') return allOpportunities;
    if (strategy === 'breakout') return results.breakouts;
    if (strategy === 'rsiBounce') return results.rsiBounces;
    if (strategy === 'scalping') return results.scalpings;
    if (strategy === 'institutional') return results.institutionals;
    if (strategy === 'crossover') return results.crossovers;
    return allOpportunities;
  }, [allOpportunities, results]);

  // Opportunity ranker
  const { rankedOpportunities, goldenOpportunity, logGoldenOpportunity } = useOpportunityRanker(
    allOpportunities,
    coins,
    addLogEntry
  );

  // Live trading hook (sends to server)
  const liveTradingHook = usePaperTrading(liveBalance, setLiveBalance, coins, addLogEntry, true);

  // Virtual trading hook with ISOLATED strategy engines
  const isolatedVirtualTrading = useIsolatedVirtualTrading(coins, addLogEntry);

  // Get virtual data based on selected strategy tab
  const virtualData = useMemo(() => 
    isolatedVirtualTrading.getDataForStrategy(virtualStrategy),
    [isolatedVirtualTrading, virtualStrategy]
  );

  // Get active trading hook based on tab
  const activeBalance = activeTab === 'live' ? liveBalance : virtualData.balance;
  const activeInitialBalance = activeTab === 'live' ? FALLBACK_BALANCE : (virtualStrategy === 'all' ? 10000 : 5000);

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
          
          // Determine if auto-trading is enabled for the active tab
          const isLiveAutoEnabled = liveAutoTrading;
          const isVirtualAutoEnabled = virtualAutoTrading;
          
          if (!isPaused) {
            // Get filtered opportunities based on strategy selection
            const liveFilteredOpps = getFilteredOpportunities(liveStrategy);
            const virtualFilteredOpps = getFilteredOpportunities(virtualStrategy);
            
            // Process for LIVE tab
            if (isLiveAutoEnabled && liveFilteredOpps.length > 0) {
              // Auto mode: skip confirmation (true = execute immediately)
              liveTradingHook.processOpportunities(liveFilteredOpps, true);
              addLogEntry(`[آلي:LIVE] تنفيذ فوري لـ ${liveFilteredOpps.length} فرصة`, 'success');
            } else if (liveFilteredOpps.length > 0) {
              // Manual mode: add to pending (false = require confirmation)
              liveTradingHook.processOpportunities(liveFilteredOpps, false);
            }
            
            // Process for VIRTUAL tab - uses isolated strategy engine
            if (isVirtualAutoEnabled && virtualFilteredOpps.length > 0) {
              // Auto mode: skip confirmation (true = execute immediately)
              isolatedVirtualTrading.processOpportunities(virtualFilteredOpps, true, virtualStrategy);
              addLogEntry(`[آلي:افتراضي] تنفيذ فوري لـ ${virtualFilteredOpps.length} فرصة`, 'success');
            } else if (virtualFilteredOpps.length > 0) {
              // Manual mode: add to pending (false = require confirmation)
              isolatedVirtualTrading.processOpportunities(virtualFilteredOpps, false, virtualStrategy);
            }
          }
        }
      }
    }
  }, [coins, lastUpdate, results, allOpportunities, isPaused, liveAutoTrading, virtualAutoTrading, liveStrategy, virtualStrategy, getFilteredOpportunities, isolatedVirtualTrading, addLogEntry]);

  // Handle golden opportunity buy
  const handleGoldenBuy = useCallback(() => {
    if (!goldenOpportunity) return;
    
    if (activeTab === 'live') {
      const pending = liveTradingHook.pendingOpportunities.find(
        p => p.opportunity.symbol === goldenOpportunity.symbol
      );
      if (pending) {
        liveTradingHook.confirmPendingOpportunity(pending.id);
      }
    } else {
      const pending = virtualData.pendingOpportunities.find(
        p => p.opportunity.symbol === goldenOpportunity.symbol
      );
      if (pending) {
        virtualData.confirmPending(pending.id);
      }
    }
  }, [goldenOpportunity, activeTab, liveTradingHook, virtualData]);

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
              selectedStrategy={liveStrategy}
              onStrategyChange={setLiveStrategy}
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

          {/* Virtual Trading Tab with Strategy Sub-Tabs */}
          <TabsContent value="virtual" className="mt-4 space-y-4">
            {/* Strategy Sub-Navigation - 4 Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {/* Core Strategies (الكنز) */}
              <button
                onClick={() => setVirtualStrategy('all')}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  virtualStrategy === 'all'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                    : 'bg-secondary/50 text-muted-foreground border border-border/50 hover:bg-secondary'
                }`}
              >
                📊 الكل
              </button>
              <button
                onClick={() => setVirtualStrategy('breakout')}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  virtualStrategy === 'breakout'
                    ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/50'
                    : 'bg-secondary/50 text-muted-foreground border border-border/50 hover:bg-secondary'
                }`}
              >
                🚀 الاختراق
              </button>
              <button
                onClick={() => setVirtualStrategy('rsiBounce')}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  virtualStrategy === 'rsiBounce'
                    ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/50'
                    : 'bg-secondary/50 text-muted-foreground border border-border/50 hover:bg-secondary'
                }`}
              >
                📈 الارتداد
              </button>
              <button
                onClick={() => setVirtualStrategy('scalping')}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  virtualStrategy === 'scalping'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'bg-secondary/50 text-muted-foreground border border-border/50 hover:bg-secondary'
                }`}
              >
                📊 النطاق (S20)
              </button>
              
              {/* Experimental Strategies (تجريبية) */}
              <div className="w-px bg-border/50 mx-1" />
              <button
                onClick={() => setVirtualStrategy('institutional')}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  virtualStrategy === 'institutional'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    : 'bg-secondary/50 text-muted-foreground border border-border/50 hover:bg-secondary'
                }`}
              >
                🏛️ المؤسسي
              </button>
              <button
                onClick={() => setVirtualStrategy('crossover')}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  virtualStrategy === 'crossover'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    : 'bg-secondary/50 text-muted-foreground border border-border/50 hover:bg-secondary'
                }`}
              >
                ⚡ التقاطعات
              </button>
            </div>

            {/* Golden Opportunity */}
            <GoldenOpportunity 
              opportunity={goldenOpportunity} 
              onBuy={handleGoldenBuy}
              isLive={false}
            />

            {/* Balance Card - without dropdown since we have tabs */}
            <div className="bg-card/50 rounded-2xl p-5 border border-border/50 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/20">
                    <Wallet className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-sm text-muted-foreground">المحفظة الافتراضية</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">DEMO</span>
              </div>

              {/* Auto-Trading Toggle */}
              <div className={`flex items-center justify-between p-3 rounded-xl mb-4 border ${
                virtualAutoTrading 
                  ? 'bg-terminal-green/10 border-terminal-green/30' 
                  : 'bg-secondary/50 border-border/50'
              }`}>
                <div className="flex items-center gap-2">
                  <Bot className={`w-4 h-4 ${virtualAutoTrading ? 'text-terminal-green' : 'text-muted-foreground'}`} />
                  <div>
                    <span className={`text-sm font-medium ${virtualAutoTrading ? 'text-terminal-green' : 'text-muted-foreground'}`}>
                      التداول الآلي
                    </span>
                    <span className={`text-[10px] block ${virtualAutoTrading ? 'text-terminal-green/70' : 'text-muted-foreground/70'}`}>
                      {virtualAutoTrading ? 'تنفيذ تلقائي للصفقات' : 'وضع يدوي - تأكيد مطلوب'}
                    </span>
                  </div>
                </div>
                <Switch
                  checked={virtualAutoTrading}
                  onCheckedChange={handleVirtualAutoTradingChange}
                  className={virtualAutoTrading ? 'data-[state=checked]:bg-terminal-green' : ''}
                />
              </div>

              {/* Total Value */}
              <div className="mb-4">
                <span className="text-3xl font-bold text-foreground">${virtualData.totalPortfolioValue.toFixed(2)}</span>
                <div className={`flex items-center gap-1 mt-1 text-sm ${virtualData.performanceStats.totalPnL >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                  {virtualData.performanceStats.totalPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>{virtualData.performanceStats.totalPnL >= 0 ? '+' : ''}${virtualData.performanceStats.totalPnL.toFixed(2)}</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/50 rounded-xl p-3">
                  <span className="text-[10px] text-muted-foreground block mb-1">السيولة المتاحة</span>
                  <span className="text-sm font-bold text-foreground">${virtualData.balance.toFixed(2)}</span>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3">
                  <span className="text-[10px] text-muted-foreground block mb-1">قيمة العملات</span>
                  <span className="text-sm font-bold text-foreground">${virtualData.openPositionsValue.toFixed(2)}</span>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3">
                  <span className="text-[10px] text-muted-foreground block mb-1">نسبة النجاح</span>
                  <span className={`text-sm font-bold ${virtualData.performanceStats.winRate >= 50 ? 'text-terminal-green' : 'text-terminal-amber'}`}>
                    {virtualData.performanceStats.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3">
                  <span className="text-[10px] text-muted-foreground block mb-1">الاستراتيجية</span>
                  <span className={`text-sm font-bold ${virtualData.isExperimental ? 'text-purple-400' : 'text-blue-400'}`}>
                    {virtualData.label} ({virtualData.initialBalance.toLocaleString()}$)
                    {virtualData.isExperimental && <span className="text-[8px] mr-1 text-purple-300">تجريبي</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* Pending Opportunities */}
            <OpportunitiesList
              pendingOpportunities={virtualData.pendingOpportunities}
              rankedOpportunities={rankedOpportunities}
              onConfirm={virtualData.confirmPending}
              onDismiss={virtualData.dismissPending}
              isLive={false}
            />

            {/* Positions */}
            <PositionsList
              openPositions={virtualData.positions}
              closedTrades={virtualData.closedTrades}
              onClosePosition={virtualData.manualClose}
            />

            {/* Reset Button */}
            <Button
              variant="outline"
              onClick={virtualData.reset}
              className={`w-full ${virtualData.isExperimental 
                ? 'border-purple-500/50 text-purple-400 hover:bg-purple-500/10' 
                : 'border-blue-500/50 text-blue-400 hover:bg-blue-500/10'}`}
            >
              إعادة ضبط {virtualData.label}
            </Button>
          </TabsContent>
        </Tabs>

        {/* Logs Section - Always visible */}
        <CompactLogs
          logs={logs}
          onClear={clearAllLogs}
          diagnosticData={{
            virtualBalance: activeBalance,
            openPositionsValue: activeTab === 'live' ? liveTradingHook.openPositionsValue : virtualData.openPositionsValue,
            totalPortfolioValue: activeTab === 'live' ? liveTradingHook.totalPortfolioValue : virtualData.totalPortfolioValue,
            totalScanned: coins.length,
            opportunities,
            openPositions: activeTab === 'live' ? liveTradingHook.openPositionsCount : virtualData.positions.length,
            totalTrades: activeTab === 'live' ? liveTradingHook.performanceStats.totalTrades : virtualData.performanceStats.totalTrades,
            winRate: activeTab === 'live' ? liveTradingHook.performanceStats.winRate : virtualData.performanceStats.winRate,
            totalPnL: activeTab === 'live' ? liveTradingHook.performanceStats.totalPnL : virtualData.performanceStats.totalPnL,
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
