import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RotateCcw, Pause, Play, AlertTriangle, Server, Loader2 } from 'lucide-react';

interface ControlPanelProps {
  isPaused: boolean;
  onTogglePause: () => void;
  onSystemReset: () => void;
  onVerifyServer?: () => Promise<unknown>;
  isCheckingServer?: boolean;
  serverConnected?: boolean | null;
}

export const ControlPanel = ({ 
  isPaused, 
  onTogglePause, 
  onSystemReset,
  onVerifyServer,
  isCheckingServer,
  serverConnected,
}: ControlPanelProps) => {
  return (
    <div className="flex items-center gap-2">
      {/* Server Connection Check Button */}
      {onVerifyServer && (
        <Button
          variant="outline"
          size="sm"
          onClick={onVerifyServer}
          disabled={isCheckingServer}
          className={`h-8 px-3 border-border ${
            serverConnected === true
              ? 'text-terminal-green border-terminal-green/50'
              : serverConnected === false
              ? 'text-terminal-red border-terminal-red/50'
              : 'text-terminal-cyan border-terminal-cyan/50 hover:bg-terminal-cyan/10'
          }`}
        >
          {isCheckingServer ? (
            <>
              <Loader2 className="w-3 h-3 me-1.5 animate-spin" />
              <span className="text-xs">جاري...</span>
            </>
          ) : (
            <>
              <Server className="w-3 h-3 me-1.5" />
              <span className="text-xs">
                {serverConnected === true ? 'متصل' : serverConnected === false ? 'غير متصل' : 'فحص السيرفر'}
              </span>
            </>
          )}
        </Button>
      )}
      {/* Pause/Resume Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onTogglePause}
        className={`h-8 px-3 border-border ${
          isPaused 
            ? 'text-terminal-amber border-terminal-amber/50 hover:bg-terminal-amber/10' 
            : 'text-terminal-green border-terminal-green/50 hover:bg-terminal-green/10'
        }`}
      >
        {isPaused ? (
          <>
            <Play className="w-3 h-3 me-1.5" />
            <span className="text-xs">استئناف</span>
          </>
        ) : (
          <>
            <Pause className="w-3 h-3 me-1.5" />
            <span className="text-xs">إيقاف</span>
          </>
        )}
      </Button>

      {/* System Reset Button with Confirmation */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-terminal-red/50 text-terminal-red hover:bg-terminal-red/10"
          >
            <RotateCcw className="w-3 h-3 me-1.5" />
            <span className="text-xs">إعادة تعيين</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-card border-border" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-terminal-red">
              <AlertTriangle className="w-5 h-5" />
              تأكيد إعادة تعيين النظام
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              هل تريد تصفير المحفظة والسجلات؟
              <br />
              <span className="text-terminal-amber">
                سيتم مسح جميع البيانات وإعادة السيولة إلى 100 USDT.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel className="mt-0 border-border hover:bg-secondary">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onSystemReset}
              className="bg-terminal-red hover:bg-terminal-red/80 text-white"
            >
              تأكيد الإعادة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
