import { Activity, Wifi, WifiOff, Clock, RefreshCw } from 'lucide-react';
import { ControlPanel } from './ControlPanel';
import { TopCoin } from './TopCoin';
import { Position } from '@/hooks/usePaperTrading';

interface HeaderProps {
  isConnected: boolean;
  lastUpdate: Date | null;
  isPaused: boolean;
  onTogglePause: () => void;
  onSystemReset: () => void;
  onVerifyServer?: () => Promise<unknown>;
  isCheckingServer?: boolean;
  serverConnected?: boolean | null;
  positions: Position[];
  lastSync?: Date | null;
  isSyncing?: boolean;
  serverLatency?: number;
}

export const Header = ({ 
  isConnected, 
  lastUpdate, 
  isPaused, 
  onTogglePause, 
  onSystemReset,
  onVerifyServer,
  isCheckingServer,
  serverConnected,
  positions,
  lastSync,
  isSyncing,
  serverLatency = -1,
}: HeaderProps) => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity className="w-6 h-6 text-terminal-green" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-terminal-green rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wider text-terminal-green text-glow-green">
              مركز قيادة العملات الرقمية
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-widest">
              v1.8.0-AR | وضع المزامنة التلقائية
              {isPaused && <span className="text-terminal-amber ms-2">[متوقف]</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Top Coin Display */}
          <TopCoin positions={positions} />
          
          <ControlPanel 
            isPaused={isPaused}
            onTogglePause={onTogglePause}
            onSystemReset={onSystemReset}
            onVerifyServer={onVerifyServer}
            isCheckingServer={isCheckingServer}
            serverConnected={serverConnected}
          />

          {/* Last Sync Indicator */}
          <div className="flex items-center gap-2 text-xs border-r border-border pr-4">
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-terminal-amber' : 'text-muted-foreground'}`} />
            <div className="flex flex-col">
              <span className="text-muted-foreground text-[10px]">آخر مزامنة</span>
              <span className="text-foreground font-mono text-[11px]">
                {lastSync
                  ? lastSync.toLocaleTimeString('ar-SA', { hour12: false })
                  : '--:--:--'}
              </span>
            </div>
            {serverLatency > 0 && (
              <span className={`text-[10px] font-mono ${serverLatency < 500 ? 'text-terminal-green' : 'text-terminal-amber'}`}>
                {serverLatency}ms
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground font-mono">
              {lastUpdate
                ? lastUpdate.toLocaleTimeString('ar-SA', { hour12: false })
                : '--:--:--'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-terminal-green" />
                <span className="text-xs text-terminal-green">متصل</span>
                <span className="w-2 h-2 bg-terminal-green rounded-full glow-green animate-pulse" />
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-terminal-red" />
                <span className="text-xs text-terminal-red">غير متصل</span>
                <span className="w-2 h-2 bg-terminal-red rounded-full glow-red" />
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
