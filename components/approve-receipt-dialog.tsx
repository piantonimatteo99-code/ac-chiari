'use client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, Trash2, ExternalLink, Copy } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { FlatPayment } from '@/app/(app)/contabilita/transazioni-da-controllare/page';

const getReceiptPreview = (url: string): { type: 'drive' | 'image' | 'link'; previewUrl: string } => {
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/file\/d\/([^/?]+)/);
        if (match) return { type: 'drive', previewUrl: `https://drive.google.com/file/d/${match[1]}/preview` };
    }
    if (url.includes('firebasestorage') || /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)) {
        return { type: 'image', previewUrl: url };
    }
    return { type: 'link', previewUrl: url };
};

const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

interface ApproveReceiptDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    payment: FlatPayment;
    onApprove: () => void;
    onReject: () => void;
}

export function ApproveReceiptDialog({ isOpen, onOpenChange, payment, onApprove, onReject }: ApproveReceiptDialogProps) {
    const { paymentDetails, raccolte } = payment;
    const items: any[] = paymentDetails.items || [];
    const importoTotale: number | undefined = paymentDetails.importoAtteso ?? paymentDetails.analysisData?.importo;
    const causale: string = paymentDetails.causaleAttesa ?? `ACR - ${payment.paymentId}`;
    const receiptUrl = paymentDetails.receiptUrl;
    const preview = receiptUrl ? getReceiptPreview(receiptUrl) : null;

    // Group items by raccolta name
    const grouped = items.reduce((acc: Record<string, any[]>, item: any) => {
        const key = item.raccoltaNome || 'Altro';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    const hasItems = items.length > 0;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col gap-0 p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-amber-500" />
                        Approvazione Ricevuta — ACR {payment.paymentId}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 grid md:grid-cols-2 overflow-hidden">
                    {/* ── Left: Payment Details ── */}
                    <div className="border-r overflow-hidden flex flex-col">
                        <ScrollArea className="flex-1">
                            <div className="space-y-5 p-6">
                                {/* Causale */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Causale Attesa</p>
                                    <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
                                        <code className="text-sm font-bold text-primary">{causale}</code>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => copyToClipboard(causale)}>
                                            <Copy className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                <Separator />

                                {/* Payment items breakdown */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Dettaglio Voci</p>
                                    {hasItems ? (
                                        <div className="space-y-3">
                                            {(Object.entries(grouped) as [string, any[]][]).map(([raccoltaNome, groupItems]) => (
                                                <div key={raccoltaNome} className="border rounded-lg overflow-hidden">
                                                    <div className="bg-muted/50 px-3 py-2">
                                                        <p className="font-semibold text-sm">{raccoltaNome}</p>
                                                    </div>
                                                    <div className="divide-y">
                                                        {groupItems.map((item: any, i: number) => (
                                                            <div key={i} className="flex justify-between items-center px-3 py-2 text-sm">
                                                                <div>
                                                                    <span className="font-medium">{item.memberName}</span>
                                                                    <span className="text-muted-foreground ml-2 text-xs">({item.phase})</span>
                                                                </div>
                                                                <span className="font-semibold tabular-nums">€{item.amount}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {raccolte.map(r => (
                                                <div key={r.id} className="border rounded-lg px-3 py-2 text-sm">{r.nome}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                {/* Total */}
                                <div className="flex justify-between items-center rounded-lg bg-muted px-4 py-3">
                                    <span className="font-bold">Totale Atteso</span>
                                    <span className="text-2xl font-bold tabular-nums">
                                        €{typeof importoTotale === 'number' ? importoTotale.toFixed(2) : '—'}
                                    </span>
                                </div>

                                {/* Open original link */}
                                {receiptUrl && (
                                    <Button variant="outline" size="sm" asChild className="w-full">
                                        <Link href={receiptUrl} target="_blank">
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Apri Documento Originale
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* ── Right: Receipt Preview ── */}
                    <div className="flex flex-col bg-muted/20 overflow-hidden">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 pt-4 pb-2">Anteprima Ricevuta</p>
                        <div className="flex-1 relative min-h-[350px]">
                            {!receiptUrl ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                    Documento non disponibile
                                </div>
                            ) : preview?.type === 'drive' ? (
                                <iframe
                                    src={preview.previewUrl}
                                    className="absolute inset-0 w-full h-full"
                                    allow="autoplay"
                                    title="Anteprima ricevuta"
                                />
                            ) : preview?.type === 'image' ? (
                                <Image
                                    src={preview.previewUrl}
                                    alt="Ricevuta"
                                    fill
                                    className="object-contain p-4"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <Button variant="outline" asChild>
                                        <Link href={receiptUrl} target="_blank">
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Apri Documento
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Chiudi
                    </Button>
                    <Button variant="destructive" onClick={onReject}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Rifiuta e Rimuovi
                    </Button>
                    <Button onClick={onApprove} className="bg-green-600 hover:bg-green-700 text-white">
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Approva Ricevuta
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
