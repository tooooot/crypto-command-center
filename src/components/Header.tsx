import { Activity, Wifi, WifiOff, Clock } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  lastUpdate: Date | null;
}

export const Header = ({ isConnected, lastUpdate }: HeaderProps) => {
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
              v1.1.0-AR | وضع المحطة الطرفية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
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
