import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PermissionsPage() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
         <CardHeader>
          <CardTitle>Gestione Permessi e Ruoli</CardTitle>
          <CardDescription>
            Assegna o revoca ruoli agli utenti del sistema. Pagina in costruzione.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Qui verrà visualizzata la tabella per la gestione dei permessi.</p>
        </CardContent>
      </Card>
    </div>
  );
}
