import { useEffect, useState, useCallback } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            photo_url?: string;
          };
          query_id?: string;
        };
        themeParams: Record<string, string>;
        colorScheme: 'dark' | 'light';
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        ready: () => void;
        expand: () => void;
        close: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        openLink: (url: string) => void;
        openTelegramLink: (url: string) => void;
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
          offClick: (fn: () => void) => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive: boolean) => void;
          hideProgress: () => void;
          onClick: (fn: () => void) => void;
          offClick: (fn: () => void) => void;
        };
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export function useTelegram() {
  const [isInsideTelegram, setIsInsideTelegram] = useState(false);
  const [initData, setInitData] = useState<string>('');
  const [user, setUser] = useState<{ id: number; first_name: string; username?: string; photo_url?: string } | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initData) {
      setIsInsideTelegram(true);
      setInitData(tg.initData);
      setUser(tg.initDataUnsafe?.user || null);

      try {
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#0B0B12');
        tg.setBackgroundColor('#0B0B12');
      } catch (e) {
        console.warn('Telegram WebApp setup error:', e);
      }
    } else {
      // Standalone mode outside Telegram
      setIsInsideTelegram(false);
      setInitData('');
    }
  }, []);

  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.HapticFeedback) return;

    if (type === 'success' || type === 'error') {
      tg.HapticFeedback.notificationOccurred(type);
    } else {
      tg.HapticFeedback.impactOccurred(type);
    }
  }, []);

  const openExternalLink = useCallback((url: string) => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  return {
    isInsideTelegram,
    initData,
    user,
    triggerHaptic,
    openExternalLink,
    tg: window.Telegram?.WebApp
  };
}
