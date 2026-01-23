import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Activity, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { StrategyNavigation, LabTab } from '@/components/lab/StrategyNavigation';
import { StrategyPanel } from '@/components/lab/StrategyPanel';
import { LeaderboardPanel } from '@/components/lab/LeaderboardPanel';
import { HomePanel } from '@/components/lab/HomePanel';
import { UnifiedLogs } from '@/components/lab/UnifiedLogs';
import { useEventLog } from '@/hooks/useEventLog';
import { useBinanceData } from '@/hooks/useBinanceData';
import { useStrategies } from '@/hooks/useStrategies';
import { useOpportunityRanker } from '@/hooks/useOpportunityRanker';
import { useStrategyEngine, StrategyEngineConfig, StrategyType } from '@/hooks/useStrategyEngine';
import { useAutoSync } from '@/hooks/useAutoSync';
import { initDB } from '@/lib/indexedDB';

const STRATEGY_CONFIGS: StrategyEngineConfig[] = [
  {
    name: 'breakout',
    nameAr: 'استراتيجية الاختراق',
    type: 'breakout' as StrategyType,
    initialBalance: 5000,
    tradeAmount: 100,
    tag: 'الاختراق',
  },
  {
    name: 'rsi_bounce',
    nameAr: 'استراتيجية الارتداد',
    type: 'rsi_bounce' as StrategyType,
    initialBalance: 5000,
    tradeAmount: 100,
    tag: 'الارتداد',
  },
];

export const StrategyLab = () => {
  const [activeTab, setActiveTab] = useState<LabTab>('home');
  const [isInitialized, setIsInitialized] = useState(false);

  // Shared hooks
  const { logs, addLogEntry, clearAllLogs, reloadLogs } = useEventLog();
  const { coins, loading, error, lastUpdate, refetch } = useBinanceData(addLogEntry);
  const { results, logStrategyResults } = useStrategies(coins, addLogEntry);

  // Auto-sync (just for status, no live trading here)
  const handleBalanceUpdate = useCallback(() => {}, []);
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

  // Strategy Engines (isolated)
  const breakoutEngine = useStrategyEngine(STRATEGY_CONFIGS[0], coins, addLogEntry);
  const bounceEngine = useStrategyEngine(STRATEGY_CONFIGS[1], coins, addLogEntry);

  const engines = [breakoutEngine, bounceEngine];

  const lastLoggedUpdate = useRef<string | null>(null);

  // Initialize
  useEffect(() => {
    const init = async () => {
      await initDB();
      addLogEntry('🔬 تم تهيئة مختبر الاستراتيجيات المتعددة', 'success');
      addLogEntry('📊 الاستراتيجيات النشطة: الاختراق (5,000 USDT) | الارتداد (5,000 USDT)', 'info');
      setIsInitialized(true);
    };
    init();
  }, []);

  // Process opportunities based on auto-trading setting for each engine
  useEffect(() => {
    if (!isInitialized || coins.length === 0 || !lastUpdate) return;
    
    const updateKey = lastUpdate.toISOString();
    if (lastLoggedUpdate.current === updateKey) return;
    lastLoggedUpdate.current = updateKey;

    if (results.totalBreakouts > 0 || results.totalRsiBounces > 0) {
      logStrategyResults(results);
      
      if (goldenOpportunity) {
        logGoldenOpportunity();
      }
      
      // Process for each engine independently
      engines.forEach(engine => {
        engine.processOpportunities(allOpportunities, engine.autoTrading);
        
        if (engine.autoTrading) {
          const relevantOps = allOpportunities.filter(opp => 
            engine.config.type === 'experimental' || opp.strategy === engine.config.type
          );
          if (relevantOps.length > 0) {
            addLogEntry(
              `[آلي:${engine.config.tag}] تنفيذ ${relevantOps.length} فرصة`,
              'success'
            );
          }
        }
      });
    }
  }, [coins, lastUpdate, results, allOpportunities, isInitialized]);

  // Handle golden opportunity buy for active engine
  const handleGoldenBuy = useCallback((engine: typeof breakoutEngine) => {
    if (goldenOpportunity && engine.pendingOpportunities.length > 0) {
      const pending = engine.pendingOpportunities.find(
        p => p.opportunity.symbol === goldenOpportunity.symbol
      );
      if (pending) {
        engine.confirmPendingOpportunity(pending.id);
      }
    }
  }, [goldenOpportunity]);

  const isConnected = !error && coins.length > 0;
  const opportunities = results.totalBreakouts + results.totalRsiBounces;

  // Get current engine based on active tab
  const getActiveEngine = () => {
    if (activeTab === 'breakout') return breakoutEngine;
    if (activeTab === 'rsi_bounce') return bounceEngine;
    return null;
  };

  // Filter golden opportunity for current tab
  const getFilteredGolden = (tab: LabTab) => {
    if (!goldenOpportunity) return null;
    if (tab === 'breakout') return goldenOpportunity.strategy === 'breakout' ? goldenOpportunity : null;
    if (tab === 'rsi_bounce') return goldenOpportunity.strategy === 'rsi_bounce' ? goldenOpportunity : null;
    return goldenOpportunity;
  };

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
              <h1 className="text-sm font-bold text-foreground">CryptoZen Lab</h1>
              <p className="text-[10px] text-muted-foreground">v3.0.0-LAB</p>
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

      {/* Strategy Navigation */}
      <StrategyNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <main className="container px-4 py-4 pb-24">
        {/* Home Panel */}
        {activeTab === 'home' && (
          <HomePanel
            strategies={engines.map(e => ({
              name: e.config.name,
              nameAr: e.config.nameAr,
              tag: e.config.tag,
              state: e.state,
            }))}
            totalScanned={coins.length}
            totalOpportunities={opportunities}
            serverOnline={serverOnline}
            lastSync={lastSync}
          />
        )}

        {/* Strategy Panels */}
        {activeTab === 'breakout' && (
          <StrategyPanel
            engine={breakoutEngine}
            goldenOpportunity={getFilteredGolden('breakout')}
            rankedOpportunities={rankedOpportunities.filter(r => r.strategy === 'breakout')}
            onGoldenBuy={() => handleGoldenBuy(breakoutEngine)}
          />
        )}

        {activeTab === 'rsi_bounce' && (
          <StrategyPanel
            engine={bounceEngine}
            goldenOpportunity={getFilteredGolden('rsi_bounce')}
            rankedOpportunities={rankedOpportunities.filter(r => r.strategy === 'rsi_bounce')}
            onGoldenBuy={() => handleGoldenBuy(bounceEngine)}
          />
        )}

        {activeTab === 'experimental' && (
          <div className="bg-card/50 rounded-2xl border border-border/50 p-8 text-center">
            <div className="text-4xl mb-4">🧪</div>
            <h2 className="text-xl font-bold text-foreground mb-2">الاستراتيجية التجريبية</h2>
            <p className="text-muted-foreground text-sm">
              قريباً... سيتم إضافة استراتيجيات جديدة للاختبار
            </p>
          </div>
        )}

        {/* Leaderboard */}
        {activeTab === 'leaderboard' && (
          <LeaderboardPanel
            strategies={engines.map(e => ({
              name: e.config.name,
              nameAr: e.config.nameAr,
              tag: e.config.tag,
              state: e.state,
            }))}
          />
        )}

        {/* Unified Logs - Always visible */}
        <div className="mt-4">
          <UnifiedLogs
            logs={logs}
            onClear={clearAllLogs}
            strategies={engines.map(e => ({
              name: e.config.name,
              nameAr: e.config.nameAr,
              tag: e.config.tag,
              state: e.state,
            }))}
            totalScanned={coins.length}
            totalOpportunities={opportunities}
          />
        </div>
      </main>

      {/* Scanline Effect */}
      <div className="fixed inset-0 pointer-events-none scanline opacity-20" />
    </div>
  );
};

export default StrategyLab;
