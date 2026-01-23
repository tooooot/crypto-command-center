import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileJson, Copy, Check } from 'lucide-react';
import { SYSTEM_VERSION } from '@/lib/version';

interface DiagnosticBundleProps {
  totalScanned: number;
  opportunities: number;
  virtualBalance: number;
  lastUpdate: Date | null;
  breakoutCount: number;
  rsiBounceCount: number;
  openPositions: number;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  openPositionsValue: number;
  totalPortfolioValue: number;
  isPaused?: boolean;
}

export const DiagnosticBundle = ({
  totalScanned,
  opportunities,
  virtualBalance,
  lastUpdate,
  breakoutCount,
  rsiBounceCount,
  openPositions,
  totalTrades,
  winRate,
  totalPnL,
  openPositionsValue,
  totalPortfolioValue,
}: DiagnosticBundleProps) => {
  const [copied, setCopied] = useState(false);

  const diagnosticData = {
    الإصدار: SYSTEM_VERSION,
    الطابع_الزمني: lastUpdate?.toISOString() || new Date().toISOString(),
    النظام: {
      الحالة: 'يعمل بنجاح',
      وضع_التداول: 'Smart Entry + Chaser',
    },
    المحفظة: {
      السيولة_المتاحة: `${virtualBalance.toFixed(2)} USDT`,
      قيمة_العملات: `${openPositionsValue.toFixed(2)} USDT`,
      القيمة_الإجمالية: `${totalPortfolioValue.toFixed(2)} USDT`,
    },
    المقاييس: {
      إجمالي_العملات_المفحوصة: totalScanned,
      الفرص_المكتشفة: {
        استراتيجية_10_اختراق: breakoutCount,
        استراتيجية_65_ارتداد_RSI: rsiBounceCount,
        الإجمالي: opportunities,
      },
    },
    التداول: {
      الصفقات_المفتوحة: `${openPositions}/10`,
      إجمالي_الصفقات: totalTrades,
      نسبة_النجاح: `${winRate.toFixed(1)}%`,
      الربح_الصافي: `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`,
      العمولة: '0.1%',
      الوقف_الزاحف: '1%',
    },
    المحرك: {
      مصدر_البيانات: 'Binance Testnet API',
      البيئة: 'Testnet (Mock Trading)',
      حالة_الربط: 'متصل ✓',
      معدل_التحديث: '30 ثانية',
      الأصول_المستهدفة: 100,
    },
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    // Try modern Navigator Clipboard API first
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('Navigator clipboard failed, trying fallback:', err);
      }
    }
    
    // Fallback: Create a temporary textarea element
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (err) {
      console.error('Clipboard fallback also failed:', err);
      return false;
    }
  };

  const handleCopy = async () => {
    const text = JSON.stringify(diagnosticData, null, 2);
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="terminal-card h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-terminal-amber" />
          <span className="text-sm font-medium text-terminal-amber">حزمة_التشخيص</span>
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
        <pre className="text-xs font-mono text-secondary-foreground whitespace-pre-wrap" dir="ltr">
          <code>{JSON.stringify(diagnosticData, null, 2)}</code>
        </pre>
      </div>

      <div className="p-3 border-t border-border">
        <div className="grid grid-cols-2 gap-3">
          <StatusCard
            label="السيولة"
            value={`${virtualBalance.toFixed(2)}`}
            suffix="USDT"
            status="success"
          />
          <StatusCard
            label="قيمة العملات"
            value={`${openPositionsValue.toFixed(2)}`}
            suffix="USDT"
            status={openPositionsValue > 0 ? 'warning' : 'muted'}
          />
          <StatusCard
            label="الصفقات"
            value={`${openPositions}/10`}
            status={openPositions > 0 ? 'warning' : 'muted'}
          />
          <StatusCard
            label="الفرص"
            value={opportunities.toString()}
            status={opportunities > 0 ? 'warning' : 'muted'}
          />
          <StatusCard
            label="الربح الصافي"
            value={`${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`}
            status={totalPnL >= 0 ? 'success' : 'muted'}
          />
          <StatusCard
            label="الإصدار"
            value={SYSTEM_VERSION}
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

  return (
    <div className="bg-secondary/50 rounded px-3 py-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-sm font-semibold ${colorClass}`}>
        <span className={status !== 'muted' ? 'text-glow-green' : ''}>{value}</span>
        {suffix && <span className="text-muted-foreground ms-1 text-xs">{suffix}</span>}
      </div>
    </div>
  );
};
