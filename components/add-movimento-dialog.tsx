'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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

interface AddMovimentoDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AddMovimentoDialog({ isOpen, onOpenChange }: AddMovimentoDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aggiungi Movimento</DialogTitle>
          <DialogDescription>
            Registra una nuova entrata o uscita.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Form fields will go here */}
          <p className="text-sm text-muted-foreground text-center">
            Il form per l'inserimento dei movimenti è in fase di sviluppo.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button type="submit" disabled>Salva Movimento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
