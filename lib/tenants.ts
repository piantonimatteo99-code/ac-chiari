export interface TenantConfig {
  id: string;
  name: string;
  subdomain: string;
  domain?: string;
  email: string;
  logoUrl?: string;
  colors: {
    primary: string;
    primaryHover: string;
    bgHeader: string;
  };
}

export const TENANTS: Record<string, TenantConfig> = {
  acchiari: {
    id: 'acchiari',
    name: 'AC Chiari',
    subdomain: 'acchiari',
    email: 'azionecattolicachiari@gmail.com',
    colors: {
      primary: '#1d4ed8', // blue-700
      primaryHover: '#1e40af', // blue-800
      bgHeader: 'bg-blue-700',
    },
  },
  acbrescia: {
    id: 'acbrescia',
    name: 'AC Brescia',
    subdomain: 'acbrescia',
    email: 'segreteria@acbrescia.gemmaflow.it', // email fittizia o reale di Brescia
    colors: {
      primary: '#047857', // emerald-700
      primaryHover: '#065f46', // emerald-800
      bgHeader: 'bg-emerald-700',
    },
  },
};

export const DEFAULT_TENANT_ID = 'acchiari';

/**
 * Riconosce il tenant dall'hostname.
 */
export function getTenantFromHostname(hostname: string | null): TenantConfig {
  if (!hostname) return TENANTS[DEFAULT_TENANT_ID];

  // Riconoscimento del sotto-dominio: es. acbrescia.gemmaflow.it o acbrescia.localhost
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    const subdomain = parts[0].toLowerCase();
    // Pulisci eventuale prefisso 'www'
    const tenantSubdomain = subdomain === 'www' ? parts[1].toLowerCase() : subdomain;
    
    const matched = Object.values(TENANTS).find(t => t.subdomain === tenantSubdomain);
    if (matched) return matched;
  }

  return TENANTS[DEFAULT_TENANT_ID];
}
