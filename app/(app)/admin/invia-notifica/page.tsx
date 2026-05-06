'use client';

import { useState, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Megaphone, Send, Loader2, CheckCircle2, AlertTriangle,
  Users, Shield, GraduationCap, User, Search, X, Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TargetType = 'all' | 'admin' | 'educatore' | 'utente' | 'specific';

interface UserRow {
  id: string;
  displayName?: string;
  email?: string;
  roles?: string[];
}

const TARGET_OPTIONS: { value: TargetType; label: string; description: string; icon: React.ElementType; color: string }[] = [
  {
    value: 'all',
    label: 'Tutti gli utenti',
    description: 'Admin, educatori e genitori/utenti',
    icon: Users,
    color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30',
  },
  {
    value: 'admin',
    label: 'Solo Admin',
    description: 'Solo gli amministratori del sistema',
    icon: Shield,
    color: 'border-red-500 bg-red-50 dark:bg-red-950/30',
  },
  {
    value: 'educatore',
    label: 'Solo Educatori',
    description: 'Solo gli educatori del gruppo',
    icon: GraduationCap,
    color: 'border-purple-500 bg-purple-50 dark:bg-purple-950/30',
  },
  {
    value: 'utente',
    label: 'Solo Utenti',
    description: 'Genitori e tesserati (non educatori/admin)',
    icon: User,
    color: 'border-green-500 bg-green-50 dark:bg-green-950/30',
  },
  {
    value: 'specific',
    label: 'Utenti specifici',
    description: 'Seleziona individualmente i destinatari',
    icon: Search,
    color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30',
  },
];

function getRoleLabel(roles: string[] = []): { label: string; color: string } {
  if (roles.includes('admin')) return { label: 'Admin', color: 'bg-red-100 text-red-700' };
  if (roles.includes('educatore')) return { label: 'Educatore', color: 'bg-purple-100 text-purple-700' };
  if (roles.includes('genitore')) return { label: 'Genitore', color: 'bg-green-100 text-green-700' };
  if (roles.includes('utente')) return { label: 'Utente', color: 'bg-blue-100 text-blue-700' };
  return { label: 'Nessun ruolo', color: 'bg-gray-100 text-gray-600' };
}

export default function InviaNotificaPage() {
  const firestore = useFirestore();

  const usersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: allUsers, isLoading: isLoadingUsers } = useCollection<UserRow>(usersQuery);

  const [target, setTarget] = useState<TargetType>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [href, setHref] = useState('');
  const [includeHref, setIncludeHref] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [result, setResult] = useState<{ recipients?: number; error?: string } | null>(null);

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allUsers;
    return allUsers.filter(u =>
      (u.displayName?.toLowerCase().includes(q)) ||
      (u.email?.toLowerCase().includes(q))
    );
  }, [allUsers, searchQuery]);

  const toggleUser = (uid: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const canSend = title.trim().length > 0 && body.trim().length > 0 && (
    target !== 'specific' || selectedUserIds.size > 0
  );

  const handleSend = async () => {
    if (!canSend) return;
    setStatus('loading');
    setResult(null);
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) throw new Error('Utente non autenticato');
      const idToken = await currentUser.getIdToken();

      const payload: any = {
        title: title.trim(),
        body: body.trim(),
        target,
      };
      if (includeHref && href.trim()) payload.href = href.trim();
      if (target === 'specific') payload.userIds = Array.from(selectedUserIds);

      const res = await fetch('/api/send-custom-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore durante l\'invio');

      setStatus('ok');
      setResult({ recipients: data.recipients });
      // Reset form after success
      setTimeout(() => {
        setTitle('');
        setBody('');
        setHref('');
        setIncludeHref(false);
        setSelectedUserIds(new Set());
        setStatus('idle');
        setResult(null);
      }, 4000);
    } catch (err: any) {
      setStatus('error');
      setResult({ error: err.message });
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Invia Notifica</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Invia una comunicazione personalizzata a tutti gli utenti o a gruppi specifici.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: form */}
        <div className="flex flex-col gap-5">

          {/* Destinatari */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Destinatari</CardTitle>
              <CardDescription className="text-xs">Seleziona chi riceverà la notifica</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              {TARGET_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const selected = target === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setTarget(opt.value); setSelectedUserIds(new Set()); }}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all hover:border-primary/50',
                      selected ? opt.color + ' border-current' : 'border-border'
                    )}
                  >
                    <Icon className={cn('h-5 w-5 shrink-0', selected ? 'text-current' : 'text-muted-foreground')} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-semibold leading-tight', selected ? '' : 'text-foreground')}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                    {selected && (
                      <div className="h-5 w-5 rounded-full border-2 border-current flex items-center justify-center shrink-0">
                        <div className="h-2.5 w-2.5 rounded-full bg-current" />
                      </div>
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Utenti specifici picker */}
          {target === 'specific' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Seleziona utenti</span>
                  {selectedUserIds.size > 0 && (
                    <Badge variant="secondary">{selectedUserIds.size} selezionati</Badge>
                  )}
                </CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca per nome o email..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-60">
                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center h-full py-8 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Caricamento utenti...
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">Nessun utente trovato</div>
                  ) : (
                    <div className="divide-y">
                      {filteredUsers.map(u => {
                        const selected = selectedUserIds.has(u.id);
                        const { label, color } = getRoleLabel(u.roles);
                        return (
                          <button
                            key={u.id}
                            onClick={() => toggleUser(u.id)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                              selected && 'bg-primary/5'
                            )}
                          >
                            <div className={cn(
                              'h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                              selected ? 'border-primary bg-primary' : 'border-border'
                            )}>
                              {selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-tight truncate">
                                {u.displayName ?? 'Utente senza nome'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', color)}>
                              {label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
                {selectedUserIds.size > 0 && (
                  <div className="border-t px-4 py-2 flex items-center justify-between bg-muted/20">
                    <span className="text-xs text-muted-foreground">{selectedUserIds.size} utente/i selezionati</span>
                    <button
                      onClick={() => setSelectedUserIds(new Set())}
                      className="text-xs text-destructive hover:underline"
                    >
                      Deseleziona tutti
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: contenuto notifica */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contenuto notifica</CardTitle>
              <CardDescription className="text-xs">Il messaggio che verrà recapitato agli utenti</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notif-title" className="text-sm">Titolo <span className="text-destructive">*</span></Label>
                <Input
                  id="notif-title"
                  placeholder="Es. Comunicazione importante dalla segreteria"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={80}
                />
                <span className="text-[10px] text-muted-foreground text-right">{title.length}/80</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notif-body" className="text-sm">Messaggio <span className="text-destructive">*</span></Label>
                <Textarea
                  id="notif-body"
                  placeholder="Scrivi il testo della notifica..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={4}
                  maxLength={300}
                  className="resize-none"
                />
                <span className="text-[10px] text-muted-foreground text-right">{body.length}/300</span>
              </div>

              <div className="flex items-center gap-3 border rounded-lg px-4 py-3 bg-muted/20">
                <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">Link alla pagina</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pagina che si apre cliccando la notifica</p>
                </div>
                <Switch
                  checked={includeHref}
                  onCheckedChange={setIncludeHref}
                />
              </div>

              {includeHref && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="notif-href" className="text-sm">URL destinazione</Label>
                  <Input
                    id="notif-href"
                    placeholder="Es. /calendario o /contabilita/raccolte"
                    value={href}
                    onChange={e => setHref(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">Inserisci un percorso relativo (es. /dashboard)</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          {(title || body) && (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-normal">Anteprima notifica</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                  <div className="rounded-full p-2 text-sm shrink-0 bg-green-500/10 text-green-600">📢</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">{title || 'Titolo notifica'}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{body || 'Testo della notifica...'}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Adesso</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Riepilogo */}
          <Card className="bg-muted/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-muted-foreground text-xs">
                  La notifica verrà inviata immediatamente come messaggio in-app e come notifica push ai dispositivi registrati.
                  {target === 'all' && ' Verrà consegnata a tutti gli utenti registrati.'}
                  {target === 'admin' && ' Verrà consegnata solo agli amministratori.'}
                  {target === 'educatore' && ' Verrà consegnata solo agli educatori.'}
                  {target === 'utente' && ' Verrà consegnata agli utenti/genitori.'}
                  {target === 'specific' && selectedUserIds.size > 0 && ` Verrà consegnata a ${selectedUserIds.size} utente/i selezionati.`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Feedback invio */}
          {status === 'ok' && result?.recipients !== undefined && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-200">Notifica inviata con successo!</p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                  Consegnata a {result.recipients} destinatario/i.
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-semibold text-destructive">Errore durante l'invio</p>
                <p className="text-xs text-destructive/80 mt-0.5">{result?.error ?? 'Si è verificato un problema imprevisto.'}</p>
              </div>
            </div>
          )}

          <Button
            size="lg"
            className="gap-2 w-full"
            disabled={!canSend || status === 'loading'}
            onClick={handleSend}
          >
            {status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === 'ok' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {status === 'loading' ? 'Invio in corso...' : status === 'ok' ? 'Inviata!' : 'Invia notifica'}
          </Button>
        </div>
      </div>
    </div>
  );
}
