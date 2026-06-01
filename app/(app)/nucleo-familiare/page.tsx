'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, Users, LogIn, ChevronDown } from "lucide-react";
import { AddFamiliareDialog } from '@/components/add-familiare-dialog';
import { JoinFamilyDialog } from '@/components/join-family-dialog';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/src/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { ConfirmationDialog } from '@/components/confirmation-dialog';


export interface PersonaAutorizzata {
  nome: string;
  cognome: string;
  telefono?: string;
}

export interface Membro {
  id: string;
  nome: string;
  cognome: string;
  dataNascita: string;
  codiceFiscale: string;
  luogoNascita: string;
  telefonoPrincipale: string;
  telefonoSecondario: string;
  allergie?: string;
  createdAt?: any;
  groupId?: string;
  groupName?: string;
  tesseramento?: number;
  consenso?: boolean;
  consensoFoto?: boolean;
  consensoSocial?: boolean;
  linkedUserId?: string;
  // Campi per minorenni
  personaAutorizzata?: PersonaAutorizzata[];
  puoRientrareInAutonomia?: boolean;
}

export default function NucleoFamiliarePage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [editingMembro, setEditingMembro] = useState<Membro | null>(null);
  const [membroToDelete, setMembroToDelete] = useState<Membro | null>(null);
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData, isLoading: isUserDataLoading, resolvedFamilyId } = useUserData();

  const famigliaId = resolvedFamilyId ?? user?.uid;
  const [familyAddress, setFamilyAddress] = useState('Nessun indirizzo specificato');

  const famigliaDocRef = useMemoFirebase(() => {
    if (!famigliaId || !firestore) return null;
    return doc(firestore, 'famiglie', famigliaId);
  }, [famigliaId, firestore]);

  const { data: famigliaData, isLoading: isFamigliaLoading } = useDoc(famigliaDocRef);

  useEffect(() => {
    if (famigliaData) {
      const { via, numeroCivico, citta, provincia, cap } = famigliaData;
      if (via && citta) {
        setFamilyAddress(`${via} ${numeroCivico || ''}, ${cap || ''} ${citta} (${provincia || ''})`);
      } else {
        setFamilyAddress('Indirizzo non ancora specificato');
      }
    } else if (!isFamigliaLoading && userData) {
      const { via, numeroCivico, citta, provincia, cap } = userData;
      if (via && citta) {
        setFamilyAddress(`${via} ${numeroCivico || ''}, ${cap || ''} ${citta} (${provincia || ''})`);
      } else {
        setFamilyAddress('Indirizzo non ancora specificato');
      }
    }
  }, [famigliaData, isFamigliaLoading, userData]);

  const membriQuery = useMemoFirebase(() => {
    if (!famigliaId || !firestore) return null;
    return collection(firestore, 'famiglie', famigliaId, 'membri');
  }, [famigliaId, firestore]);

  const { data: membri, isLoading: isMembriLoading, error } = useCollection<Membro>(membriQuery);

  const isLoading = isUserDataLoading || isFamigliaLoading || isMembriLoading;

  // Is this user already linked to another family?
  const isLinkedMember = !!(userData?.familyId && userData.familyId !== user?.uid);
  const hasFamilyMembers = !!(membri && membri.length > 0);

  const ownMemberName = useMemo(() => {
    if (!userData) return null;
    return `${userData.nome ?? ''} ${userData.cognome ?? ''}`.trim().toLowerCase();
  }, [userData]);

  const handleEdit = (membro: Membro) => {
    setEditingMembro(membro);
    setIsAddDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingMembro(null);
    setIsAddDialogOpen(true);
  };

  const handleDelete = useCallback(async () => {
    if (!firestore || !famigliaId || !membroToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'famiglie', famigliaId, 'membri', membroToDelete.id));
    } catch {
      alert('Si è verificato un errore.');
    }
  }, [firestore, famigliaId, membroToDelete]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Nucleo Familiare</h1>

        <div className="flex items-center gap-2">
          {/* Only show "Unisciti" if not already linked */}
          {!isLinkedMember && (
            <Button
              variant="outline"
              onClick={() => setIsJoinDialogOpen(true)}
              disabled={!user}
              className="flex items-center gap-2"
              data-assistant="join-family-btn"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Unisciti a una Famiglia</span>
              <span className="sm:hidden">Unisciti</span>
            </Button>
          )}

          <Button onClick={handleAddNew} disabled={!user} data-assistant="add-familiare-btn">
            <PlusCircle className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Aggiungi Membro</span>
            <span className="sm:hidden">Aggiungi</span>
          </Button>
        </div>
      </div>

      {/* Linked-member banner */}
      {isLinkedMember && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-center gap-3 text-sm text-blue-800">
          <Users className="h-4 w-4 shrink-0" />
          <p>
            Sei collegato a un nucleo familiare esistente. Puoi visualizzare e modificare i dati di tutti i membri.
          </p>
        </div>
      )}

      {/* Dialogs — rendered as soon as user is authenticated, userData is optional (nullable) */}
      {user && (
        <>
          <AddFamiliareDialog
            isOpen={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            membroToEdit={editingMembro}
            user={user}
            userData={userData}
          />
          <JoinFamilyDialog
            isOpen={isJoinDialogOpen}
            onOpenChange={setIsJoinDialogOpen}
            user={user}
            userData={userData}
            onSuccess={() => {
              setIsJoinDialogOpen(false);
            }}
          />
        </>
      )}

      <ConfirmationDialog
        isOpen={!!membroToDelete}
        onOpenChange={(isOpen) => !isOpen && setMembroToDelete(null)}
        title="Conferma Eliminazione"
        description={`Sei sicuro di voler eliminare ${membroToDelete?.nome} ${membroToDelete?.cognome} dalla famiglia?`}
        onConfirm={handleDelete}
        confirmLabel="Elimina"
        confirmVariant="destructive"
      />

      {/* Members table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>Data di Nascita</TableHead>
                <TableHead className="hidden md:table-cell">Indirizzo</TableHead>
                <TableHead><span className="sr-only">Azioni</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">Caricamento...</TableCell>
                </TableRow>
              )}
              {!isLoading && membri && membri.length > 0
                ? membri.map((membro) => {
                    const memberName = `${membro.nome ?? ''} ${membro.cognome ?? ''}`.trim().toLowerCase();
                    const isOwnRecord = ownMemberName && memberName === ownMemberName;
                    const isLinkedRecord = !!membro.linkedUserId;
                    return (
                      <TableRow
                        key={membro.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleEdit(membro)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            {membro.nome} {membro.cognome}
                            {isOwnRecord && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Il mio profilo</Badge>
                            )}
                            {isLinkedRecord && !isOwnRecord && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-blue-600 border-blue-300">
                                Account collegato
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(membro.dataNascita)}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{familyAddress}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button aria-haspopup="true" size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Azioni</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => handleEdit(membro)}>Modifica</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setMembroToDelete(membro)} className="text-destructive">
                                Elimina
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                : !isLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                        <div className="flex flex-col items-center gap-3">
                          <Users className="h-10 w-10 text-muted-foreground/30" />
                          <div>
                            <p className="font-medium">Nessun membro trovato</p>
                            <p className="text-sm mt-1">
                              Aggiungi un membro o unisciti a una famiglia esistente.
                            </p>
                          </div>
                          <div className="flex gap-2 mt-1">
                            <Button size="sm" variant="outline" onClick={() => setIsJoinDialogOpen(true)}>
                              <LogIn className="h-3.5 w-3.5 mr-1" />
                              Unisciti a una Famiglia
                            </Button>
                            <Button size="sm" onClick={handleAddNew}>
                              <PlusCircle className="h-3.5 w-3.5 mr-1" />
                              Aggiungi Membro
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
              }
              {error && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-destructive">
                    Si è verificato un errore nel caricamento dei dati.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {hasFamilyMembers && (
        <p className="text-xs text-muted-foreground text-center">
          Clicca su un membro per modificarne anagrafica, allergie e consensi.
          Tutti i membri con account collegato possono modificare i dati del nucleo.
        </p>
      )}


    </div>
  );
}
