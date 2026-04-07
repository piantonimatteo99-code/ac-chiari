'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowRight, GraduationCap, BookOpen, Sun, Tent, CalendarDays, Info } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import type { Campo, TipoCampo } from '@/components/add-event-dialog';

const TIPO_CONFIG: Record<TipoCampo, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  campo_elementari: {
    label: 'Campo Elementari',
    icon: BookOpen,
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
  },
  campo_medie: {
    label: 'Campo Medie',
    icon: GraduationCap,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  },
  campo_estivo: {
    label: 'Campo Estivo',
    icon: Sun,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  },
};

const TIPI: TipoCampo[] = ['campo_elementari', 'campo_medie', 'campo_estivo'];

const formatDateRange = (start: any, end: any) => {
  const toDate = (d: any) => d?.toDate ? d.toDate() : new Date(d);
  try {
    const s = toDate(start);
    const e = toDate(end);
    const sStr = format(s, 'd MMM yyyy', { locale: it });
    const eStr = format(e, 'd MMM yyyy', { locale: it });
    return sStr === eStr ? sStr : `${sStr} – ${eStr}`;
  } catch {
    return '';
  }
};

function CampoCard({ campo }: { campo: Campo }) {
  const cfg = TIPO_CONFIG[campo.tipo];
  const Icon = cfg.icon;
  return (
    <Link href={`/campi/${campo.id}`}>
      <Card className="hover:border-primary hover:shadow-md transition-all h-full flex flex-col justify-between group">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="text-base group-hover:text-primary transition-colors">{campo.nome}</CardTitle>
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
        <div className="flex justify-end p-4 pt-0 mt-auto">
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </Card>
    </Link>
  );
}

export default function CampiPage() {
  const firestore = useFirestore();

  const campiQ = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'campi'), orderBy('startDate', 'desc')) : null,
    [firestore]
  );
  const { data: campi, isLoading } = useCollection<Campo>(campiQ);

  const isEmpty = !isLoading && (!campi || campi.length === 0);
  const hasCampi = !isLoading && campi && campi.length > 0;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Tent className="h-8 w-8 text-primary" />
          Campi
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestione alloggi, trasporti, spesa e preventivi – sezioni separate per ogni campo
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-32 animate-pulse bg-muted/50" />
          ))}
        </div>
      )}

      {isEmpty && (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center space-y-3">
            <Tent className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="font-medium">Nessun campo presente</p>
              <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Info className="h-3.5 w-3.5" />
                Crea un campo dal Calendario aggiungendo un impegno di tipo ⛺ Campo
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {hasCampi && TIPI.map(tipo => {
        const campiDiTipo = campi!.filter(c => c.tipo === tipo);
        if (campiDiTipo.length === 0) return null;

        const cfg = TIPO_CONFIG[tipo];
        const Icon = cfg.icon;

        return (
          <section key={tipo} className="space-y-4">
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${cfg.bgColor}`}>
              <Icon className={`h-5 w-5 ${cfg.color}`} />
              <h2 className={`text-lg font-semibold ${cfg.color}`}>{cfg.label}</h2>
              <Badge variant="outline" className="ml-auto text-xs">
                {campiDiTipo.length} {campiDiTipo.length === 1 ? 'campo' : 'campi'}
              </Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campiDiTipo.map(campo => (
                <CampoCard key={campo.id} campo={campo} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
