'use client';

import { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { useFirestore, useUser } from '@/src/firebase';
import type { FormSchema } from '@/src/types/form-types';
import { FormBuilder } from './form-builder';
import { FormResponsesDashboard } from './form-responses-dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList, Plus, ChevronRight, Eye, EyeOff,
  BarChart2, Edit2, Copy, Check, Link2,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Props {
  projectId: string;
  canEdit: boolean;
}

type View = 'list' | 'builder' | 'responses';

export function ProjectFormsSection({ projectId, canEdit }: Props) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [forms, setForms] = useState<FormSchema[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selectedForm, setSelectedForm] = useState<FormSchema | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore || !projectId) return;
    const q = query(collection(firestore, 'forms'), where('projectId', '==', projectId));
    return onSnapshot(q, snap => {
      setForms(snap.docs.map(d => ({ id: d.id, ...d.data() } as FormSchema)));
      setIsLoading(false);
    });
  }, [firestore, projectId]);

  const copyLink = (formId: string) => {
    const url = `${window.location.origin}/f/${formId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(formId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Link copiato!' });
  };

  const toggleStatus = async (form: FormSchema) => {
    if (!firestore) return;
    const newStatus = form.status === 'active' ? 'closed' : 'active';
    await updateDoc(doc(firestore, 'forms', form.id), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
    toast({ title: newStatus === 'active' ? 'Modulo aperto' : 'Modulo chiuso' });
  };

  const formatDate = (ts: any) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return format(d, 'dd MMM yyyy', { locale: it });
  };

  // ── Breadcrumb nav ──
  const BreadCrumb = () => (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
      <button className="hover:text-foreground transition-colors" onClick={() => { setView('list'); setSelectedForm(null); }}>
        Moduli
      </button>
      {view !== 'list' && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">
            {view === 'builder'
              ? (selectedForm ? 'Modifica modulo' : 'Nuovo modulo')
              : `Risposte: ${selectedForm?.title}`}
          </span>
        </>
      )}
    </div>
  );

  // ── View: Builder ──
  if (view === 'builder') {
    return (
      <div>
        <BreadCrumb />
        <FormBuilder
          projectId={projectId}
          existingForm={selectedForm ?? undefined}
          onSaved={id => {
            setView('list');
            setSelectedForm(null);
          }}
        />
      </div>
    );
  }

  // ── View: Responses ──
  if (view === 'responses' && selectedForm) {
    return (
      <div>
        <BreadCrumb />
        <FormResponsesDashboard form={selectedForm} canEdit={canEdit} />
      </div>
    );
  }

  // ── View: List ──
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Caricamento...' : `${forms.length} modulo${forms.length !== 1 ? 'i' : ''}`}
        </p>
        {canEdit && (
          <Button
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={() => { setSelectedForm(null); setView('builder'); }}
          >
            <Plus className="h-3.5 w-3.5" />
            Nuovo modulo
          </Button>
        )}
      </div>

      {!isLoading && forms.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10 border border-dashed rounded-xl text-muted-foreground">
          <ClipboardList className="h-8 w-8 opacity-40" />
          <p className="text-sm">Nessun modulo creato.</p>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => { setSelectedForm(null); setView('builder'); }}
            >
              <Plus className="h-3.5 w-3.5" />
              Crea il primo modulo
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {forms.map(form => (
          <Card key={form.id} className="overflow-hidden hover:shadow-sm transition-shadow">
            <CardContent className="p-0">
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Icona stato */}
                <div className={`w-2 h-8 rounded-full shrink-0 ${
                  form.status === 'active' ? 'bg-green-500' :
                  form.status === 'draft' ? 'bg-amber-400' : 'bg-muted-foreground/30'
                }`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{form.title}</p>
                    <Badge
                      variant={form.status === 'active' ? 'default' : form.status === 'draft' ? 'secondary' : 'outline'}
                      className="text-xs shrink-0"
                    >
                      {form.status === 'active' ? 'Attivo' : form.status === 'draft' ? 'Bozza' : 'Chiuso'}
                    </Badge>
                    {form.generateCollection && (
                      <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 shrink-0">
                        Raccolta auto
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {form.questions.length} domande · {formatDate(form.createdAt)}
                  </p>
                </div>

                {/* Azioni */}
                <div className="flex items-center gap-1 shrink-0">
                  {form.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Copia link pubblico"
                      onClick={() => copyLink(form.id)}
                    >
                      {copiedId === form.id
                        ? <Check className="h-3.5 w-3.5 text-green-500" />
                        : <Link2 className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Vedi risposte"
                    onClick={() => { setSelectedForm(form); setView('responses'); }}
                  >
                    <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  {canEdit && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Modifica"
                        onClick={() => { setSelectedForm(form); setView('builder'); }}
                      >
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={form.status === 'active' ? 'Chiudi modulo' : 'Apri modulo'}
                        onClick={() => toggleStatus(form)}
                      >
                        {form.status === 'active'
                          ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
