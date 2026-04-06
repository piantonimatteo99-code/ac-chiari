'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, BellOff, Check, CheckCheck, X, ExternalLink, Settings, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useNotifications, type Notifica } from '@/src/hooks/use-notifications';
import { useUserNotifPreferences } from '@/src/hooks/use-user-notif-preferences';
import { formatDistanceToNow } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
import Link from 'next/link';
import { useUser } from '@/src/firebase';
import { NOTIFICA_TYPE_DEFINITIONS, getNotificasByCategory } from '@/lib/notification-types';

/** Converts a base64url VAPID public key to Uint8Array for PushManager.subscribe() */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer;
}

const NOTIFICA_ICONS: Record<Notifica['type'], string> = {
  pagamento: '💳',
  evento: '📅',
  iscrizione: '📝',
  magazzino: '📦',
  generale: '📢',
  feedback: '💬',
};

const NOTIFICA_COLORS: Record<Notifica['type'], string> = {
  pagamento: 'bg-amber-500/10 text-amber-600',
  evento: 'bg-blue-500/10 text-blue-600',
  iscrizione: 'bg-purple-500/10 text-purple-600',
  magazzino: 'bg-red-500/10 text-red-600',
  generale: 'bg-green-500/10 text-green-600',
  feedback: 'bg-gray-500/10 text-gray-600',
};

function NotificaItem({ n, onRead, onDelete }: { n: Notifica; onRead: (id: string) => void; onDelete: (id: string) => void }) {
  const ts = n.createdAt?.toDate ? n.createdAt.toDate() : n.createdAt ? new Date(n.createdAt) : null;
  const [swipeX, setSwipeX] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => setStartX(e.touches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null) return;
    const delta = e.touches[0].clientX - startX;
    if (delta < 0) setSwipeX(delta); // only swipe left
  };
  const handleTouchEnd = () => {
    if (swipeX < -80) {
      setDismissed(true);
      setTimeout(() => onDelete(n.id), 250);
    } else {
      setSwipeX(0);
    }
    setStartX(null);
  };

  const inner = (
    <div
      className={cn(
        'relative flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-all cursor-pointer group',
        !n.letta && 'bg-primary/5',
        dismissed && 'opacity-0 scale-95'
      )}
      style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.2s ease, opacity 0.2s ease' : undefined }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => onRead(n.id)}
    >
      <div className={cn('rounded-full p-2 text-sm shrink-0 mt-0.5', NOTIFICA_COLORS[n.type])}>
        {NOTIFICA_ICONS[n.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn('text-sm font-medium leading-tight', !n.letta && 'font-semibold')}>
            {n.title}
          </p>
          {!n.letta && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
        {ts && (
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {formatDistanceToNow(ts, { addSuffix: true, locale: itLocale })}
          </p>
        )}
      </div>
      {n.href && (
        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
      {/* Delete button — visible on hover (desktop) */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(n.id); }}
        className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
        title="Rimuovi notifica"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );

  if (n.href) {
    return <Link href={n.href} className="block">{inner}</Link>;
  }
  return inner;
}

type TabType = 'notifiche' | 'preferenze';

export function NotificationBell() {
  const { notifiche, unreadCount, markAsRead, markAllAsRead, deleteNotifica } = useNotifications();
  const { isEnabled, setPreference, resetToDefaults, isLoading: isPrefLoading } = useUserNotifPreferences();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabType>('notifiche');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState<boolean | null>(null); // null = checking
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { user } = useUser();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Check native Web Push support on mount (works on iOS PWA, Android, Desktop)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported =
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;
    setPushSupported(supported);
    if (supported && Notification.permission === 'granted') {
      // Check if already subscribed
      navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.getSubscription().then(sub => {
          if (sub) setPushEnabled(true);
        })
      ).catch(() => {});
    }
  }, []);

  // Update the app icon badge (Web App Badging API — works on Android, Windows, macOS PWA)
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if ('setAppBadge' in navigator) {
      if (unreadCount > 0) {
        (navigator as any).setAppBadge(unreadCount).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }
  }, [unreadCount]);

  const handleEnablePush = async () => {
    if (!user) return;
    setPushLoading(true);
    setPushError(null);
    try {
      // 1. Request notification permission
      const permission = await Notification.requestPermission();
      if (permission === 'denied') {
        setPushError('Permesso negato. Abilitalo nelle impostazioni.');
        return;
      }
      if (permission !== 'granted') return;

      // 2. Get the active service worker
      const reg = await navigator.serviceWorker.ready;

      // 3. Subscribe via native Web Push (works on iOS 16.4+ PWA + Android + Desktop)
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY!
        ),
      });

      // 4. Save subscription to Firestore via API
      const res = await fetch('/api/webpush/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, subscription: subscription.toJSON() }),
      });

      if (!res.ok) throw new Error('Salvataggio subscription fallito');
      setPushEnabled(true);
    } catch (err: any) {
      console.error('Errore push:', err);
      setPushError('Attivazione fallita. Assicurati di usare HTTPS e che l\'app sia installata.');
    } finally {
      setPushLoading(false);
    }
  };

  const byCategory = getNotificasByCategory();

  return (
    <div className="relative">
      {/* Bell Button */}
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        className="relative rounded-full"
        onClick={() => setOpen(v => !v)}
        aria-label="Notifiche"
      >
        {unreadCount > 0
          ? <BellRing className="h-5 w-5 text-primary" />
          : <Bell className="h-5 w-5" />}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Panel — fixed full-width on mobile, absolute dropdown on desktop */}
      {open && (
        <>
          {/* Mobile overlay backdrop */}
          <div className="fixed inset-0 bg-black/20 z-40 sm:hidden" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className={cn(
              "z-50 overflow-hidden bg-card shadow-xl border rounded-xl flex flex-col",
              // Mobile: fixed, full width, anchored below header, max height to leave room for safe area
              "fixed left-2 right-2 top-16 max-h-[calc(100dvh-5rem)] sm:static sm:max-h-none",
              // Desktop: absolute dropdown anchored to button
              "sm:absolute sm:right-0 sm:left-auto sm:top-full sm:mt-2 sm:w-[380px] sm:max-h-[85vh]"
            )}
          >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Notifiche</span>
              {unreadCount > 0 && tab === 'notifiche' && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{unreadCount} nuove</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && tab === 'notifiche' && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={markAllAsRead}>
                  <CheckCheck className="h-3 w-3" /> Tutte lette
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setTab('notifiche')}
              className={cn(
                'flex-1 py-2 text-xs font-medium transition-colors',
                tab === 'notifiche'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              📥 Notifiche
            </button>
            <button
              onClick={() => setTab('preferenze')}
              className={cn(
                'flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1',
                tab === 'preferenze'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Settings className="h-3 w-3" /> Preferenze
            </button>
          </div>

          {/* TAB: NOTIFICHE */}
          {tab === 'notifiche' && (
            <div className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="flex-1 min-h-0">
                {notifiche.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground font-medium">Nessuna notifica</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Qui appariranno gli aggiornamenti importanti</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifiche.map(n => (
                      <NotificaItem key={n.id} n={n} onRead={markAsRead} onDelete={deleteNotifica} />
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Footer: push */}
              <div className="border-t px-4 py-3 bg-muted/20 space-y-2">
                {pushEnabled ? (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <Check className="h-3.5 w-3.5" />
                    <span>Notifiche push attive sul dispositivo</span>
                  </div>
                ) : pushSupported === false ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <BellOff className="h-3.5 w-3.5" />
                    <span>Push non disponibili su Safari/iOS — usa Chrome su Android</span>
                  </div>
                ) : pushSupported === true ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs gap-2"
                      onClick={handleEnablePush}
                      disabled={pushLoading}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      {pushLoading ? 'Attivazione...' : '🔔 Attiva notifiche push sul dispositivo'}
                    </Button>
                    {pushError && (
                      <p className="text-[11px] text-destructive text-center">{pushError}</p>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground text-center">Verifica supporto...</div>
                )}
              </div>
            </div>
          )}

          {/* TAB: PREFERENZE */}
          {tab === 'preferenze' && (
            <div className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-1 text-xs text-muted-foreground border-b">
                  Personalizza quali notifiche vuoi ricevere. Le notifiche disattivate globalmente dall'admin non possono essere abilitate.
                </div>
                {isPrefLoading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Caricamento...</div>
                ) : (
                  <div>
                    {Array.from(byCategory.entries()).map(([category, defs]) => (
                      <div key={category}>
                        <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30">
                          {category}
                        </div>
                        <div className="divide-y">
                          {defs.map(def => {
                            const enabled = isEnabled(def.id);
                            return (
                              <div key={def.id} className="flex items-center gap-3 px-4 py-3">
                                <span className="text-base w-6 text-center shrink-0">{def.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium leading-tight">{def.label}</p>
                                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{def.description}</p>
                                </div>
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={(v) => setPreference(def.id, v)}
                                  className="shrink-0"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Footer: reset */}
              <div className="border-t px-4 py-3 bg-muted/20 shrink-0">
                <Button variant="ghost" size="sm" className="w-full text-xs gap-2 text-muted-foreground" onClick={resetToDefaults}>
                  <RotateCcw className="h-3 w-3" />
                  Ripristina preferenze predefinite
                </Button>
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
