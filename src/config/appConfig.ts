// Central application configuration
export const APP_CONFIG = {
  // Official External Catalog URL (Can be overridden via VITE_CATALOG_URL)
  catalogUrl: ((import.meta as any).env?.VITE_CATALOG_URL as string) || 'https://catalogo.chokdistribuidora.com.br',
  CATALOG_URL: ((import.meta as any).env?.VITE_CATALOG_URL as string) || 'https://catalogo.chokdistribuidora.com.br',
  companyName: 'Chok Distribuidora',
  systemVersion: '2.4.0',
};

