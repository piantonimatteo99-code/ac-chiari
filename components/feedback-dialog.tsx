'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/src/firebase';
import { addFeedback, FeedbackType } from '@/lib/firebase/feedback';
import { Button } from '@/components/ui/button';
import { Lightbulb, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';

export function FeedbackDialog() {
  const { user } = useUser();
  const pathname = usePathname();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('Miglioramento');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !user) return;

    setIsSubmitting(true);
    try {
      await addFeedback(
        user.uid,
        user.email || '',
        user.displayName || '',
        type,
        description,
        pathname || '/'
      );
      toast({
        title: 'Segnalazione inviata!',
        description: 'Grazie per averci aiutato a migliorare.',
      });
      setOpen(false);
      setDescription('');
      setType('Miglioramento');
    } catch (error) {
      console.error(error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore, riprova più tardi.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full shadow-sm text-yellow-500 hover:text-yellow-600 bg-secondary/60 hover:bg-secondary border-none">
          <Lightbulb className="h-5 w-5" />
          <span className="sr-only">Segnala un problema o miglioramento</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invia un feedback</DialogTitle>
            <DialogDescription>
              Aiutaci a migliorare l'esperienza. Dicci se hai un'idea o se hai trovato un problema.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-3">
              <Label>Tipologia</Label>
              <RadioGroup value={type} onValueChange={(val) => setType(val as FeedbackType)} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Miglioramento" id="type-miglioramento" />
                  <Label htmlFor="type-miglioramento" className="font-normal cursor-pointer">Miglioramento</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Problema" id="type-problema" />
                  <Label htmlFor="type-problema" className="font-normal cursor-pointer text-destructive">Problema (Bug)</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                placeholder="Descrivi qui il tuo suggerimento o il problema riscontrato..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Annulla
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Invia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
