import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileJson, Copy, Check, Activity } from 'lucide-react';

interface DiagnosticBundleProps {
  totalScanned: number;
  opportunities: number;
  virtualBalance: number;
  lastUpdate: Date | null;
}

const VERSION = 'v1.0.0';

export const DiagnosticBundle = ({
  totalScanned,
  opportunities,
  virtualBalance,
  lastUpdate,
}: DiagnosticBundleProps) => {
  const [copied, setCopied] = useState(false);

  const diagnosticData = {
    version: VERSION,
    timestamp: lastUpdate?.toISOString() || new Date().toISOString(),
    system: {
      status: 'OPERATIONAL',
      uptime: `${Math.floor((Date.now() - (lastUpdate?.getTime() || Date.now())) / 1000)}s`,
    },
    metrics: {
      totalAssetsScanned: totalScanned,
      activeOpportunities: opportunities,
      virtualBalance: `${virtualBalance.toFixed(2)} USDT`,
    },
    engine: {
      dataSource: 'Binance Public API',
      refreshRate: '30s',
      targetAssets: 100,
    },
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(diagnosticData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="terminal-card h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-terminal-amber" />
          <span className="text-sm font-medium text-terminal-amber">DIAGNOSTIC_BUNDLE</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-muted-foreground hover:text-terminal-green hover:bg-terminal-green/10"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>

      <div className="flex-1 p-3 overflow-auto">
        <pre className="text-xs font-mono text-secondary-foreground whitespace-pre-wrap">
          <code>{JSON.stringify(diagnosticData, null, 2)}</code>
        </pre>
      </div>

      <div className="p-3 border-t border-border">
        <div className="grid grid-cols-2 gap-3">
          <StatusCard
            label="SCANNED"
            value={totalScanned.toString()}
            status="success"
          />
          <StatusCard
            label="OPPORTUNITIES"
            value={opportunities.toString()}
            status={opportunities > 0 ? 'warning' : 'muted'}
          />
          <StatusCard
            label="BALANCE"
            value={`${virtualBalance.toFixed(2)}`}
            suffix="USDT"
            status="success"
          />
          <StatusCard
            label="VERSION"
            value={VERSION}
            status="muted"
          />
        </div>
      </div>
    </div>
  );
};

interface StatusCardProps {
  label: string;
  value: string;
  suffix?: string;
  status: 'success' | 'warning' | 'muted';
}

const StatusCard = ({ label, value, suffix, status }: StatusCardProps) => {
  const colorClass = {
    success: 'text-terminal-green',
    warning: 'text-terminal-amber',
    muted: 'text-muted-foreground',
  }[status];

  const glowClass = {
    success: 'glow-green',
    warning: 'glow-amber',
    muted: '',
  }[status];

  return (
    <div className="bg-secondary/50 rounded px-3 py-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-sm font-semibold ${colorClass}`}>
        <span className={status !== 'muted' ? 'text-glow-green' : ''}>{value}</span>
        {suffix && <span className="text-muted-foreground ml-1 text-xs">{suffix}</span>}
      </div>
    </div>
  );
};
