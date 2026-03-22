'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertCircle,
  CheckCheck,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useUserData } from '@/src/hooks/use-user-data';

interface Messaggio {
  id: string;
  text: string;
  scheduledAt: any;
  sentAt?: any;
  status: 'pianificato' | 'inviato' | 'scartato';
  createdBy: string;
  createdAt: any;
}

interface MessagePlannerProps {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  projectStartDate?: string;
  projectEndDate?: string;
  canEdit: boolean;
}

const STATUS_CONFIG = {
  pianificato: { label: 'Pianificato', icon: Clock,  color: 'bg-amber-100 text-amber-800 border-amber-200' },
  inviato:     { label: 'Inviato',     icon: CheckCheck, color: 'bg-green-100 text-green-800 border-green-200' },
  scartato:    { label: 'Scartato',    icon: XCircle, color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

function buildWaLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function formatScheduledDate(date: any) {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
  const timeStr = format(d, 'HH:mm', { locale: it });
  const dateStr = format(d, 'EEE d MMM', { locale: it });
  if (diffDays === 0) return `Oggi · ${timeStr}`;
  if (diffDays === 1) return `Domani · ${timeStr}`;
  return `${dateStr} · ${timeStr}`;
}

function formatBubbleDate(date: any) {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  return format(d, 'EEEE d MMMM', { locale: it });
}

export default function MessagePlanner({ projectId, projectName, projectDescription, projectStartDate, projectEndDate, canEdit }: MessagePlannerProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData } = useUserData();

  // Firestore messages subcollection
  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !projectId) return null;
    return query(collection(firestore, 'progetti', projectId, 'messaggi'), orderBy('scheduledAt', 'asc'));
  }, [firestore, projectId]);
  const { data: messaggi, isLoading } = useCollection<Messaggio>(messagesQuery);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI suggestions
  const [aiContext, setAiContext] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const openDialog = () => {
    setMessageText('');
    setScheduledDate('');
    setScheduledTime('18:00');
    setAiContext('');
    setAiSuggestions([]);
    setError(null);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !user || !messageText.trim() || !scheduledDate || !scheduledTime) return;
    setIsSaving(true);
    setError(null);
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
      await addDoc(collection(firestore, 'progetti', projectId, 'messaggi'), {
        text: messageText.trim(),
        scheduledAt,
        status: 'pianificato',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setIsDialogOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (msgId: string, status: Messaggio['status']) => {
    if (!firestore) return;
    try {
      const ref = doc(firestore, 'progetti', projectId, 'messaggi', msgId);
      const update: any = { status };
      if (status === 'inviato') update.sentAt = serverTimestamp();
      await updateDoc(ref, update);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleGetAiSuggestions = async () => {
    setIsLoadingAI(true);
    setAiError(null);
    setAiSuggestions([]);
    try {
      // Collect last 5 sent messages as learning examples
      const sentMessages = (messaggi ?? [])
        .filter(m => m.status === 'inviato')
        .slice(-5)
        .map(m => m.text);

      const res = await fetch('/api/ai/whatsapp-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          projectDescription,
          projectDate: [projectStartDate, projectEndDate].filter(Boolean).join(' → '),
          context: aiContext,
          previousMessages: sentMessages,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore AI');
      setAiSuggestions(data.suggestions || []);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const visibleMessages = (messaggi ?? []).filter(m => m.status !== 'scartato');

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Messaggi WhatsApp
            </CardTitle>
            <CardDescription>
              Pianifica i messaggi da inviare ai partecipanti. Visualizza promemoria con data e ora.
            </CardDescription>
          </div>
          {canEdit && (
            <Button size="sm" onClick={openDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Messaggio
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && visibleMessages.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nessun messaggio pianificato.</p>
              {canEdit && (
                <p className="text-xs mt-1">Clicca "Nuovo Messaggio" per aggiungerne uno.</p>
              )}
            </div>
          )}

          {/* WhatsApp-style chat */}
          {!isLoading && visibleMessages.length > 0 && (
            <div className="space-y-6">
              <div className="rounded-2xl overflow-hidden border bg-[#ECE5DD] dark:bg-zinc-900 p-4 space-y-4">
                {visibleMessages.map((msg, idx) => {
                  const prevMsg = visibleMessages[idx - 1];
                  const scheduledDate = msg.scheduledAt?.toDate ? msg.scheduledAt.toDate() : new Date(msg.scheduledAt);
                  const prevDate = prevMsg?.scheduledAt?.toDate ? prevMsg.scheduledAt.toDate() : null;
                  const showDateHeader = !prevMsg || (prevDate && format(scheduledDate, 'yyyy-MM-dd') !== format(prevDate, 'yyyy-MM-dd'));
                  const cfg = STATUS_CONFIG[msg.status] || STATUS_CONFIG.pianificato;
                  const StatusIcon = cfg.icon;

                  return (
                    <div key={msg.id}>
                      {/* Date separator */}
                      {showDateHeader && (
                        <div className="flex justify-center mb-2">
                          <span className="bg-white/80 dark:bg-zinc-800 text-xs text-muted-foreground px-3 py-1 rounded-full shadow-sm capitalize">
                            {formatBubbleDate(msg.scheduledAt)}
                          </span>
                        </div>
                      )}
                      {/* Message bubble */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] space-y-1">
                          <div className="bg-[#DCF8C6] dark:bg-green-900 rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-100">
                              {msg.text}
                            </p>
                            <div className="flex items-center justify-end gap-1 mt-1.5">
                              <span className="text-[10px] text-gray-500">
                                {format(scheduledDate, 'HH:mm')}
                              </span>
                              {msg.status === 'inviato' && (
                                <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                              )}
                            </div>
                          </div>
                          {/* Actions row */}
                          <div className="flex items-center justify-end gap-2">
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1', cfg.color)}>
                              <StatusIcon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                            {canEdit && msg.status === 'pianificato' && (
                              <>
                                <a
                                  href={buildWaLink(msg.text)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-green-700 dark:text-green-400 hover:underline"
                                  onClick={() => handleStatusChange(msg.id, 'inviato')}
                                >
                                  <Send className="h-3 w-3" />
                                  Apri in WhatsApp
                                </a>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(msg.text);
                                    handleStatusChange(msg.id, 'inviato');
                                  }}
                                  className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                                  title="Copia testo negli appunti"
                                >
                                  <Copy className="h-3 w-3" />
                                  Copia testo
                                </button>
                                <button
                                  onClick={() => handleStatusChange(msg.id, 'scartato')}
                                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                                  title="Scarta messaggio"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reminder note */}
              <p className="text-xs text-center text-muted-foreground">
                💡 Il pulsante "Apri in WhatsApp" segna il messaggio come inviato e apre l'app con il testo precompilato.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Message Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Nuovo Messaggio WhatsApp
            </DialogTitle>
            <DialogDescription>
              Pianifica un messaggio con data e ora di invio come promemoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* AI Suggestions */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Suggerimenti AI
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Es: cena pizza venerdì sera, contributo 5€... (opzionale)"
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGetAiSuggestions()}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGetAiSuggestions}
                  disabled={isLoadingAI}
                  title="Genera suggerimenti AI"
                >
                  {isLoadingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </Button>
              </div>
              {aiError && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    Chiave AI non configurata
                  </p>
                  <p className="text-xs text-amber-700">
                    Per usare i suggerimenti AI, ottieni una chiave gratuita su{' '}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                      aistudio.google.com
                    </a>
                    {' '}e aggiungila come <code className="bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> nel file <code className="bg-amber-100 px-1 rounded">.env.local</code>, poi riavvia il server.
                  </p>
                </div>
              )}
              {aiSuggestions.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {aiSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setMessageText(s)}
                      className="w-full text-left p-3 rounded-lg bg-white dark:bg-zinc-800 border hover:border-primary hover:bg-primary/5 transition-all text-xs leading-relaxed"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Message text */}
            <div className="space-y-1.5">
              <Label>Testo del messaggio</Label>
              <Textarea
                placeholder="Scrivi il messaggio da inviare ai genitori..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data di invio</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ora</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Annulla
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !messageText.trim() || !scheduledDate || !scheduledTime}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Clock className="mr-2 h-4 w-4" />
              Pianifica Messaggio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
