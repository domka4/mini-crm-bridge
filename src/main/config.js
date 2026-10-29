import { app } from 'electron';

// Endereço do Mini CRM. Fonte única no Bridge (no site: lib/site.js).
// Em desenvolvimento dá para apontar para o site local com MINI_CRM_URL=http://localhost:3000.
export const CRM_URL = (!app.isPackaged && process.env.MINI_CRM_URL) || 'https://donovanfeitosa.linkinn.com.br';

export function versaoApp() {
  return app.getVersion();
}

/** Compara versões "x.y.z" (sufixo -beta.N conta como anterior à versão final). Retorna -1, 0 ou 1. */
export function compararVersoes(a, b) {
  const partes = (v) => {
    const [num, pre] = String(v || '0').split('-');
    return { n: num.split('.').map((x) => parseInt(x, 10) || 0), pre: pre || null };
  };
  const A = partes(a), B = partes(b);
  for (let i = 0; i < 3; i++) {
    if ((A.n[i] || 0) !== (B.n[i] || 0)) return (A.n[i] || 0) > (B.n[i] || 0) ? 1 : -1;
  }
  if (A.pre === B.pre) return 0;
  if (!A.pre) return 1;
  if (!B.pre) return -1;
  return A.pre > B.pre ? 1 : -1;
}
