'use client';

import { useMemo, useState, useCallback } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, query, where, orderBy, collectionGroup, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import type { Progetto } from '@/app/(app)/progetti/page';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  Camera,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FlaskConical,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Messaggio {
  id: string; ref?: any;
  text: string; scheduledAt: any; status: string; createdBy?: string;
}

interface SocialPost {
  id: string; ref?: any;
  imageUrl?: string; thumbnailUrl?: string; imageName?: string;
  caption: string; scheduledAt: any; status: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(d: any) {
  if (!d) return '-';
  const date = d.toDate ? d.toDate() : new Date(d);
  return format(date, 'EEE d MMM · HH:mm', { locale: it });
}

function getDateObj(d: any): Date {
  return d?.toDate ? d.toDate() : new Date(d);
}

const STATUS_MSG = {
  pianificato: { label: 'Da inviare', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  inviato:     { label: 'Inviato',    color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  scartato:    { label: 'Scartato',   color: 'bg-gray-100 text-gray-500 border-gray-200', icon: XCircle },
};

const STATUS_POST = {
  pianificato: { label: 'Da pubblicare', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  pubblicato:  { label: 'Pubblicato',    color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  scartato:    { label: 'Scartato',      color: 'bg-gray-100 text-gray-500 border-gray-200', icon: XCircle },
};

// ── Quick Photo Upload ─────────────────────────────────────────────────────────

function QuickPhotoUpload({
  progetti,
  selectedProjectId,
  onSelectProject,
}: {
  progetti: Progetto[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProject = progetti.find(p => p.id === selectedProjectId);

  const uploadFiles = async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) { setError('Seleziona solo immagini'); return; }
    if (!selectedProject?.driveFolderId) {
      setError('Questo progetto non ha ancora una cartella Drive. Apri prima il progetto e vai su "Foto".');
      return;
    }
    setIsUploading(true); setError(null); setSuccess(false); setProgress(0);
    try {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', selectedProject.driveFolderId);
        formData.append('name', file.name);
        const res = await fetch('/api/drive/photos', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Errore');
        setProgress(Math.round(((i + 1) / imageFiles.length) * 100));
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false); setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="h-5 w-5 text-muted-foreground" />
          Caricamento Rapido Foto
        </CardTitle>
        <CardDescription>Seleziona un progetto e carica foto direttamente su Drive.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Project selector */}
        <div className="flex flex-wrap gap-2">
          {progetti.map(p => (
            <button
              key={p.id}
              onClick={() => onSelectProject(p.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-sm font-medium transition-all',
                selectedProjectId === p.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Drop area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            'rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all',
            dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30',
            isUploading && 'pointer-events-none opacity-60'
          )}
        >
          {isUploading ? (
            <div className="space-y-2">
              <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin" />
              <p className="text-sm font-medium">Caricamento... {progress}%</p>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : success ? (
            <div className="space-y-2 text-green-600">
              <CheckCircle2 className="h-8 w-8 mx-auto" />
              <p className="text-sm font-medium">Foto caricate con successo!</p>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">Trascina foto o clicca</p>
              {selectedProject && (
                <p className="text-xs mt-1 text-muted-foreground/60">
                  Progetto: <span className="font-medium">{selectedProject.name}</span>
                </p>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={e => uploadFiles(Array.from(e.target.files ?? []))} />
      </CardContent>
    </Card>
  );
}

// ── Task Card ──────────────────────────────────────────────────────────────────

function TaskCard({
  type,
  item,
  projectName,
  projectSlug,
  onDiscard,
}: {
  type: 'messaggio' | 'post';
  item: Messaggio | SocialPost;
  projectName: string;
  projectSlug: string;
  onDiscard: () => void;
}) {
  const statusMap = type === 'messaggio' ? STATUS_MSG : STATUS_POST;
  const status = (item.status || 'pianificato') as keyof typeof statusMap;
  const cfg = statusMap[status] || statusMap.pianificato;
  const StatusIcon = cfg.icon;
  const date = getDateObj(item.scheduledAt);
  const isUrgent = isAfter(addDays(new Date(), 3), date) && isBefore(new Date(), date);

  return (
    <div className={cn(
      'rounded-xl border p-4 flex items-start gap-4 transition-all',
      isUrgent && status === 'pianificato' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20' : 'bg-card'
    )}>
      {/* Icon */}
      <div className={cn(
        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
        type === 'messaggio' ? 'bg-green-100' : 'bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-yellow-500/20'
      )}>
        {type === 'messaggio' ? (
          <MessageCircle className="h-5 w-5 text-green-700" />
        ) : (
          <span className="text-base">📸</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {type === 'messaggio' ? 'WhatsApp' : 'Instagram'}
          </span>
          <Link href={`/progetti/${projectSlug}`} className="text-xs text-primary hover:underline flex items-center gap-1">
            <FlaskConical className="h-3 w-3" />
            {projectName}
          </Link>
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ml-auto', cfg.color)}>
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </span>
        </div>
        <p className="text-sm mt-1 line-clamp-2 leading-relaxed">
          {type === 'messaggio' ? (item as Messaggio).text : (item as SocialPost).caption}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(item.scheduledAt)}
          </span>
          {isUrgent && status === 'pianificato' && (
            <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px]">
              ⚡ Urgente
            </Badge>
          )}
        </div>
      </div>

      {/* Discard */}
      {status === 'pianificato' && (
        <button
          onClick={onDiscard}
          className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-1"
          title="Scarta task"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SocialMediaPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData, isLoading: isUserLoading } = useUserData();

  const isAdmin = useMemo(() => userData?.roles?.includes('admin') ?? false, [userData]);
  const isEducatore = useMemo(() => userData?.roles?.includes('educatore') ?? false, [userData]);

  // My groups (for filtering)
  const myGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !userData) return null;
    if (isAdmin) return collection(firestore, 'gruppi');
    if (isEducatore) return query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid));
    return null;
  }, [firestore, user, userData, isAdmin, isEducatore]);
  const { data: myGroups } = useCollection<Group>(myGroupsQuery);

  // Active projects
  const progettiQuery = useMemoFirebase(() => firestore
    ? query(collection(firestore, 'progetti'), where('status', '!=', 'archiviato'), orderBy('status'), orderBy('createdAt', 'desc'))
    : null, [firestore]);
  const { data: allProgetti, isLoading: isLoadingProgetti } = useCollection<Progetto>(progettiQuery);

  const progetti = useMemo(() => {
    if (!allProgetti || !userData) return [];
    if (isAdmin) return allProgetti;
    if (isEducatore && myGroups) {
      const gids = new Set(myGroups.map(g => g.id));
      return allProgetti.filter(p => p.groupIds?.some(gid => gids.has(gid)));
    }
    return [];
  }, [allProgetti, userData, isAdmin, isEducatore, myGroups]);

  // Messages from subcollections
  const messaggiQuery = useMemoFirebase(() => firestore ? collectionGroup(firestore, 'messaggi') : null, [firestore]);
  const { data: allMessaggi } = useCollection<Messaggio>(messaggiQuery, { includeRef: true } as any);

  // Social posts from subcollections
  const postsQuery = useMemoFirebase(() => firestore ? collectionGroup(firestore, 'social-posts') : null, [firestore]);
  const { data: allPosts } = useCollection<SocialPost>(postsQuery, { includeRef: true } as any);

  const projectIds = useMemo(() => new Set(progetti.map(p => p.id)), [progetti]);
  const projectById = useMemo(() => new Map(progetti.map(p => [p.id, p])), [progetti]);

  // Quick upload selected project
  const [quickUploadProjectId, setQuickUploadProjectId] = useState('');
  const defaultProject = progetti[0];
  const effectiveUploadId = quickUploadProjectId || defaultProject?.id || '';

  // Build unified tasks
  const tasks = useMemo(() => {
    const list: { type: 'messaggio' | 'post'; item: any; projectId: string; scheduledAt: Date }[] = [];

    (allMessaggi ?? []).forEach((msg: any) => {
      const projectId = msg.ref?.parent?.parent?.id;
      if (!projectId || !projectIds.has(projectId) || msg.status === 'scartato') return;
      list.push({ type: 'messaggio', item: msg, projectId, scheduledAt: getDateObj(msg.scheduledAt) });
    });

    (allPosts ?? []).forEach((post: any) => {
      const projectId = post.ref?.parent?.parent?.id;
      if (!projectId || !projectIds.has(projectId) || post.status === 'scartato') return;
      list.push({ type: 'post', item: post, projectId, scheduledAt: getDateObj(post.scheduledAt) });
    });

    return list.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }, [allMessaggi, allPosts, projectIds]);

  const pendingTasks = useMemo(() => tasks.filter(t => t.item.status === 'pianificato'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.item.status !== 'pianificato'), [tasks]);

  const handleDiscard = useCallback(async (task: typeof tasks[0]) => {
    if (!firestore) return;
    try {
      const ref = task.item.ref;
      if (ref) await updateDoc(ref, { status: 'scartato' });
    } catch (err) { console.error(err); }
  }, [firestore]);

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin && !isEducatore) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Accesso consentito solo a educatori e amministratori.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-500 flex items-center justify-center">
            <span className="text-white text-xl">📱</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Social Media</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gestisci foto, messaggi e post per tutti i progetti · {progetti.length} progetti attivi
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList className="mb-4">
          <TabsTrigger value="tasks">
            Task
            {pendingTasks.length > 0 && (
              <span className="ml-2 h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                {pendingTasks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="progetti">Progetti</TabsTrigger>
          <TabsTrigger value="foto">Carica Foto</TabsTrigger>
        </TabsList>

        {/* ── TASK CRONOLOGICHE ── */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Task in Sospeso
              </CardTitle>
              <CardDescription>
                Messaggi WhatsApp e post Instagram pianificati da inviare/pubblicare, in ordine cronologico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30 text-green-500" />
                  <p className="text-sm">Nessuna task in sospeso. Ottimo lavoro! 🎉</p>
                </div>
              ) : (
                pendingTasks.map((task, idx) => {
                  const project = projectById.get(task.projectId);
                  if (!project) return null;
                  return (
                    <TaskCard
                      key={`${task.type}-${task.item.id}-${idx}`}
                      type={task.type}
                      item={task.item}
                      projectName={project.name}
                      projectSlug={project.slug}
                      onDiscard={() => handleDiscard(task)}
                    />
                  );
                })
              )}
            </CardContent>
          </Card>

          {doneTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Completate
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {doneTasks.map((task, idx) => {
                  const project = projectById.get(task.projectId);
                  if (!project) return null;
                  return (
                    <TaskCard
                      key={`done-${task.type}-${task.item.id}-${idx}`}
                      type={task.type}
                      item={task.item}
                      projectName={project.name}
                      projectSlug={project.slug}
                      onDiscard={() => handleDiscard(task)}
                    />
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── PROGETTI ── */}
        <TabsContent value="progetti">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Panoramica Progetti</CardTitle>
              <CardDescription>
                Clicca su un progetto per gestire foto, messaggi e post social.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingProgetti ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : progetti.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nessun progetto attivo trovato.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {progetti.map(progetto => {
                    const projectTasks = tasks.filter(t => t.projectId === progetto.id && t.item.status === 'pianificato');
                    const msgCount = projectTasks.filter(t => t.type === 'messaggio').length;
                    const postCount = projectTasks.filter(t => t.type === 'post').length;

                    return (
                      <div key={progetto.id} className="rounded-xl border p-4 hover:border-primary transition-colors group">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <FlaskConical className="h-4 w-4 text-primary" />
                            </div>
                            <p className="text-sm font-semibold line-clamp-1">{progetto.name}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          {msgCount > 0 && (
                            <Badge variant="outline" className="text-[10px] text-green-700 border-green-200 gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {msgCount} messaggi
                            </Badge>
                          )}
                          {postCount > 0 && (
                            <Badge variant="outline" className="text-[10px] text-purple-700 border-purple-200 gap-1">
                              <span className="text-[10px]">📸</span>
                              {postCount} post
                            </Badge>
                          )}
                          {msgCount === 0 && postCount === 0 && (
                            <span className="text-[10px] text-muted-foreground">Nessuna task</span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          <Link href={`/progetti/${progetto.slug}?tab=foto`}>
                            <Button variant="outline" size="sm" className="w-full text-[11px] gap-1">
                              <Camera className="h-3 w-3" /> Foto
                            </Button>
                          </Link>
                          <Link href={`/progetti/${progetto.slug}?tab=messaggi`}>
                            <Button variant="outline" size="sm" className="w-full text-[11px] gap-1">
                              <MessageCircle className="h-3 w-3" /> Msg
                            </Button>
                          </Link>
                          <Link href={`/progetti/${progetto.slug}?tab=social`}>
                            <Button variant="outline" size="sm" className="w-full text-[11px] gap-1">
                              <span className="text-[10px]">IG</span> Post
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CARICAMENTO FOTO ── */}
        <TabsContent value="foto">
          <QuickPhotoUpload
            progetti={progetti}
            selectedProjectId={effectiveUploadId}
            onSelectProject={setQuickUploadProjectId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
