import React from 'react';
import { Sparkles, Globe, ShieldCheck } from 'lucide-react';
import { Language, I18N } from '../types';

interface NavbarProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  isInsideTelegram: boolean;
  userName?: string;
  userPhoto?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  language,
  onLanguageChange,
  isInsideTelegram,
  userName,
  userPhoto
}) => {
  const t = I18N[language];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                {t.appName}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-gray-400 leading-none">
              {t.appSlogan}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2">
          {/* Standalone preview indicator */}
          {!isInsideTelegram && (
            <div className="hidden sm:flex items-center space-x-1 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Web Preview</span>
            </div>
          )}

          {/* Language Switch */}
          <button
            onClick={() => onLanguageChange(language === 'vi' ? 'en' : 'vi')}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg glass-button text-xs font-medium text-gray-300 hover:text-white"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="uppercase">{language}</span>
          </button>

          {/* User Avatar / Badge */}
          {userName && (
            <div className="flex items-center space-x-1.5 pl-1.5 border-l border-white/10">
              {userPhoto ? (
                <img src={userPhoto} alt={userName} className="w-7 h-7 rounded-full object-cover border border-purple-400/40" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-700 to-cyan-600 flex items-center justify-center text-xs font-bold text-white">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
