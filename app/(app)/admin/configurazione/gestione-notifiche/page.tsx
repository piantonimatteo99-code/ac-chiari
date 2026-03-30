'use client';

import { useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Info, Shield, GraduationCap, Users } from 'lucide-react';
import { NOTIFICA_TYPE_DEFINITIONS, getNotificasByCategory, type NotificaEventType, type NotificaTypeDefinition } from '@/lib/notification-types';
import { TooltipProvider } from '@/components/ui/tooltip';

// ── Types ───────────────────────────────────────────────────────────────────
export type NotifRole = 'admin' | 'educatore' | 'genitore';

export interface GlobalNotifConfig {
  id: NotificaEventType;
  enabledFor: {
    admin: boolean;
    educatore: boolean;
    genitore: boolean;
  };
}

// ── Role UI config ───────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<NotifRole, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  admin: {
    label: 'Admin',
    icon: Shield,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
  },
  educatore: {
    label: 'Educatori',
    icon: GraduationCap,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
  },
  genitore: {
    label: 'Genitori',
    icon: Users,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDefaultEnabledFor(def: NotificaTypeDefinition): GlobalNotifConfig['enabledFor'] {
  const isTutti = def.recipients.includes('tutti');
  return {
    admin: (isTutti || def.recipients.includes('admin')) ? def.defaultEnabled : false,
    educatore: (isTutti || def.recipients.includes('educatore')) ? def.defaultEnabled : false,
    genitore: (isTutti || def.recipients.includes('genitore')) ? def.defaultEnabled : false,
  };
}

function getRelevantRoles(def: NotificaTypeDefinition): NotifRole[] {
  if (def.recipients.includes('tutti')) return ['admin', 'educatore', 'genitore'];
  return def.recipients.filter((r): r is NotifRole =>
    r === 'admin' || r === 'educatore' || r === 'genitore'
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function GestioneNotifichePage() {
  const firestore = useFirestore();

  const configQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'notification-config') : null),
    [firestore]
  );
  const { data: configData, isLoading } = useCollection<GlobalNotifConfig>(configQuery);

  // Initialise missing configs in Firestore
  useEffect(() => {
    if (!firestore || isLoading || !configData) return;
    const existingIds = new Set(configData.map(c => c.id));
    const batch = writeBatch(firestore);
    let writes = 0;
    NOTIFICA_TYPE_DEFINITIONS.forEach(def => {
      if (!existingIds.has(def.id)) {
        batch.set(doc(firestore, 'notification-config', def.id), {
          id: def.id,
          enabledFor: getDefaultEnabledFor(def),
        });
        writes++;
      } else {
        // Migrate legacy docs that still have `enabled: boolean` instead of `enabledFor`
        const existing = configData.find(c => c.id === def.id);
        if (existing && !existing.enabledFor) {
          batch.set(
            doc(firestore, 'notification-config', def.id),
            { id: def.id, enabledFor: getDefaultEnabledFor(def) },
            { merge: true }
          );
          writes++;
        }
      }
    });
    if (writes > 0) batch.commit().catch(console.error);
  }, [firestore, isLoading, configData]);

  const configMap = useMemo(() => {
    const map = new Map<string, GlobalNotifConfig['enabledFor']>();
    if (configData) {
      configData.forEach(c => {
        if (c.enabledFor) {
          map.set(c.id, c.enabledFor);
        } else {
          // Legacy fallback
          const def = NOTIFICA_TYPE_DEFINITIONS.find(d => d.id === c.id);
          if (def) map.set(c.id, getDefaultEnabledFor(def));
        }
      });
    }
    return map;
  }, [configData]);

  const handleToggleRole = async (id: NotificaEventType, role: NotifRole, enabled: boolean) => {
    if (!firestore) return;
    const current = configMap.get(id) ?? { admin: false, educatore: false, genitore: false };
    const updated = { ...current, [role]: enabled };
    await setDoc(doc(firestore, 'notification-config', id), { id, enabledFor: updated }, { merge: true });
  };

  const byCategory = useMemo(() => getNotificasByCategory(), []);

  const totalEnabled = useMemo(() => {
    let count = 0;
    configMap.forEach(ef => { if (ef.admin || ef.educatore || ef.genitore) count++; });
    return count;
  }, [configMap]);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              Gestione Notifiche
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Attiva o disattiva le notifiche per ogni ruolo in modo indipendente.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-primary">{totalEnabled}</p>
            <p className="text-xs text-muted-foreground">di {NOTIFICA_TYPE_DEFINITIONS.length} attive</p>
          </div>
        </div>

        {/* ── Info banner ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>Come funziona:</strong> Ogni notifica può essere abilitata separatamente per{' '}
            <strong>Admin</strong>, <strong>Educatori</strong> e <strong>Genitori</strong>.
            I ruoli non pertinenti a una specifica notifica appaiono disabilitati.
            Gli utenti possono poi personalizzare ulteriormente le preferenze dalla campanella in alto.
          </div>
        </div>

        {/* ── Role legend ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          {(Object.entries(ROLE_CONFIG) as [NotifRole, typeof ROLE_CONFIG[NotifRole]][]).map(([role, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div key={role} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                <Icon className="h-3.5 w-3.5" />
                <span>{cfg.label}</span>
              </div>
            );
          })}
        </div>

        {/* ── Categories ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Caricamento configurazione...</div>
        ) : (
          Array.from(byCategory.entries()).map(([category, defs]) => {
            const activeCount = defs.filter(d => {
              const ef = configMap.get(d.id);
              return ef ? (ef.admin || ef.educatore || ef.genitore) : d.defaultEnabled;
            }).length;

            return (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{category}</CardTitle>
                  <CardDescription>{activeCount} di {defs.length} attive</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {defs.map(def => {
                      const enabledFor = configMap.get(def.id) ?? getDefaultEnabledFor(def);
                      const anyEnabled = enabledFor.admin || enabledFor.educatore || enabledFor.genitore;
                      const relevantRoles = getRelevantRoles(def);

                      return (
                        <div
                          key={def.id}
                          className={`flex items-center gap-4 px-6 py-4 transition-colors ${!anyEnabled ? 'opacity-60' : ''}`}
                        >
                          {/* Icon */}
                          <div className="text-xl w-8 text-center shrink-0">{def.icon}</div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{def.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
                          </div>

                          {/* Per-role toggles */}
                          <div className="flex items-center gap-4 shrink-0">
                            {(['admin', 'educatore', 'genitore'] as NotifRole[]).map(role => {
                              const cfg = ROLE_CONFIG[role];
                              const Icon = cfg.icon;
                              const isRelevant = relevantRoles.includes(role);
                              const isOn = isRelevant && enabledFor[role];

                              return (
                                <div key={role} className="flex flex-col items-center gap-1.5 w-16">
                                  <div className={`flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap ${isRelevant ? cfg.color : 'text-muted-foreground/30'}`}>
                                    <Icon className="h-3 w-3" />
                                    <span className="hidden sm:inline">{cfg.label}</span>
                                  </div>
                                  <Switch
                                    checked={isOn}
                                    disabled={!isRelevant}
                                    onCheckedChange={v => handleToggleRole(def.id, role, v)}
                                    className={!isRelevant ? 'opacity-20 cursor-not-allowed' : ''}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </TooltipProvider>
  );
}
