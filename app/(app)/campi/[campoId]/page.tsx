'use client';

import { use } from 'react';
import { useFirestore, useMemoFirebase, useDoc } from '@/src/firebase';
import { doc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, Bus, ShoppingCart, Calculator, ArrowLeft, CalendarDays, GraduationCap, BookOpen, Sun, Tent, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import TabCase from '../tab-case';
import TabPullman from '../tab-pullman';
import TabSpesaCampo from './tab-spesa-campo';
import TabPreventivooCampo from './tab-preventivo-campo';
import type { Campo, TipoCampo } from '@/components/add-event-dialog';

const TIPO_CONFIG: Record<TipoCampo, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  campo_elementari: {
    label: 'Campo Elementari',
    icon: BookOpen,
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
  },
  campo_medie: {
    label: 'Campo Medie',
    icon: GraduationCap,
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  },
  campo_estivo: {
    label: 'Campo Estivo',
    icon: Sun,
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  },
};

const formatDateRange = (start: any, end: any) => {
  const toDate = (d: any) => d?.toDate ? d.toDate() : new Date(d);
  try {
    const s = toDate(start);
    const e = toDate(end);
    const sStr = format(s, 'd MMMM yyyy', { locale: it });
    const eStr = format(e, 'd MMMM yyyy', { locale: it });
    return sStr === eStr ? sStr : `${sStr} – ${eStr}`;
  } catch {
    return '';
  }
};

export default function CampoDetailPage({ params }: { params: Promise<{ campoId: string }> }) {
  const { campoId } = use(params);
  const firestore = useFirestore();

  const campoDocRef = useMemoFirebase(
    () => firestore ? doc(firestore, 'campi', campoId) : null,
    [firestore, campoId]
  );
  const { data: campo, isLoading } = useDoc<Campo>(campoDocRef);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campo) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/campi"><ArrowLeft className="h-4 w-4 mr-2" />Torna ai campi</Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Campo non trovato.
          </CardContent>
        </Card>
      </div>
    );
  }

  const tipoConfig = TIPO_CONFIG[campo.tipo] ?? TIPO_CONFIG.campo_estivo;
  const Icon = tipoConfig.icon;

  return (
    <div className="space-y-6 pb-10">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/campi">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Tutti i campi
        </Link>
      </Button>

      {/* Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border ${tipoConfig.bgColor}`}>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-background/60">
            <Tent className={`h-6 w-6 ${tipoConfig.color}`} />
          </div>
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${tipoConfig.color}`}>{campo.nome}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDateRange(campo.startDate, campo.endDate)}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className={`self-start sm:self-auto text-sm gap-1.5 px-3 py-1 ${tipoConfig.color}`}>
          <Icon className="h-4 w-4" />
          {tipoConfig.label}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="case" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="case" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Case</span>
          </TabsTrigger>
          <TabsTrigger value="pullman" className="flex items-center gap-2">
            <Bus className="h-4 w-4" />
            <span className="hidden sm:inline">Pullman</span>
          </TabsTrigger>
          <TabsTrigger value="spesa" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Spesa</span>
          </TabsTrigger>
          <TabsTrigger value="preventivo" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Preventivo</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="case" className="mt-6">
          <TabCase />
        </TabsContent>
        <TabsContent value="pullman" className="mt-6">
          <TabPullman />
        </TabsContent>
        <TabsContent value="spesa" className="mt-6">
          <TabSpesaCampo campoId={campoId} />
        </TabsContent>
        <TabsContent value="preventivo" className="mt-6">
          <TabPreventivooCampo campoId={campoId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
