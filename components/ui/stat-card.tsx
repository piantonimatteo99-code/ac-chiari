import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    value: string;
    description: string;
    currency?: string;
    variant?: 'default' | 'positive' | 'negative';
}

export function StatCard({ title, value, description, currency, variant = 'default' }: StatCardProps) {
    const valueColor = {
        default: 'text-foreground',
        positive: 'text-green-600',
        negative: 'text-destructive',
    }[variant];
    
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className={cn("text-2xl font-bold", valueColor)}>
                    {currency && <span className="mr-1">{currency}</span>}
                    {value}
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
        </Card>
    );
}
