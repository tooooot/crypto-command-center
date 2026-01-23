import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Home, TrendingUp, Activity, Beaker, Trophy } from 'lucide-react';

export type LabTab = 'home' | 'breakout' | 'rsi_bounce' | 'experimental' | 'leaderboard';

interface StrategyNavigationProps {
  activeTab: LabTab;
  onTabChange: (tab: LabTab) => void;
}

const tabs = [
  { id: 'home' as LabTab, label: 'الرئيسية', icon: Home },
  { id: 'breakout' as LabTab, label: 'الاختراق', icon: TrendingUp },
  { id: 'rsi_bounce' as LabTab, label: 'الارتداد', icon: Activity },
  { id: 'experimental' as LabTab, label: 'تجريبية', icon: Beaker },
  { id: 'leaderboard' as LabTab, label: 'المتصدر 🏆', icon: Trophy },
];

export const StrategyNavigation = ({ activeTab, onTabChange }: StrategyNavigationProps) => {
  return (
    <div className="bg-card/80 backdrop-blur-lg border-b border-border/50">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex p-2 gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                  isActive
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
