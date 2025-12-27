'use client';
import { useFirestore } from '@/src/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from "@/components/ui/input";
import { useDebounce } from 'use-debounce';


// Definiamo i tipi per i dati che useremo
interface User {
  id: string;
  nome: string;
  cognome: string;
  dataNascita?: string;
  luogoNascita?: string;
  codiceFiscale?: string;
  via?: string;
  numeroCivico?: string;
  citta?: string;
  provincia?: string;
  cap?: string;
  email: string;
}

interface Membro {
  id: string;
  nome: string;
  cognome: string;
  dataNascita?: string;
  luogoNascita?: string;
  codiceFiscale?: string;
}

interface CombinedData {
  id: string;
  nome: string;
  cognome: string;
  dataNascita?: string;
  luogoNascita?: string;
  codiceFiscale?: string;
  residenza: string;
  membriNucleo: Membro[];
  isCapofamiglia: boolean;
}

export default function DatabasePage() {
  const firestore = useFirestore();
  const [data, setData] = useState<CombinedData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  

  useEffect(() => {
    const fetchData = async () => {
      if (!firestore) return;

      setIsLoading(true);
      setError(null);

      try {
        // 1. Prendi tutti gli utenti
        const usersSnapshot = await getDocs(collection(firestore, 'users'));
        const usersList: User[] = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

        // 2. Prendi tutte le famiglie e i loro membri
        const famiglieSnapshot = await getDocs(collection(firestore, 'famiglie'));
        const famiglieMap = new Map<string, { residenza: string; membri: Membro[], uidCapofamiglia: string }>();

        for (const famigliaDoc of famiglieSnapshot.docs) {
          const famigliaData = famigliaDoc.data();
          const residenza = `${famigliaData.via || ''} ${famigliaData.numeroCivico || ''}, ${famigliaData.citta || ''} (${famigliaData.provincia || ''}) ${famigliaData.cap || ''}`.trim();
          
          const membriSnapshot = await getDocs(collection(firestore, 'famiglie', famigliaDoc.id, 'membri'));
          const membriList: Membro[] = membriSnapshot.docs.map(membroDoc => ({ id: membroDoc.id, ...membroDoc.data() } as Membro));
          
          famiglieMap.set(famigliaData.uidCapofamiglia, { residenza, membri: membriList, uidCapofamiglia: famigliaData.uidCapofamiglia });
        }

        // 3. Combina i dati
        const combinedList: CombinedData[] = usersList.map(user => {
          const famiglia = famiglieMap.get(user.id);
          const residenzaCompleta = famiglia ? famiglia.residenza : `${user.via || ''} ${user.numeroCivico || ''}, ${user.citta || ''} (${user.provincia || ''}) ${user.cap || ''}`.trim();

          return {
            id: user.id,
            nome: user.nome,
            cognome: user.cognome,
            dataNascita: user.dataNascita,
            luogoNascita: user.luogoNascita,
            codiceFiscale: user.codiceFiscale,
            residenza: residenzaCompleta === ',' ? 'Non specificata' : residenzaCompleta,
            membriNucleo: famiglia ? famiglia.membri : [],
            isCapofamiglia: !!famiglia,
          };
        });

        // Potremmo avere membri che non sono utenti registrati. Aggiungiamoli.
        const allMembri: CombinedData[] = [];
        famiglieMap.forEach(famiglia => {
            famiglia.membri.forEach(membro => {
                // Aggiungi solo se non è già presente come utente (capofamiglia)
                if (!usersList.some(user => user.codiceFiscale && user.codiceFiscale === membro.codiceFiscale)) {
                     allMembri.push({
                        id: membro.id,
                        nome: membro.nome,
                        cognome: membro.cognome,
                        dataNascita: membro.dataNascita,
                        luogoNascita: membro.luogoNascita,
                        codiceFiscale: membro.codiceFiscale,
                        residenza: famiglia.residenza,
                        membriNucleo: [], // Non ha senso ripeterlo
                        isCapofamiglia: false,
                    });
                }
            });
        });

        const finalData = [...combinedList, ...allMembri.filter(m => !combinedList.some(c => c.codiceFiscale && c.codiceFiscale === m.codiceFiscale))];


        setData(finalData);
      } catch (e) {
        console.error("Errore nel caricamento dati per anagrafe:", e);
        setError('Si è verificato un errore durante il caricamento dei dati.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [firestore]);
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return ''
    }
  }
  
  const filteredData = useMemo(() => {
    const lowercasedFilter = debouncedSearchTerm.toLowerCase();
    if (!lowercasedFilter) {
      return data;
    }
    return data.filter(item => {
      const membriString = item.isCapofamiglia 
        ? item.membriNucleo.map(m => m.nome).join(', ')
        : 'Membro';

      return (
        item.nome?.toLowerCase().includes(lowercasedFilter) ||
        item.cognome?.toLowerCase().includes(lowercasedFilter) ||
        formatDate(item.dataNascita).includes(lowercasedFilter) ||
        item.luogoNascita?.toLowerCase().includes(lowercasedFilter) ||
        item.codiceFiscale?.toLowerCase().includes(lowercasedFilter) ||
        item.residenza?.toLowerCase().includes(lowercasedFilter) ||
        membriString.toLowerCase().includes(lowercasedFilter)
      );
    });
  }, [data, debouncedSearchTerm]);

  return (
    <div className="flex flex-col gap-4">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Database Anagrafico</h1>
      </div>
      <Card>
        <CardHeader>
             <Input 
                placeholder="Cerca in tutto il database..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 text-base"
             />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cognome</TableHead>
                <TableHead>Data di Nascita</TableHead>
                <TableHead>Luogo di Nascita</TableHead>
                <TableHead>Codice Fiscale</TableHead>
                <TableHead>Residenza</TableHead>
                <TableHead>Componenti Nucleo</TableHead>
                <TableHead>Classe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">Caricamento...</TableCell>
                </TableRow>
              )}
              {!isLoading && filteredData.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={8} className="text-center">
                        {debouncedSearchTerm 
                            ? "Nessun risultato per la tua ricerca."
                            : "Nessun dato presente nel database."
                        }
                    </TableCell>
                </TableRow>
              )}
               {!isLoading && error && (
                 <TableRow>
                    <TableCell colSpan={8} className="text-center text-destructive">{error}</TableCell>
                </TableRow>
              )}
              {!isLoading && filteredData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell>{item.cognome}</TableCell>
                  <TableCell>{formatDate(item.dataNascita)}</TableCell>
                  <TableCell>{item.luogoNascita || 'N/A'}</TableCell>
                  <TableCell>{item.codiceFiscale || 'N/A'}</TableCell>
                  <TableCell>{item.residenza || 'N/A'}</TableCell>
                  <TableCell>
                    {item.isCapofamiglia 
                        ? item.membriNucleo.map(m => m.nome).join(', ') || 'Nessuno'
                        : 'Membro'
                    }
                  </TableCell>
                  <TableCell>_</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
