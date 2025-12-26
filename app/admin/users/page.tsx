import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function UsersPage() {
  return (
     <div className="flex flex-col gap-4">
      <Card>
         <CardHeader>
          <CardTitle>Anagrafe Utenti e Familiari</CardTitle>
          <CardDescription>
            Questa tabella mostra sia gli utenti registrati al sistema sia i membri dei nuclei familiari. Pagina in costruzione.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Qui verrà visualizzata la tabella con l'anagrafe completa.</p>
        </CardContent>
      </Card>
    </div>
  );
}
