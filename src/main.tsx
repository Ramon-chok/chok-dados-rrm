import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';

// Fontes da marca, embutidas no pacote (padrão do Grupo Arantes).
//
// Nunca por link do Google Fonts: assim a aplicação continua com a tipografia
// certa sem depender de internet externa, e nenhum dado de navegação do
// usuário sai para um terceiro só para carregar uma fonte.
//
// Montserrat  → títulos e destaques, no lugar da Gotham (paga).
// JetBrains Mono → só carimbo de máquina: NF, chave, placa, hora, código.
// O corpo do texto usa a pilha Segoe UI, nativa no Windows/Android/Mac, que
// não pode ser embutida por licença.
import '@fontsource-variable/montserrat';
import '@fontsource-variable/jetbrains-mono';

import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
