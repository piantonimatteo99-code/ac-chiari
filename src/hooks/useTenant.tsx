'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { TenantConfig, TENANTS, DEFAULT_TENANT_ID, getTenantFromHostname } from '@/lib/tenants';

interface TenantContextState {
  tenantId: string;
  tenantConfig: TenantConfig;
}

const TenantContext = createContext<TenantContextState | undefined>(undefined);

export const TenantProvider: React.FC<{
  children: ReactNode;
  tenantId: string;
}> = ({ children, tenantId }) => {
  const currentTenantId = useMemo(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const clientTenant = getTenantFromHostname(hostname);
      return clientTenant.id;
    }
    return tenantId || DEFAULT_TENANT_ID;
  }, [tenantId]);

  const config = useMemo(() => {
    return TENANTS[currentTenantId] || TENANTS[DEFAULT_TENANT_ID];
  }, [currentTenantId]);

  const value = useMemo(() => ({
    tenantId: currentTenantId,
    tenantConfig: config,
  }), [currentTenantId, config]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
