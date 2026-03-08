'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, setDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';
import { UserData } from '@/src/hooks/use-user-data';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GroupDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  groupToEdit?: Group | null;
}

const capitalizeFirstLetter = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

export function GroupDialog({ isOpen, onOpenChange, groupToEdit }: GroupDialogProps) {
    const firestore = useFirestore();
    const isEditing = !!groupToEdit;

    const [groupName, setGroupName] = useState('');
    const [selectedEducators, setSelectedEducators] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const educatorsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('roles', 'array-contains', 'educatore'));
    }, [firestore]);
    const { data: educators, isLoading: isLoadingEducators } = useCollection<UserData>(educatorsQuery);

    useEffect(() => {
        if (isOpen) {
            if (isEditing && groupToEdit) {
                setGroupName(groupToEdit.name);
                setSelectedEducators(groupToEdit.educatorIds || []);
            } else {
                setGroupName('');
                setSelectedEducators([]);
            }
            setError(null);
        }
    }, [isOpen, isEditing, groupToEdit]);

    const handleGroupNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setGroupName(capitalizeFirstLetter(e.target.value));
    };

    const handleEducatorToggle = (uid: string, isChecked: boolean) => {
        setSelectedEducators(prev => 
            isChecked ? [...prev, uid] : prev.filter(id => id !== uid)
        );
    };

    const handleSubmit = async () => {
        setError(null);
        if (!firestore) return;
        if (!groupName) {
            setError("Il nome del gruppo è obbligatorio.");
            return;
        }

        const groupData = {
            name: groupName,
            educatorIds: selectedEducators,
        };

        try {
            if (isEditing && groupToEdit) {
                const groupDocRef = doc(firestore, 'gruppi', groupToEdit.id);
                await setDoc(groupDocRef, groupData, { merge: true });
            } else {
                const groupCollectionRef = collection(firestore, 'gruppi');
                await addDoc(groupCollectionRef, { ...groupData, createdAt: serverTimestamp() });
            }
            onOpenChange(false);
        } catch (err) {
            console.error(err);
            setError("Si è verificato un errore durante il salvataggio del gruppo.");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Modifica Gruppo' : 'Nuovo Gruppo'}</DialogTitle>
                    <DialogDescription>
                        Definisci un nome per il gruppo e assegna gli educatori che ne faranno parte.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="group-name">Nome del Gruppo</Label>
                        <Input 
                            id="group-name" 
                            value={groupName} 
                            onChange={handleGroupNameChange} 
                            placeholder="Es. Gruppo Estivo Medie"
                        />
                    </div>
                    
                    <div className="grid gap-3">
                        <Label>Educatori Assegnati</Label>
                        <ScrollArea className="h-48 rounded-md border p-4">
                            {isLoadingEducators ? <p>Caricamento...</p> : (
                            <div className="space-y-3">
                                {educators && educators.length > 0 ? educators.map(edu => (
                                    <div key={edu.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`edu-${edu.id}`}
                                            checked={selectedEducators.includes(edu.id)}
                                            onCheckedChange={(checked) => handleEducatorToggle(edu.id, !!checked)}
                                        />
                                        <label htmlFor={`edu-${edu.id}`} className="text-sm font-medium leading-none">
                                            {edu.displayName}
                                        </label>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground">Nessun utente con il ruolo "educatore" trovato.</p>}
                            </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
                    <Button onClick={handleSubmit}>Salva Gruppo</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

    