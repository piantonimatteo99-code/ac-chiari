import { redirect } from 'next/navigation';

// Redirect old URL → new canonical URL
export default function ConfigurazionePage() {
  redirect('/admin/configurazione/integrazione-drive');
}
