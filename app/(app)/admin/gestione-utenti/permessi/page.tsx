'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Dati mock per ruoli e permessi
const roles = ["admin", "educatore", "genitore", "utente"];
const permissions = [
  "read:users", "write:users", "delete:users",
  "read:groups", "write:groups", "delete:groups",
  "read:accounting", "write:accounting",
  "manage:roles"
];

const initialPermissions: Record<string, string[]> = {
  admin: ["read:users", "write:users", "delete:users", "read:groups", "write:groups", "delete:groups", "read:accounting", "write:accounting", "manage:roles"],
  educatore: ["read:users", "read:groups", "write:groups"],
  genitore: ["read:users"],
  utente: [],
};

export default function PermissionsPage() {

  // Qui andrebbe la logica per leggere e scrivere i permessi da Firestore
  // Per ora usiamo uno stato locale.
  // const [rolePermissions, setRolePermissions] = useState(initialPermissions);

  const handleSave = () => {
    // Logica per salvare i permessi in Firestore
    console.log("Salvataggio dei permessi...");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestione Permessi</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Permessi per Ruolo</CardTitle>
          <CardDescription>
            Assegna i permessi specifici per ogni ruolo definito nel sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {roles.map((role) => (
            <div key={role} className="border-t pt-4">
              <h3 className="text-lg font-semibold capitalize mb-3">{role}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {permissions.map((permission) => (
                  <div key={permission} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${role}-${permission}`}
                      // checked={rolePermissions[role]?.includes(permission)}
                      defaultChecked={initialPermissions[role]?.includes(permission)}
                    />
                    <Label htmlFor={`${role}-${permission}`} className="text-sm font-normal">
                      {permission}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
         <CardFooter className="border-t px-6 py-4 flex justify-end">
            <Button onClick={handleSave}>Salva Permessi</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
