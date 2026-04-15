'use client';

import { useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/src/firebase';
import { addFeedback, FeedbackType } from '@/lib/firebase/feedback';
import { triggerNotification } from '@/lib/trigger-notification';
import { Button } from '@/components/ui/button';
import { ImagePlus, Lightbulb, Loader2, X } from 'lucide-react';
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
import Image from 'next/image';

export function FeedbackDialog() {
  const { user } = useUser();
  const pathname = usePathname();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('Miglioramento');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Formato non valido', description: 'Seleziona un file immagine (PNG, JPG, WEBP…).', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File troppo grande', description: 'Max 10 MB.', variant: 'destructive' });
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, [imagePreview, toast]);

  const removeImage = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [imagePreview]);

  const resetForm = useCallback(() => {
    setDescription('');
    setType('Miglioramento');
    removeImage();
  }, [removeImage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !user) return;

    setIsSubmitting(true);
    try {
      let imageUrl: string | undefined;
      let driveFileId: string | undefined;

      // Upload screenshot su Drive se presente
      if (imageFile) {
        setIsUploadingImage(true);
        try {
          const formData = new FormData();
          formData.append('file', imageFile);
          const safeName = user.displayName?.replace(/[^a-zA-Z0-9-]/g, '_') || user.uid;
          formData.append('name', `segnalazione_${safeName}_${Date.now()}`);

          const res = await fetch('/api/drive/upload-segnalazione', { method: 'POST', body: formData });
          if (res.ok) {
            const data = await res.json();
            imageUrl = data.file?.webViewLink;
            driveFileId = data.file?.id;
          } else {
            console.warn('Caricamento immagine su Drive non riuscito, continuo senza allegato.');
          }
        } catch (imgErr) {
          console.warn('Errore upload immagine:', imgErr);
        } finally {
          setIsUploadingImage(false);
        }
      }

      await addFeedback(
        user.uid,
        user.email || '',
        user.displayName || '',
        type,
        description,
        pathname || '/',
        imageUrl,
        driveFileId
      );

      triggerNotification({
        eventType: 'nuovo_feedback',
        title: `💬 Nuovo feedback: ${type}`,
        body: `${user.displayName || user.email} ha inviato un ${type.toLowerCase()}: "${description.substring(0, 80)}${description.length > 80 ? '...' : ''}"`,
        href: '/admin/segnalazioni',
        userId: '__broadcast__',
      });

      toast({
        title: 'Segnalazione inviata!',
        description: 'Grazie per averci aiutato a migliorare.',
      });
      setOpen(false);
      resetForm();
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
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full shadow-sm text-yellow-500 hover:text-yellow-600 bg-secondary/60 hover:bg-secondary border-none">
          <Lightbulb className="h-5 w-5" />
          <span className="sr-only">Segnala un problema o miglioramento</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invia un feedback</DialogTitle>
            <DialogDescription>
              Aiutaci a migliorare l'esperienza. Dicci se hai un'idea o se hai trovato un problema.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Tipo */}
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

            {/* Descrizione */}
            <div className="space-y-2">
              <Label htmlFor="feedback-description">Descrizione</Label>
              <Textarea
                id="feedback-description"
                placeholder="Descrivi qui il tuo suggerimento o il problema riscontrato..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />
            </div>

            {/* Upload screenshot */}
            <div className="space-y-2">
              <Label>Screenshot (opzionale)</Label>
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden border bg-muted">
                  <Image
                    src={imagePreview}
                    alt="Anteprima screenshot"
                    width={420}
                    height={240}
                    className="w-full h-auto max-h-48 object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 rounded-full shadow"
                    onClick={removeImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed rounded-lg text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
                >
                  <ImagePlus className="h-8 w-8" />
                  <span className="text-sm">Clicca per allegare uno screenshot</span>
                  <span className="text-xs">PNG, JPG, WEBP — max 10 MB</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Annulla
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {(isSubmitting || isUploadingImage) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isUploadingImage ? 'Caricamento immagine...' : isSubmitting ? 'Invio...' : 'Invia'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
