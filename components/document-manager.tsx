'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Loader2,
  Plus,
  FileText,
  Sheet,
  Presentation,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  AlertCircle,
  Upload,
  FileUp,
  File,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
}

interface DocumentManagerProps {
  projectId: string;
  projectName: string;
  driveFolderId?: string;
  canEdit: boolean;
  onFolderCreated?: (folderId: string) => void;
  folderApiEndpoint?: string; // defaults to '/api/drive/folders'
}

const docTypeConfig = {
  document: {
    label: 'Documento di testo',
    icon: FileText,
    color: 'text-blue-600',
  },
  spreadsheet: {
    label: 'Foglio di calcolo',
    icon: Sheet,
    color: 'text-green-600',
  },
  presentation: {
    label: 'Presentazione',
    icon: Presentation,
    color: 'text-yellow-600',
  },
};

function getMimeTypeIcon(mimeType: string) {
  if (mimeType.includes('document')) return { Icon: FileText, color: 'text-blue-600' };
  if (mimeType.includes('spreadsheet')) return { Icon: Sheet, color: 'text-green-600' };
  if (mimeType.includes('presentation')) return { Icon: Presentation, color: 'text-yellow-600' };
  if (mimeType === 'application/pdf') return { Icon: File, color: 'text-red-600' };
  return { Icon: File, color: 'text-muted-foreground' };
}

function getMimeTypeLabel(mimeType: string) {
  if (mimeType.includes('document')) return 'Documento';
  if (mimeType.includes('spreadsheet')) return 'Foglio';
  if (mimeType.includes('presentation')) return 'Presentazione';
  if (mimeType === 'application/pdf') return 'PDF';
  return 'File';
}

export default function DocumentManager({
  projectId,
  projectName,
  driveFolderId,
  canEdit,
  onFolderCreated,
  folderApiEndpoint = '/api/drive/folders',
}: DocumentManagerProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New document dialog
  const [isNewDocOpen, setIsNewDocOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState<'document' | 'spreadsheet' | 'presentation'>('document');
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!driveFolderId) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/drive/documents?folderId=${driveFolderId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Errore nel caricamento dei documenti');

      setFiles(data.files || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [driveFolderId]);

  useEffect(() => {
    if (driveFolderId) {
      loadFiles();
    }
  }, [driveFolderId, loadFiles]);

  const handleCreateFolder = async () => {
    setIsCreatingFolder(true);
    setError(null);
    try {
      const res = await fetch(folderApiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, projectName }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Errore nella creazione della cartella');

      onFolderCreated?.(data.folderId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleUploadPDF = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !driveFolderId) return;

    // Reset input so same file can be re-uploaded if needed
    event.target.value = '';

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderId', driveFolderId);
      formData.append('name', file.name);

      const res = await fetch('/api/drive/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore nel caricamento del file');

      // Refresh the file list
      await loadFiles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenNewDoc = (type: 'document' | 'spreadsheet' | 'presentation') => {
    setNewDocType(type);
    setNewDocName('');
    setIsNewDocOpen(true);
  };

  const handleCreateDocument = async () => {
    if (!newDocName.trim() || !driveFolderId) return;

    setIsCreatingDoc(true);
    setError(null);

    try {
      const res = await fetch('/api/drive/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: driveFolderId,
          name: newDocName.trim(),
          type: newDocType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore nella creazione del documento');

      setIsNewDocOpen(false);
      setNewDocName('');

      // Open the new document directly in a new tab
      if (data.file?.webViewLink) {
        window.open(data.file.webViewLink, '_blank');
      }

      // Reload file list
      await loadFiles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreatingDoc(false);
    }
  };

  // --- No Drive folder yet ---
  if (!driveFolderId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            Documenti Google
          </CardTitle>
          <CardDescription>
            Collega una cartella Google Drive per gestire i documenti di questo progetto.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          <p className="text-sm text-muted-foreground">
            Sarà creata automaticamente la cartella{' '}
            <span className="font-mono bg-muted px-1 rounded">App AC Chiari / {projectName}</span>{' '}
            su Google Drive dell'organizzazione.
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
                <FolderOpen className="mr-2 h-4 w-4" />
              )}
              Collega cartella Drive
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // --- Drive folder connected ---
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                Documenti Google Drive
              </CardTitle>
              <CardDescription className="mt-1">
                Documenti sincronizzati con la cartella Drive del progetto. Cliccando su un documento si aprirà in una nuova scheda.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={loadFiles}
                disabled={isLoading}
                title="Aggiorna lista"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Nuovo documento
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(Object.entries(docTypeConfig) as [keyof typeof docTypeConfig, (typeof docTypeConfig)[keyof typeof docTypeConfig]][]).map(([type, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <DropdownMenuItem
                          key={type}
                          onClick={() => handleOpenNewDoc(type)}
                          className="flex items-center gap-2"
                        >
                          <Icon className={`h-4 w-4 ${cfg.color}`} />
                          {cfg.label}
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <FileUp className="h-4 w-4 text-red-600" />
                      Carica PDF / File
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {/* Hidden file input for PDF upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleUploadPDF}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="flex flex-col gap-2 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-semibold">Errore Google Drive</span>
              </div>
              <p className="text-xs opacity-90">
                {error.includes('File not found') || error.includes('404')
                  ? 'La cartella di questo progetto non è stata trovata su Google Drive. Potrebbe essere stata creata con un account Google differente o essere stata eliminata.'
                  : error}
              </p>
              {canEdit && (error.includes('File not found') || error.includes('404')) && (
                <div className="mt-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleCreateFolder}
                    disabled={isCreatingFolder}
                  >
                    {isCreatingFolder ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <FolderOpen className="mr-1.5 h-3 w-3" />
                    )}
                    Ricrea cartella su Google Drive
                  </Button>
                </div>
              )}
            </div>
          )}

          {isUploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-3 bg-muted rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>Caricamento file su Google Drive in corso...</span>
            </div>
          )}
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Caricamento documenti...
            </div>
          )}

          {!isLoading && files.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nessun documento nella cartella Drive di questo progetto.</p>
              {canEdit && (
                <p className="text-xs mt-1">
                  Clicca "Nuovo documento" per crearne uno, oppure aggiungi file direttamente su Google Drive.
                </p>
              )}
            </div>
          )}

          {!isLoading && files.length > 0 && (
            <div className="space-y-1">
              {files.map((file) => {
                const { Icon, color } = getMimeTypeIcon(file.mimeType);
                const typeLabel = getMimeTypeLabel(file.mimeType);
                const modifiedDate = file.modifiedTime
                  ? format(new Date(file.modifiedTime), 'dd MMM yyyy, HH:mm', { locale: it })
                  : '';
                return (
                  <a
                    key={file.id}
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent hover:border-primary transition-colors group"
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {typeLabel}
                        {modifiedDate && ` · Modificato il ${modifiedDate}`}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Document Dialog */}
      <Dialog open={isNewDocOpen} onOpenChange={setIsNewDocOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuovo {docTypeConfig[newDocType]?.label}</DialogTitle>
            <DialogDescription>
              Inserisci il nome del documento. Sarà creato su Google Drive nella cartella del progetto.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="doc-name">Nome documento</Label>
            <Input
              id="doc-name"
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              placeholder={`Es. Piano ${docTypeConfig[newDocType]?.label}...`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newDocName.trim()) {
                  handleCreateDocument();
                }
              }}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewDocOpen(false)} disabled={isCreatingDoc}>
              Annulla
            </Button>
            <Button onClick={handleCreateDocument} disabled={isCreatingDoc || !newDocName.trim()}>
              {isCreatingDoc && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crea e apri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
