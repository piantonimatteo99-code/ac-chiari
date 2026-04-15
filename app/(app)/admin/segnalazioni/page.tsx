'use client';

import { useEffect, useState, useCallback } from 'react';
import { getFeedbacks, updateFeedbackData, Feedback, FeedbackStatus, FeedbackPriority } from '@/lib/firebase/feedback';
import { useToast } from '@/components/ui/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, ImageIcon, Archive, Inbox, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ACTIVE_STATUSES: FeedbackStatus[] = ['Nuovo', 'In corso'];
const ARCHIVED_STATUSES: FeedbackStatus[] = ['Risolto', 'Rifiutato'];

export default function SegnalazioniAdminPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchFeedbacks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getFeedbacks();
      setFeedbacks(data);
    } catch (error) {
      console.error(error);
      toast({ title: 'Errore', description: 'Impossibile caricare le segnalazioni', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleStatusChange = async (feedback: Feedback, newStatus: FeedbackStatus) => {
    if (!feedback.id) return;
    try {
      await updateFeedbackData(feedback.id, { status: newStatus });
      setFeedbacks(prev => prev.map(f => f.id === feedback.id ? { ...f, status: newStatus } : f));

      // Se archiviata, elimina l'immagine da Drive
      const isArchived = ARCHIVED_STATUSES.includes(newStatus);
      if (isArchived && feedback.driveFileId) {
        try {
          await fetch('/api/drive/delete-segnalazione', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: feedback.driveFileId }),
          });
          // Rimuovi i riferimenti immagine anche su Firestore
          await updateFeedbackData(feedback.id, { imageUrl: undefined, driveFileId: undefined });
          setFeedbacks(prev => prev.map(f =>
            f.id === feedback.id ? { ...f, status: newStatus, imageUrl: undefined, driveFileId: undefined } : f
          ));
        } catch (delErr) {
          console.warn('Impossibile eliminare immagine da Drive:', delErr);
        }
      }

      toast({ title: 'Stato aggiornato', description: 'Lo stato della segnalazione è stato modificato.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Errore', description: 'Impossibile aggiornare lo stato.', variant: 'destructive' });
    }
  };

  const handlePriorityChange = async (feedbackId: string, newPriority: FeedbackPriority) => {
    try {
      await updateFeedbackData(feedbackId, { priority: newPriority });
      setFeedbacks(prev => prev.map(f => f.id === feedbackId ? { ...f, priority: newPriority } : f));
      toast({ title: 'Priorità aggiornata', description: 'La priorità della segnalazione è stata modificata.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Errore', description: 'Impossibile aggiornare la priorità.', variant: 'destructive' });
    }
  };

  const getStatusColor = (status: FeedbackStatus) => {
    switch (status) {
      case 'Nuovo': return 'bg-blue-500 hover:bg-blue-600';
      case 'In corso': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'Risolto': return 'bg-green-500 hover:bg-green-600';
      case 'Rifiutato': return 'bg-gray-500 hover:bg-gray-600';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: FeedbackPriority) => {
    switch (priority) {
      case 'Alta': return 'text-red-500 font-bold';
      case 'Media': return 'text-orange-500 font-bold';
      case 'Bassa': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const activeFeedbacks = feedbacks.filter(f => ACTIVE_STATUSES.includes(f.status));
  const archivedFeedbacks = feedbacks.filter(f => ARCHIVED_STATUSES.includes(f.status));

  const FeedbackTable = ({ items, showPriority = true }: { items: Feedback[]; showPriority?: boolean }) => (
    <div className="rounded-md border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Utente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="w-[30%]">Descrizione</TableHead>
            <TableHead>Pagina</TableHead>
            <TableHead>Screen</TableHead>
            {showPriority && <TableHead>Priorità</TableHead>}
            <TableHead>Stato</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showPriority ? 8 : 7} className="text-center h-24 text-muted-foreground">
                Nessuna segnalazione trovata.
              </TableCell>
            </TableRow>
          ) : (
            items.map((feedback) => (
              <TableRow key={feedback.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {format(feedback.createdAt as Date, 'dd MMM yyyy HH:mm', { locale: it })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{feedback.userName || 'Utente'}</span>
                    <span className="text-xs text-muted-foreground">{feedback.userEmail}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={feedback.type === 'Problema' ? 'destructive' : 'secondary'}>
                    {feedback.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {feedback.description}
                  </div>
                </TableCell>
                <TableCell>
                  <a
                    href={feedback.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center gap-1 text-xs max-w-[150px] truncate"
                    title={feedback.url}
                  >
                    {feedback.url} <ExternalLink className="h-3 w-3 inline flex-shrink-0" />
                  </a>
                </TableCell>
                <TableCell>
                  {feedback.imageUrl ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-500 hover:text-blue-700"
                      onClick={() => setSelectedImage(feedback.imageUrl!)}
                      title="Visualizza screenshot"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                {showPriority && (
                  <TableCell>
                    <Select
                      value={feedback.priority}
                      onValueChange={(val) => handlePriorityChange(feedback.id!, val as FeedbackPriority)}
                    >
                      <SelectTrigger className={`w-[130px] h-8 text-xs ${getPriorityColor(feedback.priority)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Da valutare">Da valutare</SelectItem>
                        <SelectItem value="Bassa" className="text-green-500">Bassa</SelectItem>
                        <SelectItem value="Media" className="text-orange-500">Media</SelectItem>
                        <SelectItem value="Alta" className="text-red-500">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                <TableCell>
                  <Select
                    value={feedback.status}
                    onValueChange={(val) => handleStatusChange(feedback, val as FeedbackStatus)}
                  >
                    <SelectTrigger className={`w-[130px] h-8 text-xs text-white ${getStatusColor(feedback.status)} border-0`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nuovo">Nuovo</SelectItem>
                      <SelectItem value="In corso">In corso</SelectItem>
                      <SelectItem value="Risolto">Risolto</SelectItem>
                      <SelectItem value="Rifiutato">Rifiutato</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Segnalazioni e Feedback</h1>
            <p className="text-muted-foreground mt-2">
              Gestisci i problemi riscontrati dagli utenti e le loro proposte di miglioramento.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchFeedbacks} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Aggiorna
          </Button>
        </div>

        <Tabs defaultValue="attive">
          <TabsList className="mb-6">
            <TabsTrigger value="attive" className="gap-2">
              <Inbox className="h-4 w-4" />
              Attive
              {activeFeedbacks.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">
                  {activeFeedbacks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="archivio" className="gap-2">
              <Archive className="h-4 w-4" />
              Archivio
              {archivedFeedbacks.length > 0 && (
                <Badge variant="outline" className="ml-1 h-5 min-w-5 px-1 text-xs text-muted-foreground">
                  {archivedFeedbacks.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attive">
            <FeedbackTable items={activeFeedbacks} showPriority />
          </TabsContent>

          <TabsContent value="archivio">
            <p className="text-sm text-muted-foreground mb-4">
              Le segnalazioni archiviate (Risolte o Rifiutate) sono mostrate di seguito. Gli screenshot allegati vengono eliminati automaticamente all'archiviazione.
            </p>
            <FeedbackTable items={archivedFeedbacks} showPriority={false} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modale anteprima screenshot */}
      <Dialog open={!!selectedImage} onOpenChange={(v) => { if (!v) setSelectedImage(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Screenshot allegato</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="flex flex-col items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedImage}
                alt="Screenshot segnalazione"
                className="max-h-[70vh] w-auto rounded-lg border shadow-sm object-contain"
              />
              <a
                href={selectedImage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline flex items-center gap-1"
              >
                Apri su Google Drive <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
