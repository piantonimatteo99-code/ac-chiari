'use client';

import { useState, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/src/firebase';
import type { FormSchema, FormQuestion, QuestionType } from '@/src/types/form-types';
import { QuestionEditor } from './question-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Save, Eye, Loader2, Link2, Copy, Check,
  ClipboardList, Settings, Sparkles,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { AiFormGeneratorDialog } from './ai-form-generator-dialog';

const DEFAULT_QUESTION = (): FormQuestion => ({
  id: nanoid(8),
  type: 'text',
  label: '',
  required: false,
});

interface Props {
  projectId: string;
  existingForm?: FormSchema;
  onSaved?: (formId: string) => void;
}

export function FormBuilder({ projectId, existingForm, onSaved }: Props) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [title, setTitle] = useState(existingForm?.title ?? '');
  const [description, setDescription] = useState(existingForm?.description ?? '');
  const [questions, setQuestions] = useState<FormQuestion[]>(
    existingForm?.questions ?? [DEFAULT_QUESTION()]
  );
  const [isPublic, setIsPublic] = useState(existingForm?.isPublic ?? true);
  const [allowAnonymous, setAllowAnonymous] = useState(existingForm?.allowAnonymous ?? true);
  const [generateCollection, setGenerateCollection] = useState(existingForm?.generateCollection ?? false);
  const [collectionTitle, setCollectionTitle] = useState(existingForm?.collectionTitle ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedFormId, setSavedFormId] = useState<string | null>(existingForm?.id ?? null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'domande' | 'impostazioni'>('domande');
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const addQuestion = () => {
    setQuestions(qs => [...qs, DEFAULT_QUESTION()]);
  };

  // Carica lo schema generato dall'AI nel builder (dopo approvazione)
  const handleAiApprove = (schema: Partial<FormSchema>) => {
    if (schema.title) setTitle(schema.title);
    if (schema.description) setDescription(schema.description);
    if (schema.questions && schema.questions.length > 0) {
      // Assicura che ogni domanda abbia un ID valido
      setQuestions(schema.questions.map(q => ({ ...q, id: q.id || nanoid(8) })));
    }
    if (schema.generateCollection !== undefined) setGenerateCollection(schema.generateCollection);
    if (schema.collectionTitle) setCollectionTitle(schema.collectionTitle);
    setActiveTab('domande');
  };

  const updateQuestion = useCallback((index: number, q: FormQuestion) => {
    setQuestions(qs => qs.map((old, i) => i === index ? q : old));
  }, []);

  const deleteQuestion = useCallback((index: number) => {
    setQuestions(qs => qs.filter((_, i) => i !== index));
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    setQuestions(qs => {
      const arr = [...qs];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr;
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setQuestions(qs => {
      if (index === qs.length - 1) return qs;
      const arr = [...qs];
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      return arr;
    });
  }, []);

  const handleSave = async (status: 'draft' | 'active' = 'draft') => {
    if (!firestore || !user) return;
    if (!title.trim()) {
      toast({ title: 'Titolo obbligatorio', variant: 'destructive' });
      return;
    }
    if (questions.length === 0) {
      toast({ title: 'Aggiungi almeno una domanda', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        projectId,
        createdBy: user.uid,
        title: title.trim(),
        description: description.trim() || null,
        questions,
        isPublic,
        allowAnonymous,
        generateCollection,
        collectionTitle: generateCollection ? (collectionTitle.trim() || title.trim()) : null,
        status,
        updatedAt: serverTimestamp(),
      };

      let formId = savedFormId;
      if (formId && existingForm) {
        await updateDoc(doc(firestore, 'forms', formId), payload);
      } else {
        const ref = await addDoc(collection(firestore, 'forms'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        formId = ref.id;
        setSavedFormId(formId);
      }

      toast({
        title: status === 'active' ? 'Modulo pubblicato!' : 'Modulo salvato',
        description: status === 'active' ? 'Il link è ora condivisibile.' : 'Salvato come bozza.',
      });
      onSaved?.(formId!);
    } catch (e) {
      console.error(e);
      toast({ title: 'Errore nel salvataggio', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const formUrl = savedFormId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/f/${savedFormId}`
    : null;

  const copyLink = () => {
    if (!formUrl) return;
    navigator.clipboard.writeText(formUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* ── Header toolbar ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-base">
            {existingForm ? 'Modifica Modulo' : 'Nuovo Modulo'}
          </h2>
          {savedFormId && (
            <Badge variant={existingForm?.status === 'active' ? 'default' : 'secondary'}>
              {existingForm?.status === 'active' ? 'Attivo' : 'Bozza'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pulsante AI */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
            onClick={() => setAiDialogOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Genera con AI
          </Button>
          {savedFormId && (
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiato!' : 'Copia link'}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => handleSave('draft')} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salva bozza
          </Button>
          <Button size="sm" className="gap-1.5 h-8" onClick={() => handleSave('active')} disabled={isSaving}>
            <Eye className="h-3.5 w-3.5" />
            Pubblica
          </Button>
        </div>
      </div>

      {/* ── Link pubblico (se già salvato e attivo) ── */}
      {formUrl && existingForm?.status === 'active' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Link2 className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs text-primary font-medium truncate flex-1">{formUrl}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copyLink}>
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b pb-0">
        {(['domande', 'impostazioni'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'domande' ? 'Domande' : 'Impostazioni'}
          </button>
        ))}
      </div>

      {/* ══ TAB: DOMANDE ══ */}
      {activeTab === 'domande' && (
        <div className="space-y-4">
          {/* Titolo e descrizione del form */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Titolo del modulo *</Label>
                <Input
                  id="form-title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Es: Prenotazione pranzo sociale 2025"
                  className="text-base font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Descrizione (opzionale)</Label>
                <Textarea
                  id="form-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Breve spiegazione del modulo..."
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Lista domande */}
          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={i}
                total={questions.length}
                onChange={nq => updateQuestion(i, nq)}
                onDelete={() => deleteQuestion(i)}
                onMoveUp={() => moveUp(i)}
                onMoveDown={() => moveDown(i)}
              />
            ))}
          </div>

          <Button
            variant="outline"
            className="w-full border-dashed gap-2 h-10"
            onClick={addQuestion}
          >
            <Plus className="h-4 w-4" />
            Aggiungi domanda
          </Button>
        </div>
      )}

      {/* ══ TAB: IMPOSTAZIONI ══ */}
      {activeTab === 'impostazioni' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Accesso e compilazione
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Modulo pubblico</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Accessibile tramite link condiviso
                  </p>
                </div>
                <Switch
                  id="form-public"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Consenti compilazione anonima</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    I compilatori non devono avere un account
                  </p>
                </div>
                <Switch
                  id="form-anon"
                  checked={allowAnonymous}
                  onCheckedChange={setAllowAnonymous}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Raccolta automatica
              </CardTitle>
              <CardDescription className="text-xs">
                Dopo l'invio, le risposte verranno raccolte in una tabella riepilogativa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Genera raccolta automatica</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Crea una tabella con riepilogo risposte e totali
                  </p>
                </div>
                <Switch
                  id="form-collection"
                  checked={generateCollection}
                  onCheckedChange={setGenerateCollection}
                />
              </div>

              {generateCollection && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Titolo della raccolta</Label>
                    <Input
                      id="form-collection-title"
                      value={collectionTitle}
                      onChange={e => setCollectionTitle(e.target.value)}
                      placeholder={title || 'Es: Riepilogo prenotazioni pranzo'}
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Spiegazione del flusso */}
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-800">Come funziona:</p>
                    <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                      <li>Dopo l'invio del modulo, il compilatore vedrà un riepilogo</li>
                      <li>Verrà chiesto se è iscritto al portale</li>
                      <li>
                        <strong>Sì → </strong>
                        Potrà accedere al suo account: la riga sarà collegata al profilo
                      </li>
                      <li>
                        <strong>No → </strong>
                        Inserirà nome + email come identificativo anonimo
                      </li>
                      <li>Il creatore vede tutte le righe nella dashboard risposte</li>
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Dialog AI generator ── */}
      <AiFormGeneratorDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onApprove={handleAiApprove}
      />
    </div>
  );
}
