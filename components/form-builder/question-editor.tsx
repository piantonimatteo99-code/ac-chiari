'use client';

import { useState } from 'react';
import { nanoid } from 'nanoid';
import {
  Card, CardContent, CardHeader,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GripVertical, Trash2, Plus, X, ChevronUp, ChevronDown,
  Type, AlignLeft, CircleDot, CheckSquare, Hash, ListOrdered,
  Mail, Phone, Tag, LayoutGrid,
} from 'lucide-react';
import type { FormQuestion, QuestionType, QuestionOption } from '@/src/types/form-types';

const QUESTION_TYPES: { value: QuestionType; label: string; icon: React.ElementType }[] = [
  { value: 'text',             label: 'Testo breve',            icon: Type },
  { value: 'textarea',         label: 'Testo lungo',            icon: AlignLeft },
  { value: 'single_choice',    label: 'Scelta singola',         icon: CircleDot },
  { value: 'multiple_choice',  label: 'Scelta multipla',        icon: CheckSquare },
  { value: 'number',           label: 'Numero',                 icon: Hash },
  { value: 'select',           label: 'Menu a tendina',         icon: ListOrdered },
  { value: 'email',            label: 'Email',                  icon: Mail },
  { value: 'phone',            label: 'Telefono',               icon: Phone },
  { value: 'price_item',       label: 'Voce con prezzo',        icon: Tag },
  { value: 'quantity_picker',  label: 'Quantità per opzione',   icon: LayoutGrid },
];

const HAS_OPTIONS: QuestionType[] = ['single_choice', 'multiple_choice', 'select', 'price_item', 'quantity_picker'];

interface Props {
  question: FormQuestion;
  index: number;
  total: number;
  onChange: (q: FormQuestion) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function QuestionEditor({ question, index, total, onChange, onDelete, onMoveUp, onMoveDown }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const update = (patch: Partial<FormQuestion>) => onChange({ ...question, ...patch });

  const addOption = () => {
    const opts = question.options ?? [];
    update({ options: [...opts, { id: nanoid(6), label: '', price: undefined }] });
  };

  const updateOption = (id: string, patch: Partial<QuestionOption>) => {
    update({
      options: question.options?.map(o => o.id === id ? { ...o, ...patch } : o),
    });
  };

  const removeOption = (id: string) => {
    update({ options: question.options?.filter(o => o.id !== id) });
  };

  const typeInfo = QUESTION_TYPES.find(t => t.value === question.type);
  const Icon = typeInfo?.icon ?? Type;

  return (
    <Card className="border-l-4 border-l-primary/40 group">
      {/* ── Header ── */}
      <CardHeader className="flex flex-row items-center gap-3 py-3 px-4">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate text-muted-foreground">
            {index + 1}. {question.label || 'Nuova domanda'}
          </span>
          {question.required && (
            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold shrink-0">
              Obbligatoria
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={index === 0}>
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={index === total - 1}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* ── Body ── */}
      {!collapsed && (
        <CardContent className="px-4 pb-4 space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo di domanda</Label>
              <Select value={question.type} onValueChange={v => update({ type: v as QuestionType, options: HAS_OPTIONS.includes(v as QuestionType) ? (question.options ?? []) : undefined })}>
                <SelectTrigger id={`q-type-${question.id}`} className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <t.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                id={`q-req-${question.id}`}
                checked={question.required}
                onCheckedChange={v => update({ required: v })}
              />
              <Label htmlFor={`q-req-${question.id}`} className="text-xs cursor-pointer">
                Obbligatoria
              </Label>
            </div>
          </div>

          {/* Testo domanda */}
          <div className="space-y-1.5">
            <Label className="text-xs">Testo della domanda *</Label>
            <Input
              id={`q-label-${question.id}`}
              value={question.label}
              onChange={e => update({ label: e.target.value })}
              placeholder="Es: Quanti partecipanti?"
              className="h-8 text-sm"
            />
          </div>

          {/* Descrizione/aiuto */}
          <div className="space-y-1.5">
            <Label className="text-xs">Descrizione / istruzione (opzionale)</Label>
            <Input
              id={`q-desc-${question.id}`}
              value={question.description ?? ''}
              onChange={e => update({ description: e.target.value })}
              placeholder="Es: Includi anche i bambini"
              className="h-8 text-sm"
            />
          </div>

          {/* Placeholder (per testo/numero/email/phone) */}
          {!HAS_OPTIONS.includes(question.type) && (
            <div className="space-y-1.5">
              <Label className="text-xs">Testo segnaposto</Label>
              <Input
                id={`q-ph-${question.id}`}
                value={question.placeholder ?? ''}
                onChange={e => update({ placeholder: e.target.value })}
                placeholder="Es: Scrivi qui la tua risposta..."
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* Limite numerico */}
          {question.type === 'number' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valore minimo</Label>
                <Input
                  id={`q-min-${question.id}`}
                  type="number"
                  value={question.minValue ?? ''}
                  onChange={e => update({ minValue: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valore massimo</Label>
                <Input
                  id={`q-max-${question.id}`}
                  type="number"
                  value={question.maxValue ?? ''}
                  onChange={e => update({ maxValue: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {/* Opzioni (choice/select/price_item/quantity_picker) */}
          {HAS_OPTIONS.includes(question.type) && (
            <div className="space-y-2">
              <Label className="text-xs">
                Opzioni
                {(question.type === 'price_item' || question.type === 'quantity_picker') && (
                  <span className="ml-1 text-muted-foreground font-normal">(con prezzo € per opzione)</span>
                )}
              </Label>
              <div className="space-y-2">
                {(question.options ?? []).map((opt, oi) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{oi + 1}.</span>
                    <Input
                      id={`q-opt-label-${opt.id}`}
                      value={opt.label}
                      onChange={e => updateOption(opt.id, { label: e.target.value })}
                      placeholder="Etichetta opzione"
                      className="h-7 text-sm flex-1"
                    />
                    {(question.type === 'price_item' || question.type === 'quantity_picker') && (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">€</span>
                        <Input
                          id={`q-opt-price-${opt.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={opt.price ?? ''}
                          onChange={e => updateOption(opt.id, { price: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="0.00"
                          className="h-7 text-sm w-20"
                        />
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeOption(opt.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={addOption}>
                <Plus className="h-3 w-3" />
                Aggiungi opzione
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
