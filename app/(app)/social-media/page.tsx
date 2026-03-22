'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, query, where, orderBy, collectionGroup, updateDoc, doc } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import type { Progetto } from '@/app/(app)/progetti/page';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConsensoAlert } from '@/components/consenso-alert';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import SocialPlanner from '@/components/social-planner';
import {
  AlertCircle,
  Camera,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Eye,
  ExternalLink,
  FlaskConical,
  ImageOff,
  Loader2,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SocialPost {
  id: string; ref?: any;
  imageUrl?: string; thumbnailUrl?: string; imageName?: string;
  caption: string; scheduledAt: any;
  status: 'pianificato' | 'pubblicato' | 'scartato';
}

interface DrivePhoto {
  id: string; name: string; mimeType: string;
  webViewLink: string; thumbnailLink?: string;
  modifiedTime: string;
}

// ── localStorage helpers ───────────────────────────────────────────────────────

const HIDDEN_KEY = 'socialMedia_hiddenProjects';

function loadHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveHidden(set: Set<string>) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(set)));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDateObj(d: any): Date {
  return d?.toDate ? d.toDate() : new Date(d);
}

function formatDateShort(d: any) {
  const date = getDateObj(d);
  return format(date, 'd MMM · HH:mm', { locale: it });
}

function formatRange(start: any, end: any) {
  if (!start) return '';
  const s = getDateObj(start);
  const e = end ? getDateObj(end) : null;
  const sf = format(s, 'd MMM yyyy', { locale: it });
  if (!e || format(s, 'yyyy-MM-dd') === format(e, 'yyyy-MM-dd')) return sf;
  return `${sf} → ${format(e, 'd MMM yyyy', { locale: it })}`;
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectSocialCard({
  project,
  posts,
  groups,
  isHidden,
  onToggleHide,
}: {
  project: Progetto;
  posts: SocialPost[];
  groups: Group[];
  isHidden: boolean;
  onToggleHide: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firestore = useFirestore();

  const projectGroups = useMemo(
    () => (project.groupIds ?? []).map(id => groups.find(g => g.id === id)?.name).filter(Boolean),
    [project.groupIds, groups]
  );

  const upcomingPosts = useMemo(
    () => posts
      .filter(p => p.status === 'pianificato')
      .sort((a, b) => getDateObj(a.scheduledAt).getTime() - getDateObj(b.scheduledAt).getTime())
      .slice(0, 5),
    [posts]
  );

  const publishedCount = posts.filter(p => p.status === 'pubblicato').length;

  // Load photos when expanded and folderId is available
  useEffect(() => {
    if (!isExpanded || !project.driveFolderId) return;
    setIsLoadingPhotos(true);
    fetch(`/api/drive/photos?folderId=${project.driveFolderId}`)
      .then(r => r.json())
      .then(d => setPhotos(d.files ?? []))
      .catch(() => {})
      .finally(() => setIsLoadingPhotos(false));
  }, [isExpanded, project.driveFolderId]);

  const uploadFiles = async (files: File[]) => {
    if (!project.driveFolderId || files.length === 0) return;
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (imgs.length === 0) { setUploadError('Seleziona solo immagini'); return; }

    setIsUploading(true); setUploadError(null); setUploadSuccess(false); setUploadProgress(0);
    try {
      for (let i = 0; i < imgs.length; i++) {
        const fd = new FormData();
        fd.append('file', imgs[i]);
        fd.append('folderId', project.driveFolderId!);
        fd.append('name', imgs[i].name);
        const res = await fetch('/api/drive/photos', { method: 'POST', body: fd });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Errore'); }
        setUploadProgress(Math.round(((i + 1) / imgs.length) * 100));
      }
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      // Reload photos
      const r = await fetch(`/api/drive/photos?folderId=${project.driveFolderId}`);
      const d = await r.json();
      setPhotos(d.files ?? []);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false); setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async () => {
    if (!firestore) return;
    setIsCreatingFolder(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/drive/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, projectName: project.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore creazione cartella');
      await updateDoc(doc(firestore, 'progetti', project.id), { driveFolderId: data.folderId });
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  return (
    <div className={cn(
      'rounded-2xl border bg-card transition-all duration-200',
      isHidden && 'opacity-50 scale-[0.99]'
    )}>
      {/* ── Header ── */}
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-yellow-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <FlaskConical className="h-5 w-5 text-purple-600" />
        </div>

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm leading-tight">{project.name}</h3>
              {(project.startDate || project.endDate) && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatRange(project.startDate, project.endDate)}
                </p>
              )}
            </div>
            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onToggleHide}
                className={cn(
                  'p-1.5 rounded-lg transition-colors text-muted-foreground',
                  isHidden ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'hover:bg-muted hover:text-foreground'
                )}
                title={isHidden ? 'Mostra progetto' : 'Nascondi progetto'}
              >
                {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsExpanded(v => !v)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {projectGroups.map(g => (
              <Badge key={g} variant="secondary" className="text-[10px] h-5">{g}</Badge>
            ))}
            {upcomingPosts.length > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 text-purple-700 border-purple-200 gap-1">
                <Camera className="h-2.5 w-2.5" /> {upcomingPosts.length} post in sospeso
              </Badge>
            )}
            {publishedCount > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 text-green-700 border-green-200 gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" /> {publishedCount} pubblicati
              </Badge>
            )}
            {photos.length > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 text-blue-700 border-blue-200 gap-1">
                <Camera className="h-2.5 w-2.5" /> {photos.length} foto
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4">

          {/* Consent warning */}
          {(project.groupIds ?? []).length > 0 && (
            <ConsensoAlert groupIds={project.groupIds} type="social" />
          )}

          {/* ── Photos section ── */}
          {project.driveFolderId ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Foto caricate
                </p>
                <div className="flex items-center gap-2">
                  {isUploading && (
                    <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    Carica foto
                  </button>
                </div>
              </div>

              {uploadError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{uploadError}
                </p>
              )}
              {uploadSuccess && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Foto caricate!
                </p>
              )}

              {isLoadingPhotos ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Caricamento foto...
                </div>
              ) : photos.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed p-4 text-center text-muted-foreground">
                  <ImageOff className="h-6 w-6 mx-auto mb-1 opacity-30" />
                  <p className="text-xs">Nessuna foto ancora caricata</p>
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-1.5">
                  {photos.slice(0, 11).map(photo => {
                    const thumb = photo.thumbnailLink?.replace('=s220', '=s300');
                    return (
                      <a
                        key={photo.id}
                        href={photo.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded-lg overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all block"
                      >
                        {thumb ? (
                          <img src={thumb} alt={photo.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </a>
                    );
                  })}
                  {/* "+N" if more than 11 */}
                  {photos.length > 11 && (
                    <a
                      href={`/progetti/${project.slug}?tab=foto`}
                      className="aspect-square rounded-lg overflow-hidden border bg-muted hover:bg-muted/80 transition-all flex items-center justify-center text-xs font-semibold text-muted-foreground"
                    >
                      +{photos.length - 11}
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed p-4 text-center text-muted-foreground space-y-1">
              <Camera className="h-6 w-6 mx-auto opacity-30 mb-2" />
              <p className="text-xs font-medium">Cartella Drive non collegata</p>
              <p className="text-[10px] pb-2">Non puoi caricare nulla senza prima aver generato la cartella Drive del progetto.</p>
              {uploadError && <p className="text-xs text-destructive pb-2">{uploadError}</p>}
              <Button 
                onClick={handleCreateFolder} 
                disabled={isCreatingFolder}
                size="sm" 
                variant="outline" 
                className="text-xs h-7"
              >
                {isCreatingFolder ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                Genera cartella Drive
              </Button>
            </div>
          )}

          {/* ── Upcoming posts ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Post pianificati
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="h-3 w-3" /> Nuovo post
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl w-[90vw] p-0 border-0 bg-transparent shadow-none [&>button]:hidden">
                  <div className="max-h-[85vh] overflow-y-auto rounded-xl">
                    <SocialPlanner 
                      projectId={project.id} 
                      projectName={project.name} 
                      projectDescription={project.description}
                      projectStartDate={project.startDate}
                      projectEndDate={project.endDate}
                      groupIds={project.groupIds}
                      canEdit={true}
                      availablePhotos={photos} 
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {upcomingPosts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nessun post pianificato. 
                 Clicca "+ Nuovo post" per crearne uno ora.
              </p>
            ) : (
              <div className="space-y-1.5">
                {upcomingPosts.map(post => {
                  const thumb = post.thumbnailUrl;
                  return (
                    <div key={post.id} className="flex items-center gap-3 rounded-lg border p-2.5 bg-muted/30">
                      {/* Thumbnail */}
                      <div className="h-10 w-10 rounded-md overflow-hidden shrink-0 bg-muted border">
                        {thumb ? (
                          <img src={thumb} alt={post.imageName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      {/* Caption + date */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-tight line-clamp-1 font-medium">
                          {post.caption || <span className="text-muted-foreground italic">Nessuna caption</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatDateShort(post.scheduledAt)}
                        </p>
                      </div>
                      {/* Badge */}
                      <Badge className="text-[9px] h-4 bg-blue-100 text-blue-700 border-blue-200 shrink-0 font-normal">
                        Da pubblicare
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-2 pt-1 border-t">
            <Link href={`/progetti/${project.slug}?tab=social`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                <ExternalLink className="h-3 w-3" />
                Apri progetto completo
              </Button>
            </Link>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={e => uploadFiles(Array.from(e.target.files ?? []))}
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SocialMediaPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData, isLoading: isUserLoading } = useUserData();

  const isAdmin = useMemo(() => userData?.roles?.includes('admin') ?? false, [userData]);
  const isEducatore = useMemo(() => userData?.roles?.includes('educatore') ?? false, [userData]);

  // Hidden projects (persisted in localStorage)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    setHiddenIds(loadHidden());
  }, []);

  const toggleHide = useCallback((id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveHidden(next);
      return next;
    });
  }, []);

  // Groups
  const myGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !userData) return null;
    if (isAdmin) return collection(firestore, 'gruppi');
    if (isEducatore) return query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid));
    return null;
  }, [firestore, user, userData, isAdmin, isEducatore]);
  const { data: myGroups } = useCollection<Group>(myGroupsQuery);

  // Projects — all active, filtered client-side
  const progettiQuery = useMemoFirebase(() => firestore
    ? query(collection(firestore, 'progetti'), orderBy('createdAt', 'desc'))
    : null, [firestore]);
  const { data: allProgetti, isLoading: isLoadingProgetti } = useCollection<Progetto>(progettiQuery);

  const progetti = useMemo(() => {
    const active = (allProgetti ?? []).filter(p => p.status !== 'archiviato');
    if (!userData) return [];
    if (isAdmin) return active;
    if (isEducatore && myGroups) {
      const gids = new Set(myGroups.map(g => g.id));
      return active.filter(p => p.groupIds?.some(gid => gids.has(gid)));
    }
    return [];
  }, [allProgetti, userData, isAdmin, isEducatore, myGroups]);

  // Social posts — collectionGroup
  const postsQuery = useMemoFirebase(() => firestore ? collectionGroup(firestore, 'social-posts') : null, [firestore]);
  const { data: allPosts } = useCollection<SocialPost>(postsQuery, { includeRef: true } as any);

  const projectIds = useMemo(() => new Set(progetti.map(p => p.id)), [progetti]);

  const postsByProject = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    (allPosts ?? []).forEach((post: any) => {
      const pid = post.ref?.parent?.parent?.id;
      if (!pid || !projectIds.has(pid) || post.status === 'scartato') return;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(post);
    });
    return map;
  }, [allPosts, projectIds]);

  const allGroups = myGroups ?? [];
  const visibleProgetti = progetti.filter(p => !hiddenIds.has(p.id));
  const hiddenProgetti = progetti.filter(p => hiddenIds.has(p.id));

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
    <div className="flex flex-col gap-6 max-w-6xl w-full mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-500 flex items-center justify-center">
            <Camera className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Social Media</h1>
            <p className="text-muted-foreground text-sm">
              {visibleProgetti.length} {visibleProgetti.length === 1 ? 'progetto' : 'progetti'} attivi
              {hiddenProgetti.length > 0 && ` · ${hiddenProgetti.length} nascosti`}
            </p>
          </div>
        </div>

        {hiddenProgetti.length > 0 && (
          <button
            onClick={() => setShowHidden(v => !v)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showHidden ? 'Nascondi' : `Mostra nascosti (${hiddenProgetti.length})`}
          </button>
        )}
      </div>

      {/* ── Projects list ── */}
      {isLoadingProgetti ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Caricamento progetti...
        </div>
      ) : visibleProgetti.length === 0 && hiddenProgetti.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nessun progetto attivo</p>
          <p className="text-sm mt-1">I progetti creati appariranno qui automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Visible projects */}
          {visibleProgetti.map(project => (
            <ProjectSocialCard
              key={project.id}
              project={project}
              posts={postsByProject.get(project.id) ?? []}
              groups={allGroups}
              isHidden={false}
              onToggleHide={() => toggleHide(project.id)}
            />
          ))}

          {/* Hidden projects (shown only when toggle is on) */}
          {showHidden && hiddenProgetti.length > 0 && (
            <>
              <div className="flex items-center gap-3 mt-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-2">
                  Progetti nascosti
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {hiddenProgetti.map(project => (
                <ProjectSocialCard
                  key={project.id}
                  project={project}
                  posts={postsByProject.get(project.id) ?? []}
                  groups={allGroups}
                  isHidden={true}
                  onToggleHide={() => toggleHide(project.id)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
