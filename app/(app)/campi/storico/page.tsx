'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArchiveRestore, Tent, CalendarDays, BookOpen, GraduationCap, Sun, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useUserData } from '@/src/hooks/use-user-data';
import type { Campo, TipoCampo } from '@/components/add-event-dialog';

const TIPO_CONFIG: Record<TipoCampo, { label: string; icon: React.ElementType; color: string }> = {
  campo_elementari: { label: 'Campo Elementari', icon: BookOpen, color: 'text-green-700 dark:text-green-400' },
  campo_medie: { label: 'Campo Medie', icon: GraduationCap, color: 'text-blue-700 dark:text-blue-400' },
  campo_estivo: { label: 'Campo Estivo', icon: Sun, color: 'text-amber-700 dark:text-amber-400' },
};

const formatDateRange = (start: any, end: any) => {
  const toDate = (d: any) => d?.toDate ? d.toDate() : new Date(d);
  try {
    const s = toDate(start);
    const e = toDate(end);
    const sStr = format(s, 'd MMM yyyy', { locale: it });
    const eStr = format(e, 'd MMM yyyy', { locale: it });
    return sStr === eStr ? sStr : `${sStr} – ${eStr}`;
  } catch { return ''; }
};

export default function StoricoCampiPage() {
  const firestore = useFirestore();
  const { userData } = useUserData();
  const isAdmin = userData?.roles?.includes('admin');
  const canRestore = isAdmin || userData?.roles?.includes('educatore');

  const archiviatiQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'campi'), where('status', '==', 'archiviato'), orderBy('startDate', 'desc')) : null,
    [firestore]
  );
  const { data: archiviati, isLoading } = useCollection<Campo>(archiviatiQuery);

  const handleRipristina = async (campoId: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'campi', campoId), { status: 'attivo' });
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <div className="flex items-center gap-3">
          <Tent className="h-7 w-7 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Storico Campi</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">Campi conclusi e archiviati.</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (!archiviati || archiviati.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center">
            <Tent className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium">Nessun campo archiviato</p>
            <p className="text-sm text-muted-foreground mt-1">I campi conclusi appariranno qui.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && archiviati && archiviati.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {archiviati.map(campo => {
            const cfg = TIPO_CONFIG[campo.tipo] ?? TIPO_CONFIG.campo_estivo;
            const Icon = cfg.icon;
            return (
              <Card key={campo.id} className="flex flex-col opacity-80 hover:opacity-100 transition-opacity">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base">{campo.nome}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDateRange(campo.startDate, campo.endDate)}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className={`text-xs shrink-0 ${cfg.color}`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {cfg.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-4 flex items-center justify-between gap-2 mt-auto">
                  <Badge variant="outline" className="text-muted-foreground text-xs">Archiviato</Badge>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/campi/${campo.id}`}>Visualizza</Link>
                    </Button>
                    {canRestore && (
                      <Button variant="outline" size="sm" onClick={() => handleRipristina(campo.id)}>
                        <ArchiveRestore className="h-3.5 w-3.5 mr-1" />
                        Ripristina
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
