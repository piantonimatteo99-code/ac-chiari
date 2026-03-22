'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertCircle,
  Camera,
  ExternalLink,
  ImageOff,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConsensoAlert } from '@/components/consenso-alert';


interface DrivePhoto {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailLink?: string;
  modifiedTime: string;
  size?: string;
}

interface PhotoManagerProps {
  projectId: string;
  projectName: string;
  groupIds?: string[];       // For consent checking
  driveFolderId?: string;
  canEdit: boolean;
  onFolderCreated?: (folderId: string) => void;
  onPhotosChange?: (photos: DrivePhoto[]) => void;
}

export default function PhotoManager({
  projectId,
  projectName,
  groupIds,
  driveFolderId,
  canEdit,
  onFolderCreated,
  onPhotosChange,
}: PhotoManagerProps) {
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<DrivePhoto | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async () => {
    if (!driveFolderId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/drive/photos?folderId=${driveFolderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore caricamento foto');
      const loaded = data.files || [];
      setPhotos(loaded);
      onPhotosChange?.(loaded);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [driveFolderId, onPhotosChange]);

  useEffect(() => {
    if (driveFolderId) loadPhotos();
  }, [driveFolderId, loadPhotos]);

  const handleCreateFolder = async () => {
    setIsCreatingFolder(true);
    setError(null);
    try {
      const res = await fetch('/api/drive/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, projectName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore creazione cartella');
      onFolderCreated?.(data.folderId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!driveFolderId || files.length === 0) return;
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setError('Seleziona solo file immagine (JPG, PNG, WebP, ecc.)');
      return;
    }
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    try {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', driveFolderId);
        formData.append('name', file.name);

        const res = await fetch('/api/drive/photos', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Errore nel caricamento');
        setUploadProgress(Math.round(((i + 1) / imageFiles.length) * 100));
      }
      await loadPhotos();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    uploadFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  };

  const getThumbUrl = (photo: DrivePhoto) => {
    if (photo.thumbnailLink) {
      return photo.thumbnailLink.replace('=s220', '=s400');
    }
    return null;
  };

  if (!driveFolderId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-muted-foreground" />
            Foto del Progetto
          </CardTitle>
          <CardDescription>
            Connetti una cartella Google Drive per gestire le foto di questo progetto.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          <p className="text-sm text-muted-foreground">
            Sarà creata automaticamente la cartella{' '}
            <span className="font-mono bg-muted px-1 rounded">App AC Chiari / {projectName}</span>{' '}
            su Google Drive.
          </p>
          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {canEdit && (
            <Button onClick={handleCreateFolder} disabled={isCreatingFolder}>
              {isCreatingFolder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              Collega cartella Drive
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-muted-foreground" />
                Foto del Progetto
              </CardTitle>
              <CardDescription className="mt-1">
                {photos.length} foto · sincronizzate con Google Drive
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={loadPhotos}
                disabled={isLoading}
                title="Aggiorna"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {canEdit && (
                <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {isUploading ? `${uploadProgress}%` : 'Carica Foto'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Avviso consensi foto */}
          {groupIds && groupIds.length > 0 && (
            <div className="mb-4">
              <ConsensoAlert groupIds={groupIds} type="foto" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive mb-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Drop zone */}
          {canEdit && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                mb-4 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all
                ${dragOver
                  ? 'border-primary bg-primary/5 scale-[1.01]'
                  : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30'
                }
              `}
            >
              <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                Trascina le foto qui o clicca per selezionarle
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, WebP, HEIC</p>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Caricamento foto...
            </div>
          )}

          {!isLoading && photos.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <ImageOff className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nessuna foto caricata per questo progetto.</p>
            </div>
          )}

          {!isLoading && photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {photos.map((photo) => {
                const thumbUrl = getThumbUrl(photo);
                const dateStr = photo.modifiedTime
                  ? format(new Date(photo.modifiedTime), 'dd MMM yyyy', { locale: it })
                  : '';
                return (
                  <div
                    key={photo.id}
                    className="group relative aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                    onClick={() => setLightboxPhoto(photo)}
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={photo.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                      <div className="p-2 w-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-[10px] font-medium truncate drop-shadow">{photo.name}</p>
                        <p className="text-white/70 text-[9px]">{dateStr}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Lightbox */}
      <Dialog open={!!lightboxPhoto} onOpenChange={(o) => !o && setLightboxPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base truncate">{lightboxPhoto?.name}</DialogTitle>
                <DialogDescription className="text-xs">
                  {lightboxPhoto?.modifiedTime && format(new Date(lightboxPhoto.modifiedTime), 'dd MMMM yyyy, HH:mm', { locale: it })}
                </DialogDescription>
              </div>
              <a
                href={lightboxPhoto?.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Apri su Drive
              </a>
            </div>
          </DialogHeader>
          <div className="p-4 pt-2">
            {lightboxPhoto && getThumbUrl(lightboxPhoto) ? (
              <img
                src={getThumbUrl(lightboxPhoto)!.replace('=s400', '=s1200')}
                alt={lightboxPhoto.name}
                className="w-full max-h-[65vh] object-contain rounded-lg bg-muted"
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <Camera className="h-12 w-12 opacity-30" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
