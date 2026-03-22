'use client';

import { useEffect, useState } from 'react';
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
import { Loader2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function SegnalazioniAdminPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setIsLoading(true);
    try {
      const data = await getFeedbacks();
      setFeedbacks(data);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare le segnalazioni',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (feedbackId: string, newStatus: FeedbackStatus) => {
    try {
      await updateFeedbackData(feedbackId, { status: newStatus });
      setFeedbacks(prev => prev.map(f => f.id === feedbackId ? { ...f, status: newStatus } : f));
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Segnalazioni e Feedback</h1>
          <p className="text-muted-foreground mt-2">
            Gestisci i problemi riscontrati dagli utenti e le loro proposte di miglioramento.
          </p>
        </div>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Utente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-[30%]">Descrizione</TableHead>
              <TableHead>Pagina</TableHead>
              <TableHead>Priorità</TableHead>
              <TableHead>Stato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedbacks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                  Nessuna segnalazione trovata.
                </TableCell>
              </TableRow>
            ) : (
              feedbacks.map((feedback) => (
                <TableRow key={feedback.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(feedback.createdAt as Date, 'dd MMM yyyy HH:mm', { locale: it })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{feedback.userName || 'Utente'}</span>
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
                      {feedback.url} <ExternalLink className="h-3 w-3 inline" />
                    </a>
                  </TableCell>
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
                  <TableCell>
                    <Select
                      value={feedback.status}
                      onValueChange={(val) => handleStatusChange(feedback.id!, val as FeedbackStatus)}
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
    </div>
  );
}
