'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, Bus, ShoppingCart, Calculator } from 'lucide-react';
import TabCase from './tab-case';
import TabPullman from './tab-pullman';
import TabSpesa from './tab-spesa';
import TabPreventivo from './tab-preventivo';

export default function CampiPage() {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Campi</h1>
        <p className="text-muted-foreground mt-1">Gestione alloggi, trasporti, spesa e preventivi per i campi</p>
      </div>

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
            <span className="hidden sm:inline">Preventivo Costi</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="case" className="mt-6">
          <TabCase />
        </TabsContent>
        <TabsContent value="pullman" className="mt-6">
          <TabPullman />
        </TabsContent>
        <TabsContent value="spesa" className="mt-6">
          <TabSpesa />
        </TabsContent>
        <TabsContent value="preventivo" className="mt-6">
          <TabPreventivo />
        </TabsContent>
      </Tabs>
    </div>
  );
}
