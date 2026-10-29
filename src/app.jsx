import React, { useEffect, useState } from 'react';
import { CircleCheck, Download, ExternalLink, Info, LoaderCircle, Plus, Send, Smartphone, TriangleAlert, Unplug } from 'lucide-react';
import logoBruto from './assets/logo-wordmark.svg?raw';

// Tela do Mini CRM Bridge 2.0. Tudo passa por window.bridge (preload.js).

const api = window.bridge;
const LOGO = logoBruto.replace(/fill="black"/g, 'fill="currentColor"');

async function chamar(fn, ...args) {
  const r = await fn(...args);
  if (!r.ok) throw new Error(r.erro || 'Algo deu errado. Tente de novo.');
  return r.dados;
}

function amigavel(e) {
  const m = String(e?.message || e || '');
  if (/fetch failed|ENOTFOUND|ECONN|timeout|aborted/i.test(m)) return 'Sem contato com o Mini CRM. Confira a internet deste PC e tente de novo.';
  return m || 'Algo deu errado. Tente de novo.';
}

function formatarNumero(n) {
  const d = String(n || '').replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const resto = d.slice(4);
    return `+55 ${d.slice(2, 4)} ${resto.slice(0, -4)}-${resto.slice(-4)}`;
  }
  return d ? `+${d}` : '';
}

const Girando = ({ size = 15 }) => <LoaderCircle size={size} className="girando" aria-hidden="true" />;
const Marca = () => <span className="marca" role="img" aria-label="Mini CRM" dangerouslySetInnerHTML={{ __html: LOGO }} />;

export default function App() {
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    chamar(api.estado).then(setEstado).catch(() => {});
    return api.aoMudarEstado(setEstado);
  }, []);

  if (!estado) {
    return <div className="app"><main className="conteudo" style={{ display: 'grid', placeItems: 'center' }}><Girando size={22} /></main></div>;
  }
  return estado.pareado ? <Principal estado={estado} /> : <Pareamento estado={estado} />;
}

/* ---------- pareamento ---------- */

function Pareamento({ estado }) {
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState(estado.nomePc || '');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const limpo = codigo.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const exibido = limpo.length > 4 ? `${limpo.slice(0, 4)}-${limpo.slice(4)}` : limpo;

  async function enviar(e) {
    e.preventDefault();
    if (limpo.length !== 8) { setErro('O código tem 8 letras e números.'); return; }
    setEnviando(true);
    setErro('');
    try {
      await chamar(api.parear, limpo, nome.trim());
    } catch (err) {
      setErro(amigavel(err));
      setEnviando(false);
    }
  }

  return (
    <div className="app">
      <header className="topo"><Marca /></header>
      <main className="conteudo">
        <form className="parear" onSubmit={enviar}>
          {estado.aviso && <div className="aviso err" role="alert"><TriangleAlert size={16} />{estado.aviso}</div>}
          <h1>Conecte este PC ao Mini CRM</h1>
          <p>O WhatsApp dos seus números vai rodar aqui, na mesma internet do celular.</p>
          <ol className="passos">
            <li><span>No Mini CRM, abra <strong>Números de WhatsApp</strong> e clique em <strong>Conectar este PC</strong>.</span></li>
            <li><span>Digite abaixo o código que aparecer. Ele vale por 10 minutos.</span></li>
          </ol>
          <label className="campo">
            <span>Código de pareamento</span>
            <input
              className="codigo"
              value={exibido}
              onChange={(e) => { setCodigo(e.target.value); setErro(''); }}
              placeholder="XXXX-XXXX"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              aria-invalid={!!erro}
            />
          </label>
          <label className="campo">
            <span>Nome deste PC (aparece no Mini CRM)</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder="PC da recepção" />
          </label>
          {erro && <p className="erro-campo" role="alert">{erro}</p>}
          <button className="btn pri largo" type="submit" disabled={enviando || limpo.length !== 8}>
            {enviando && <Girando />}{enviando ? 'Pareando…' : 'Parear este PC'}
          </button>
        </form>
      </main>
    </div>
  );
}

/* ---------- tela principal ---------- */

const ABAS = [
  { id: 'numeros', rotulo: 'Números' },
  { id: 'atividade', rotulo: 'Atividade' },
  { id: 'ajustes', rotulo: 'Ajustes' },
];

function Principal({ estado }) {
  const [aba, setAba] = useState('numeros');
  const sinal = estado.crmOnline === null ? ['', 'Ligando ao Mini CRM…'] : estado.crmOnline ? ['on', 'Mini CRM conectado'] : ['off', 'Sem contato com o Mini CRM'];

  return (
    <div className="app">
      <header className="topo">
        <Marca />
        <div className="topo-conta">
          <strong title={estado.conta?.nome}>{estado.conta?.nome || 'Conta'}</strong>
          <span className={`sinal ${sinal[0]}`} aria-live="polite">{sinal[1]}</span>
        </div>
      </header>
      <nav className="abas" role="tablist" aria-label="Seções">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" id={`aba-${a.id}`} aria-selected={aba === a.id} aria-controls="painel" onClick={() => setAba(a.id)}>
            {a.rotulo}
          </button>
        ))}
      </nav>
      <main className="conteudo" id="painel" role="tabpanel" aria-labelledby={`aba-${aba}`}>
        {aba === 'numeros' && <Numeros estado={estado} />}
        {aba === 'atividade' && <Atividade />}
        {aba === 'ajustes' && <Ajustes estado={estado} />}
      </main>
    </div>
  );
}

function Avisos({ estado }) {
  const at = estado.atualizacao || {};
  return (
    <>
      {estado.bloqueadoPorVersao && (
        <div className="aviso warn" role="status">
          <TriangleAlert size={16} />
          <span>Esta versão ({estado.versao}) ficou abaixo da mínima ({estado.versaoMinima}). Os envios estão pausados até a atualização terminar.</span>
        </div>
      )}
      {at.status === 'baixando' && (
        <div className="aviso" role="status"><Download size={16} /><span>Baixando a versão {at.versao}. Ela instala sozinha quando não houver envio na fila.</span></div>
      )}
      {at.status === 'pronta' && (
        <div className="aviso ok" role="status"><CircleCheck size={16} /><span>Versão {at.versao} pronta. O Bridge reinicia sozinho assim que a fila de envios zerar.</span></div>
      )}
    </>
  );
}

function Numeros({ estado }) {
  const [adicionando, setAdicionando] = useState(false);
  const numeros = estado.numeros || [];

  return (
    <>
      <Avisos estado={estado} />
      <div className="secao-cab">
        <h2>Números neste PC</h2>
        {numeros.length > 0 && !adicionando && (
          <button className="btn" onClick={() => setAdicionando(true)}><Plus size={15} />Adicionar</button>
        )}
      </div>

      {numeros.length === 0 && !adicionando ? (
        <div className="vazio">
          <Smartphone size={28} aria-hidden="true" />
          <p>Nenhum número conectado a este PC ainda.</p>
          <button className="btn pri" onClick={() => setAdicionando(true)}><Plus size={15} />Adicionar número</button>
        </div>
      ) : (
        <div className="lista" aria-live="polite">
          {numeros.map((n) => <Numero key={n.id} n={n} />)}
        </div>
      )}

      {adicionando && <NovoNumero aoFechar={() => setAdicionando(false)} />}

      {estado.enviosNaFila > 0 && (
        <p className="rodape-fila"><Send size={14} aria-hidden="true" />{estado.enviosNaFila} envio(s) na fila deste PC, saindo no ritmo seguro.</p>
      )}
    </>
  );
}

const ROTULO_ESTADO = { conectado: 'Conectado', aguardando_qr: 'Aguardando o QR', conectando: 'Conectando…', desconectado: 'Desconectado' };

function Numero({ n }) {
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState('');

  async function acao(fn) {
    setOcupado(true);
    setErro('');
    try { await chamar(fn, n.id); } catch (e) { setErro(amigavel(e)); }
    setOcupado(false);
    setConfirmar(false);
  }

  return (
    <article className="numero" aria-label={n.rotulo}>
      <div className="numero-cab">
        <div className="numero-nome">
          <strong>{n.rotulo}</strong>
          <span>{n.numero ? formatarNumero(n.numero) : 'Número aparece depois de conectar'}</span>
        </div>
        <span className={`estado ${n.estado}`}>{ROTULO_ESTADO[n.estado] || n.estado}</span>
      </div>

      {n.estado === 'aguardando_qr' && n.qr && (
        <div className="qr">
          <img src={n.qr} alt="QR para conectar o WhatsApp deste número" />
          <ol>
            <li>Abra o <strong>WhatsApp</strong> no celular deste número.</li>
            <li>Toque em <strong>Aparelhos conectados</strong> e depois em <strong>Conectar aparelho</strong>.</li>
            <li>Aponte a câmera para este QR.</li>
          </ol>
        </div>
      )}

      {erro && <p className="erro-campo" role="alert" style={{ margin: '10px 0 0' }}>{erro}</p>}

      <div className="numero-acoes">
        {n.estado === 'desconectado' && (
          <button className="btn pri" disabled={ocupado} onClick={() => acao(api.conectarNumero)}>
            {ocupado ? <Girando /> : <Smartphone size={15} />}Conectar
          </button>
        )}
        {n.estado !== 'desconectado' && !confirmar && (
          <button className="btn perigo" onClick={() => setConfirmar(true)}>
            <Unplug size={15} />{n.estado === 'conectado' ? 'Desconectar' : 'Cancelar conexão'}
          </button>
        )}
        {confirmar && (
          <>
            <button className="btn perigo confirmar" disabled={ocupado} onClick={() => acao(api.desconectarNumero)}>
              {ocupado && <Girando />}Sim, desconectar
            </button>
            <button className="btn" disabled={ocupado} onClick={() => setConfirmar(false)}>Voltar</button>
          </>
        )}
      </div>
      {confirmar && n.estado === 'conectado' && (
        <p className="erro-campo" style={{ color: 'var(--t2)', margin: '8px 0 0' }}>
          O número sai dos aparelhos conectados do celular. Para voltar, será preciso ler o QR de novo.
        </p>
      )}
    </article>
  );
}

function NovoNumero({ aoFechar }) {
  const [rotulo, setRotulo] = useState('');
  const [visibilidade, setVisibilidade] = useState('todos'); // quem vê as conversas no Mini CRM
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function criar(e) {
    e.preventDefault();
    if (!rotulo.trim()) { setErro('Dê um nome para reconhecer o número, como "Comercial".'); return; }
    setEnviando(true);
    setErro('');
    try {
      await chamar(api.adicionarNumero, rotulo.trim(), visibilidade);
      aoFechar();
    } catch (err) {
      setErro(amigavel(err));
      setEnviando(false);
    }
  }

  return (
    <form className="novo" onSubmit={criar}>
      <label htmlFor="rotulo-novo" className="secao-cab" style={{ marginBottom: 8 }}><h2>Novo número</h2></label>
      <div className="linha">
        <input id="rotulo-novo" value={rotulo} onChange={(e) => { setRotulo(e.target.value); setErro(''); }} placeholder="Nome, ex.: Comercial" maxLength={40} autoFocus />
        <button className="btn pri" type="submit" disabled={enviando}>{enviando && <Girando />}Gerar QR</button>
        <button className="btn" type="button" onClick={aoFechar} disabled={enviando}>Cancelar</button>
      </div>
      <fieldset className="quem-ve">
        <legend>Quem vê as conversas no Mini CRM</legend>
        <label><input type="radio" name="quem-ve" value="todos" checked={visibilidade === 'todos'} onChange={() => setVisibilidade('todos')} />Todo o projeto</label>
        <label><input type="radio" name="quem-ve" value="dono" checked={visibilidade === 'dono'} onChange={() => setVisibilidade('dono')} />Só eu, para um WhatsApp pessoal</label>
      </fieldset>
      {erro ? <p className="erro-campo" role="alert" style={{ margin: '8px 0 0' }}>{erro}</p> : <p>O QR aparece aqui em seguida. Use o celular do número que vai atender pelo CRM. Dá para mudar quem vê as conversas depois, na tela Números do Mini CRM.</p>}
    </form>
  );
}

/* ---------- atividade ---------- */

function Atividade() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    chamar(api.logs).then((l) => setLogs([...l].reverse())).catch(() => {});
    return api.aoNovoLog((l) => setLogs((atual) => [l, ...atual].slice(0, 200)));
  }, []);

  if (!logs.length) return <div className="vazio"><Info size={24} aria-hidden="true" /><p>Nada por aqui ainda.</p></div>;
  return (
    <div className="log">
      {logs.map((l) => (
        <div key={l.id} className={`log-item ${l.level}`}>
          <time dateTime={l.timestamp}>{new Date(l.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
          <span>{l.message}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- ajustes ---------- */

const ROTULO_ATUALIZACAO = {
  dev: 'modo de desenvolvimento',
  procurando: 'procurando atualização…',
  atual: 'atualizado',
  erro: 'não consegui procurar atualização',
};

function Ajustes({ estado }) {
  const [confirmar, setConfirmar] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const prefs = estado.preferencias || {};
  const at = estado.atualizacao || {};
  const statusAt = at.status === 'baixando' ? `baixando ${at.versao}` : at.status === 'pronta' ? `${at.versao} pronta para instalar` : ROTULO_ATUALIZACAO[at.status] || '';

  const mudar = (campo) => (e) => chamar(api.preferencias, { [campo]: e.target.checked }).catch(() => {});

  async function desparear() {
    setSaindo(true);
    try { await chamar(api.desparear); } catch (_) { setSaindo(false); setConfirmar(false); }
  }

  return (
    <>
      <div className="grupo">
        <label className="opcao">
          <div><strong>Abrir junto com o Windows</strong><small>Sem o Bridge aberto, o CRM não envia nem recebe mensagens destes números.</small></div>
          <input type="checkbox" className="chave" checked={!!prefs.iniciarComWindows} onChange={mudar('iniciarComWindows')} />
        </label>
        <label className="opcao">
          <div><strong>Receber versões de teste</strong><small>As novidades chegam antes, mas podem ter falhas.</small></div>
          <input type="checkbox" className="chave" checked={!!prefs.beta} onChange={mudar('beta')} />
        </label>
      </div>

      <div className="grupo">
        <div className="opcao">
          <div><strong>{estado.dispositivo?.nome || estado.nomePc}</strong><small>Pareado com {estado.conta?.nome || 'a conta'}</small></div>
          <button className="btn" onClick={() => api.abrirCrm()}><ExternalLink size={15} />Mini CRM</button>
        </div>
        <div className="opcao">
          <div>
            <strong>Desparear este PC</strong>
            <small>{confirmar ? 'Os números deste PC saem dos aparelhos conectados e o CRM para de usá-los.' : 'Desconecta os números e apaga as sessões guardadas aqui.'}</small>
          </div>
          {confirmar ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn perigo confirmar" onClick={desparear} disabled={saindo}>{saindo && <Girando />}Desparear</button>
              <button className="btn" onClick={() => setConfirmar(false)} disabled={saindo}>Voltar</button>
            </div>
          ) : (
            <button className="btn perigo" onClick={() => setConfirmar(true)}>Desparear</button>
          )}
        </div>
      </div>

      <p className="versao">
        Mini CRM Bridge {estado.versao}{statusAt && ` · ${statusAt}`}
        {at.status !== 'dev' && <> · <button className="btn link" onClick={() => api.procurarAtualizacao()}>procurar agora</button></>}
      </p>
    </>
  );
}
