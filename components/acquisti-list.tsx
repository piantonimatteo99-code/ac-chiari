import { useState, useMemo, useCallback } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Loader2, ShoppingCart } from 'lucide-react';

export interface Acquisto {
    id: string;
    nome: string;
    costoStimato?: number;
    completato: boolean;
    createdAt: any;
}

interface AcquistiListProps {
    projectId: string;
    canEdit: boolean;
    collectionRoot?: string; // defaults to 'progetti'
}

export function AcquistiList({ projectId, canEdit, collectionRoot = 'progetti' }: AcquistiListProps) {
    const firestore = useFirestore();
    const [newItemName, setNewItemName] = useState('');
    const [newItemCost, setNewItemCost] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const acquistiQuery = useMemoFirebase(() => {
        if (!firestore || !projectId) return null;
        return query(
            collection(firestore, collectionRoot, projectId, 'acquisti'),
            orderBy('createdAt', 'asc')
        );
    }, [firestore, projectId, collectionRoot]);

    const { data: acquisti, isLoading } = useCollection<Acquisto>(acquistiQuery);

    const totaleStimato = useMemo(() => {
        if (!acquisti) return 0;
        return acquisti.reduce((acc, curr) => acc + (curr.costoStimato || 0), 0);
    }, [acquisti]);

    const totaleSpeso = useMemo(() => {
        if (!acquisti) return 0;
        return acquisti.filter(a => a.completato).reduce((acc, curr) => acc + (curr.costoStimato || 0), 0);
    }, [acquisti]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !projectId || !newItemName.trim()) return;
        setIsSaving(true);
        try {
            const cost = parseFloat(newItemCost);
            await addDoc(collection(firestore, collectionRoot, projectId, 'acquisti'), {
                nome: newItemName.trim(),
                costoStimato: isNaN(cost) ? null : cost,
                completato: false,
                createdAt: serverTimestamp()
            });
            setNewItemName('');
            setNewItemCost('');
        } catch (error) {
            console.error("Error adding acquisto:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleComplete = async (acquisto: Acquisto) => {
        if (!firestore || !projectId || !canEdit) return;
        try {
            await updateDoc(doc(firestore, collectionRoot, projectId, 'acquisti', acquisto.id), {
                completato: !acquisto.completato
            });
        } catch (error) {
            console.error("Error updating acquisto:", error);
        }
    };

    const handleDelete = async (acquistoId: string) => {
        if (!firestore || !projectId || !canEdit) return;
        try {
            await deleteDoc(doc(firestore, collectionRoot, projectId, 'acquisti', acquistoId));
        } catch (error) {
            console.error("Error deleting acquisto:", error);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Acquisti e Necessità
                </CardTitle>
                <CardDescription>
                    Lista delle cose da comprare o procurare per il progetto.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Caricamento lista...</p>
                ) : (
                    <div className="space-y-2">
                        {acquisti && acquisti.length > 0 ? acquisti.map((acquisto) => (
                            <div key={acquisto.id} className="flex items-center justify-between p-3 border rounded-md group hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Checkbox 
                                        checked={acquisto.completato} 
                                        onCheckedChange={() => handleToggleComplete(acquisto)}
                                        disabled={!canEdit}
                                    />
                                    <span className={`truncate text-sm font-medium ${acquisto.completato ? 'line-through text-muted-foreground' : ''}`}>
                                        {acquisto.nome}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    {acquisto.costoStimato !== null && (
                                        <span className={`text-sm font-medium tabular-nums ${acquisto.completato ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                            € {acquisto.costoStimato?.toFixed(2)}
                                        </span>
                                    )}
                                    {canEdit && (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                                            onClick={() => handleDelete(acquisto.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <p className="text-sm text-center text-muted-foreground py-4">
                                Nessun elemento nella lista degli acquisti.
                            </p>
                        )}
                    </div>
                )}

                {canEdit && (
                    <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
                        <Input 
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder="Cosa serve?"
                            className="flex-1"
                            disabled={isSaving}
                        />
                        <div className="flex gap-2">
                            <Input 
                                type="number"
                                step="0.01"
                                min="0"
                                value={newItemCost}
                                onChange={(e) => setNewItemCost(e.target.value)}
                                placeholder="Costo € (opt)"
                                className="w-[120px]"
                                disabled={isSaving}
                            />
                            <Button type="submit" disabled={isSaving || !newItemName.trim()}>
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                <span className="sr-only sm:not-sr-only sm:ml-2">Aggiungi</span>
                            </Button>
                        </div>
                    </form>
                )}
            </CardContent>
            {acquisti && acquisti.length > 0 && (
                <CardFooter className="flex flex-col sm:flex-row justify-between items-center border-t bg-muted/20 py-4 gap-2">
                    <div className="text-sm">
                        <span className="text-muted-foreground">Totale Preventivato:</span>
                        <span className="ml-2 font-semibold">€ {totaleStimato.toFixed(2)}</span>
                    </div>
                    <div className="text-sm">
                        <span className="text-muted-foreground">Totale Speso:</span>
                        <span className="ml-2 font-semibold text-green-600">€ {totaleSpeso.toFixed(2)}</span>
                    </div>
                </CardFooter>
            )}
        </Card>
    );
}
