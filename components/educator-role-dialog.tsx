'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, setDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import type { EducatorRole } from '@/app/(app)/admin/area-educatori/ruoli-educatori/page';
import { UserData } from '@/src/hooks/use-user-data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface EducatorRoleDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  roleToEdit?: EducatorRole | null;
}

const ALL_PAGES = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/progetti', label: 'Progetti' },
    { path: '/miei-gruppi', label: 'I Miei Gruppi' },
    { path: '/iscrizioni', label: 'Iscrizioni' },
    { path: '/nucleo-familiare', label: 'Nucleo Familiare' },
    { path: '/calendario', label: 'Calendario' },
];

const CONTABILITA_PAGES = [
    { path: '/contabilita/conto', label: 'Conto' },
    { path: '/contabilita/raccolte', label: 'Raccolte attive' },
    { path: '/contabilita/transazioni-da-controllare', label: 'Transazioni da Controllare' },
    { path: '/contabilita/pagamenti-contanti', label: 'Pagamenti Contanti' },
    { path: '/contabilita/spese', label: 'Spese' },
    { path: '/contabilita/storico', label: 'Raccolte concluse' },
];

const TESSERAMENTO_PAGES = [
    { path: '/tesserati/tariffe', label: 'Tariffe' },
    { path: '/tesserati/nuovi-iscritti', label: 'Nuovi Iscritti' },
    { path: '/tesserati/tesserati', label: 'Tesserati' },
    { path: '/tesserati/famiglie', label: 'Famiglie' },
    { path: '/tesserati/archivio', label: 'Archivio' },
];

const capitalizeFirstLetter = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export function EducatorRoleDialog({ isOpen, onOpenChange, roleToEdit }: EducatorRoleDialogProps) {
    const firestore = useFirestore();
    const isEditing = !!roleToEdit;

    const [roleName, setRoleName] = useState('');
    const [selectedPages, setSelectedPages] = useState<string[]>([]);
    const [selectedEducators, setSelectedEducators] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const educatorsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('roles', 'array-contains', 'educatore'));
    }, [firestore]);
    const { data: educators, isLoading: isLoadingEducators } = useCollection<UserData>(educatorsQuery);

    useEffect(() => {
        if (isOpen) {
            if (isEditing && roleToEdit) {
                setRoleName(roleToEdit.name);
                setSelectedPages(roleToEdit.accessiblePages || []);
                setSelectedEducators(roleToEdit.assignedEducators || []);
            } else {
                setRoleName('');
                setSelectedPages([]);
                setSelectedEducators([]);
            }
            setError(null);
        }
    }, [isOpen, isEditing, roleToEdit]);

    const handleRoleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRoleName(capitalizeFirstLetter(e.target.value));
    };

    const handlePageToggle = (pagePath: string, isChecked: boolean) => {
        setSelectedPages(prev => 
            isChecked ? [...prev, pagePath] : prev.filter(p => p !== pagePath)
        );
    };

    const handleTesseramentoToggle = (isChecked: boolean) => {
        const tesseramentoPaths = TESSERAMENTO_PAGES.map(p => p.path);
        if (isChecked) {
            setSelectedPages(prev => Array.from(new Set([...prev, ...tesseramentoPaths])));
        } else {
            setSelectedPages(prev => prev.filter(p => !tesseramentoPaths.includes(p)));
        }
    };
    
    const handleContabilitaToggle = (isChecked: boolean) => {
        const contabilitaPaths = CONTABILITA_PAGES.map(p => p.path);
        if (isChecked) {
            setSelectedPages(prev => Array.from(new Set([...prev, ...contabilitaPaths])));
        } else {
            setSelectedPages(prev => prev.filter(p => !contabilitaPaths.includes(p)));
        }
    };

    const isAllTesseramentoSelected = useMemo(() => {
        return TESSERAMENTO_PAGES.every(p => selectedPages.includes(p.path));
    }, [selectedPages]);

    const isAllContabilitaSelected = useMemo(() => {
        return CONTABILITA_PAGES.every(p => selectedPages.includes(p.path));
    }, [selectedPages]);

    const handleEducatorToggle = (uid: string, isChecked: boolean) => {
        setSelectedEducators(prev => 
            isChecked ? [...prev, uid] : prev.filter(id => id !== uid)
        );
    };

    const handleSubmit = async () => {
        setError(null);
        if (!firestore) return;
        if (!roleName) {
            setError("Il nome del ruolo è obbligatorio.");
            return;
        }

        const roleData = {
            name: roleName,
            accessiblePages: selectedPages,
            assignedEducators: selectedEducators,
        };

        try {
            if (isEditing && roleToEdit) {
                const roleDocRef = doc(firestore, 'ruoli-educatori', roleToEdit.id);
                await setDoc(roleDocRef, roleData, { merge: true });
            } else {
                const roleCollectionRef = collection(firestore, 'ruoli-educatori');
                await addDoc(roleCollectionRef, { ...roleData, createdAt: serverTimestamp() });
            }
            onOpenChange(false);
        } catch (err) {
            console.error(err);
            setError("Si è verificato un errore during il salvataggio del ruolo.");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Modifica Ruolo Educatore' : 'Nuovo Ruolo Educatore'}</DialogTitle>
                    <DialogDescription>
                        Definisci un nome per il ruolo, le pagine a cui può accedere e quali educatori ne fanno parte.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="role-name">Nome del Ruolo</Label>
                        <Input 
                            id="role-name" 
                            value={roleName} 
                            onChange={handleRoleNameChange} 
                            placeholder="Es. Coordinatore, Animatore"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8">
                        <div className="grid gap-3">
                            <Label>Pagine Visualizzabili</Label>
                             <ScrollArea className="h-48 rounded-md border p-4">
                                <div className="space-y-3">
                                {ALL_PAGES.map(page => (
                                    <div key={page.path} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`page-${page.path}`}
                                            checked={selectedPages.includes(page.path)}
                                            onCheckedChange={(checked) => handlePageToggle(page.path, !!checked)}
                                        />
                                        <label htmlFor={`page-${page.path}`} className="text-sm font-medium leading-none">
                                            {page.label}
                                        </label>
                                    </div>
                                ))}
                                <Accordion type="single" collapsible className="w-full">
                                    <AccordionItem value="item-1" className="border-b-0">
                                        <AccordionTrigger className='p-0 hover:no-underline flex-row-reverse justify-end gap-2'>
                                             <Label htmlFor='contabilita-all' className="text-sm font-medium leading-none flex-1">
                                                Contabilità
                                             </Label>
                                             <Checkbox
                                                id="contabilita-all"
                                                checked={isAllContabilitaSelected}
                                                onCheckedChange={(checked) => handleContabilitaToggle(!!checked)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2 pl-6 space-y-2">
                                            {CONTABILITA_PAGES.map(page => (
                                                <div key={page.path} className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id={`page-${page.path}`}
                                                        checked={selectedPages.includes(page.path)}
                                                        onCheckedChange={(checked) => handlePageToggle(page.path, !!checked)}
                                                    />
                                                    <label htmlFor={`page-${page.path}`} className="text-sm font-medium leading-none text-muted-foreground">
                                                        {page.label}
                                                    </label>
                                                </div>
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                    <AccordionItem value="item-2" className="border-b-0">
                                        <AccordionTrigger className='p-0 hover:no-underline flex-row-reverse justify-end gap-2'>
                                            <Label htmlFor='tesseramento-all' className="text-sm font-medium leading-none flex-1">
                                               Tesseramento
                                            </Label>
                                            <Checkbox
                                                id="tesseramento-all"
                                                checked={isAllTesseramentoSelected}
                                                onCheckedChange={(checked) => handleTesseramentoToggle(!!checked)}
                                                 onClick={(e) => e.stopPropagation()}
                                            />
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2 pl-6 space-y-2">
                                            {TESSERAMENTO_PAGES.map(page => (
                                                <div key={page.path} className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id={`page-${page.path}`}
                                                        checked={selectedPages.includes(page.path)}
                                                        onCheckedChange={(checked) => handlePageToggle(page.path, !!checked)}
                                                    />
                                                    <label htmlFor={`page-${page.path}`} className="text-sm font-medium leading-none text-muted-foreground">
                                                        {page.label}
                                                    </label>
                                                </div>
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>

                                </div>
                            </ScrollArea>
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
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
                    <Button onClick={handleSubmit}>Salva Ruolo</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
