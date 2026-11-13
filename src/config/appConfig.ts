// Central application configuration
export const APP_CONFIG = {
  // Official External Catalog URL (Can be overridden via VITE_CATALOG_URL)
  catalogUrl: ((import.meta as any).env?.VITE_CATALOG_URL as string) || 'https://catalogo.chokdistribuidora.com.br',
  CATALOG_URL: ((import.meta as any).env?.VITE_CATALOG_URL as string) || 'https://catalogo.chokdistribuidora.com.br',
  companyName: 'Chok Distribuidora',
  /**
   * Nome do produto — e só dele.
   *
   * Segue o padrão de marca do Grupo Arantes: o produto tem nome próprio em
   * Montserrat 700 e o grupo assina embaixo (`brandEndorsement`). As palavras
   * do logotipo nunca são trocadas pelo nome do produto — o logo oficial
   * entra como imagem, separado deste texto.
   *
   * Está aqui, e não espalhado pelas telas, para que uma troca de nome seja
   * uma linha só: antes era "Chok Dados" repetido em cinco arquivos.
   */
  appName: 'Cockpit Chok',
  /** Endosso do grupo, exibido sob o nome do produto. */
  brandEndorsement: 'Grupo Arantes',
  /** Nome completo, para título de aba, rodapé e tela de entrada. */
  get appFullName() {
    return `${this.appName} · ${this.brandEndorsement}`;
  },
  systemVersion: '2.0',
};
