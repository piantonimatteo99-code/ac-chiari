'use client';

import { useState, useCallback } from 'react';
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
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImageOff,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useUserData } from '@/src/hooks/use-user-data';
import { ConsensoAlert } from '@/components/consenso-alert';


interface DrivePhoto {
  id: string;
  name: string;
  thumbnailLink?: string;
  webViewLink: string;
}

interface SocialPost {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  driveFileId: string;
  imageName: string;
  caption: string;
  scheduledAt: any;
  status: 'pianificato' | 'pubblicato' | 'scartato';
  createdBy: string;
  createdAt: any;
}

interface SocialPlannerProps {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  projectStartDate?: string;
  projectEndDate?: string;
  groupIds?: string[];         // For consent checking
  canEdit: boolean;
  availablePhotos?: DrivePhoto[];
}

const STATUS_CONFIG = {
  pianificato: { label: 'Pianificato', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  pubblicato:  { label: 'Pubblicato',  color: 'bg-green-100 text-green-800 border-green-200' },
  scartato:    { label: 'Scartato',    color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

function InstagramPostCard({
  post,
  canEdit,
  onStatusChange,
}: {
  post: SocialPost;
  canEdit: boolean;
  onStatusChange: (id: string, status: SocialPost['status']) => void;
}) {
  const [liked, setLiked] = useState(false);
  const scheduledDate = post.scheduledAt?.toDate ? post.scheduledAt.toDate() : new Date(post.scheduledAt);
  const cfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.pianificato;

  return (
    <div className="rounded-2xl border overflow-hidden bg-white dark:bg-zinc-900 shadow-sm max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-500 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">AC</span>
        </div>
        <div>
          <p className="text-xs font-bold">ac_chiari_acr</p>
          <p className="text-[10px] text-muted-foreground">Azione Cattolica Chiari</p>
        </div>
        <span className={cn('ml-auto text-[10px] px-2 py-0.5 rounded-full border font-medium', cfg.color)}>
          {cfg.label}
        </span>
      </div>

      {/* Image */}
      <div className="aspect-square bg-muted relative overflow-hidden">
        {post.thumbnailUrl ? (
          <img
            src={post.thumbnailUrl}
            alt={post.imageName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            <Camera className="h-12 w-12" />
          </div>
        )}
      </div>

      {/* Actions row */}
      <div className="px-3 pt-3 flex items-center gap-3">
        <button
          onClick={() => setLiked(l => !l)}
          className="transition-transform active:scale-90"
        >
          <Heart
            className={cn('h-6 w-6 transition-colors', liked ? 'fill-red-500 text-red-500' : 'text-foreground')}
          />
        </button>
        <MessageSquare className="h-6 w-6 text-foreground" />
      </div>

      {/* Caption */}
      <div className="px-3 pb-2 pt-2">
        <p className="text-xs leading-relaxed whitespace-pre-wrap line-clamp-4">
          <span className="font-bold">ac_chiari_acr</span>{' '}
          {post.caption}
        </p>
      </div>

      {/* Scheduled date */}
      <div className="px-3 pb-3 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {format(scheduledDate, 'PPP', { locale: it })}
        </p>
        {canEdit && post.status === 'pianificato' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onStatusChange(post.id, 'pubblicato')}
              className="text-[10px] text-green-700 hover:underline flex items-center gap-1"
            >
              <CheckCircle2 className="h-3 w-3" />
              Pubblicato
            </button>
            <button
              onClick={() => onStatusChange(post.id, 'scartato')}
              className="text-[10px] text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SocialPlanner({ projectId, projectName, projectDescription, projectStartDate, projectEndDate, groupIds, canEdit, availablePhotos = [] }: SocialPlannerProps) {
  const firestore = useFirestore();
  const { user } = useUser();

  const postsQuery = useMemoFirebase(() => {
    if (!firestore || !projectId) return null;
    return query(collection(firestore, 'progetti', projectId, 'social-posts'), orderBy('scheduledAt', 'asc'));
  }, [firestore, projectId]);
  const { data: posts, isLoading } = useCollection<SocialPost>(postsQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<DrivePhoto | null>(null);
  const [caption, setCaption] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI
  const [aiContext, setAiContext] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Photo picker page (for selector grid)
  const [photoPage, setPhotoPage] = useState(0);
  const PHOTOS_PER_PAGE = 9;

  const openDialog = () => {
    setSelectedPhoto(null);
    setCaption('');
    setScheduledDate('');
    setAiContext('');
    setAiSuggestions([]);
    setError(null);
    setPhotoPage(0);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !user || !selectedPhoto || !caption.trim() || !scheduledDate) return;
    setIsSaving(true);
    setError(null);
    try {
      const scheduledAt = new Date(scheduledDate + 'T12:00:00');
      const thumbUrl = selectedPhoto.thumbnailLink?.replace('=s220', '=s800') ?? '';
      await addDoc(collection(firestore, 'progetti', projectId, 'social-posts'), {
        imageUrl: selectedPhoto.webViewLink,
        thumbnailUrl: thumbUrl,
        driveFileId: selectedPhoto.id,
        imageName: selectedPhoto.name,
        caption: caption.trim(),
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

  const handleStatusChange = async (postId: string, status: SocialPost['status']) => {
    if (!firestore) return;
    try {
      const ref = doc(firestore, 'progetti', projectId, 'social-posts', postId);
      await updateDoc(ref, { status });
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleGetAiSuggestions = async () => {
    setIsLoadingAI(true);
    setAiError(null);
    setAiSuggestions([]);
    try {
      // Collect last 5 published posts as learning examples
      const publishedPosts = (posts ?? [])
        .filter(p => p.status === 'pubblicato')
        .slice(-5)
        .map(p => p.caption);

      const res = await fetch('/api/ai/instagram-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          projectDescription,
          projectDate: [projectStartDate, projectEndDate].filter(Boolean).join(' → '),
          context: aiContext,
          previousPosts: publishedPosts,
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

  const visiblePosts = (posts ?? []).filter(p => p.status !== 'scartato');
  const pagedPhotos = availablePhotos.slice(photoPage * PHOTOS_PER_PAGE, (photoPage + 1) * PHOTOS_PER_PAGE);

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-500 flex items-center justify-center">
                  <span className="text-white text-[8px] font-black">IG</span>
                </div>
                Post Instagram
              </CardTitle>
              <CardDescription>
                Crea fac-simili di post Instagram e pianifica la data di pubblicazione.
              </CardDescription>
            </div>
            {canEdit && (
              <Button size="sm" onClick={openDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Post
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {/* Avviso consensi social */}
            {groupIds && groupIds.length > 0 && (
              <div className="mb-4">
                <ConsensoAlert groupIds={groupIds} type="social" />
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && visiblePosts.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <div className="h-12 w-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-yellow-500/20 flex items-center justify-center">
                  <span className="text-2xl">📸</span>
                </div>
                <p className="text-sm">Nessun post pianificato.</p>
                {canEdit && (
                  <p className="text-xs mt-1 text-muted-foreground/60">
                    {availablePhotos.length === 0
                      ? 'Carica prima delle foto nella tab "Foto".'
                      : 'Clicca "Nuovo Post" per crearne uno.'}
                  </p>
                )}
              </div>
            )}

            {!isLoading && visiblePosts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {visiblePosts.map(post => (
                  <InstagramPostCard
                    key={post.id}
                    post={post}
                    canEdit={canEdit}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Post Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-500 flex items-center justify-center shrink-0">
                <span className="text-white text-[8px] font-black">IG</span>
              </div>
              Nuovo Post Instagram
            </DialogTitle>
            <DialogDescription>
              Seleziona una foto e scrivi la caption. Puoi usare l'AI per ottenere suggerimenti.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Photo selector */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Seleziona foto</Label>
              {availablePhotos.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  <ImageOff className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nessuna foto disponibile.</p>
                  <p className="text-xs">Carica prima le foto nella tab "Foto".</p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {pagedPhotos.map(photo => {
                      const thumbUrl = photo.thumbnailLink?.replace('=s220', '=s300');
                      const isSelected = selectedPhoto?.id === photo.id;
                      return (
                        <div
                          key={photo.id}
                          onClick={() => setSelectedPhoto(photo)}
                          className={cn(
                            'aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all',
                            isSelected
                              ? 'border-primary ring-2 ring-primary ring-offset-2 scale-95'
                              : 'border-transparent hover:border-muted-foreground/30'
                          )}
                        >
                          {thumbUrl ? (
                            <img src={thumbUrl} alt={photo.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <Camera className="h-5 w-5 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Pagination */}
                  {availablePhotos.length > PHOTOS_PER_PAGE && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={photoPage === 0}
                        onClick={() => setPhotoPage(p => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {photoPage + 1} / {Math.ceil(availablePhotos.length / PHOTOS_PER_PAGE)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={(photoPage + 1) * PHOTOS_PER_PAGE >= availablePhotos.length}
                        onClick={() => setPhotoPage(p => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Suggestions */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Suggerimenti AI per la caption
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Es: cena pizza e momenti di allegria con i ragazzi... (opzionale)"
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
                    {' '}e aggiungila come <code className="bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> nel file <code className="bg-amber-100 px-1 rounded">.env.local</code>.
                  </p>
                </div>
              )}
              {aiSuggestions.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {aiSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setCaption(s)}
                      className="w-full text-left p-3 rounded-lg bg-white dark:bg-zinc-800 border hover:border-primary hover:bg-primary/5 transition-all text-xs leading-relaxed"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Caption */}
            <div className="space-y-1.5">
              <Label>Caption</Label>
              <Textarea
                placeholder="Scrivi la caption del post... includi emoji e hashtag! 🌟 #ACR"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>Data di pubblicazione</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>

            {/* Preview */}
            {selectedPhoto && caption && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Anteprima</Label>
                <div className="rounded-2xl border overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                  <div className="flex items-center gap-2 p-3 border-b">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-500 flex items-center justify-center shrink-0">
                      <span className="text-white text-[9px] font-bold">AC</span>
                    </div>
                    <span className="text-xs font-bold">ac_chiari_acr</span>
                  </div>
                  {selectedPhoto.thumbnailLink && (
                    <img
                      src={selectedPhoto.thumbnailLink.replace('=s220', '=s500')}
                      alt={selectedPhoto.name}
                      className="w-full aspect-square object-cover"
                    />
                  )}
                  <div className="p-3">
                    <p className="text-xs leading-relaxed line-clamp-3">
                      <span className="font-bold">ac_chiari_acr</span>{' '}
                      {caption}
                    </p>
                  </div>
                </div>
              </div>
            )}

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
              disabled={isSaving || !selectedPhoto || !caption.trim() || !scheduledDate}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
