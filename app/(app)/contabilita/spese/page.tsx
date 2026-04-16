'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, CheckCircle2 } from "lucide-react";
import { AddSpesaDialog, type Spesa } from "@/components/add-spesa-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { it } from 'date-fns/locale';
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SettleSpesaDialog } from "@/components/settle-spesa-dialog";

export default function SpesePage() {
    const firestore = useFirestore();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isSettleDialogOpen, setIsSettleDialogOpen] = useState(false);
    const [selectedSpesa, setSelectedSpesa] = useState<Spesa | null>(null);


    const speseQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'spese'), orderBy('data', 'desc'));
    }, [firestore]);

    const { data: spese, isLoading } = useCollection<Spesa>(speseQuery);
    
    const handleOpenSettleDialog = (spesa: Spesa) => {
        setSelectedSpesa(spesa);
        setIsSettleDialogOpen(true);
    };

    const formatDate = (date: any) => {
        if (!date) return '-';
        let jsDate;
        if (date.toDate) { 
            jsDate = date.toDate();
        } else if (date instanceof Date) { 
            jsDate = date;
        } else if (typeof date === 'string' || typeof date === 'number') {
            jsDate = new Date(date);
        } else {
            return '-';
        }
        
        if (isNaN(jsDate.getTime())) {
            return '-';
        }
        
        return format(jsDate, 'dd/MM/yyyy', { locale: it });
    }

  return (
    <>
      <AddSpesaDialog isOpen={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      <SettleSpesaDialog isOpen={isSettleDialogOpen} onOpenChange={setIsSettleDialogOpen} spesa={selectedSpesa} />

      <div className="flex items-center justify-between">
         <div className="flex-1">
          <h2 className="text-xl font-semibold">Gestione Spese</h2>
            <p className="text-muted-foreground">
              Qui puoi registrare e gestire tutte le uscite.
            </p>
         </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-assistant="add-spesa-btn">
          <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Spesa
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Raccolta</TableHead>
                <TableHead>Registrato da</TableHead>
                <TableHead className="text-center">Ricevuta</TableHead>
                <TableHead className="text-center">Stato</TableHead>
                <TableHead className="text-right">Importo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Caricamento spese...</TableCell>
                </TableRow>
              )}
              {!isLoading && spese && spese.length > 0 ? (
                spese.map(spesa => {
                  const importoPagato = spesa.importoPagato || 0;
                  const isSettled = importoPagato >= spesa.importo;

                  return (
                    <TableRow key={spesa.id}>
                      <TableCell>{formatDate(spesa.data)}</TableCell>
                      <TableCell className="font-medium">{spesa.descrizione}</TableCell>
                      <TableCell>{spesa.raccoltaNome || ''}</TableCell>
                      <TableCell>{spesa.registeredByName}</TableCell>
                      <TableCell className="text-center">
                        {spesa.receiptUrl ? (
                           <Button variant="outline" size="icon" asChild>
                              <Link href={spesa.receiptUrl} target="_blank" rel="noopener noreferrer">
                                  <FileText className="h-4 w-4" />
                              </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                          {isSettled ? (
                              <Badge variant="secondary" className="text-green-600">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Saldato
                              </Badge>
                          ) : (
                               <div className="flex flex-col items-center">
                                  <Button variant="outline" size="sm" onClick={() => handleOpenSettleDialog(spesa)}>
                                      Esegui Rimborso
                                  </Button>
                                  {importoPagato > 0 && (
                                      <span className="text-xs text-muted-foreground mt-1">
                                          Pagato €{importoPagato.toFixed(2)}
                                      </span>
                                  )}
                              </div>
                          )}
                      </TableCell>
                      <TableCell className="text-right text-destructive font-semibold">- €{spesa.importo.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                !isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">Nessuna spesa registrata.</TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
