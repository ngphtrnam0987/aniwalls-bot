import React from 'react';
import { Home, Compass, Heart, Settings } from 'lucide-react';
import { Language, I18N } from '../types';

export type NavTab = 'home' | 'explore' | 'favorites' | 'settings';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  language: Language;
  favoritesCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  language,
  favoritesCount
}) => {
  const t = I18N[language];

  const items = [
    { id: 'home' as NavTab, label: t.home, icon: Home },
    { id: 'explore' as NavTab, label: t.explore, icon: Compass },
    { id: 'favorites' as NavTab, label: t.favorites, icon: Heart, badge: favoritesCount },
    { id: 'settings' as NavTab, label: t.settings, icon: Settings }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-safe pt-1 px-4 pointer-events-none">
      <div className="max-w-md mx-auto mb-3 pointer-events-auto">
        <div className="glass-panel rounded-2xl p-1.5 shadow-2xl shadow-black/80 flex items-center justify-around border border-white/10">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600/30 via-indigo-600/30 to-cyan-600/30 border border-purple-500/30 -z-10 animate-fade-in" />
                )}

                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 text-cyan-400' : ''}`} />
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="absolute -top-1 -right-2 bg-pink-500 text-[10px] font-bold text-white px-1.5 py-0.2 rounded-full ring-2 ring-[#0B0B12]">
                      {item.badge}
                    </span>
                  )}
                </div>

                <span className="text-[11px] mt-1 tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
