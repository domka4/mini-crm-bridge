import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  Mail,
  Lock,
  Plus,
  Trash2,
  Smartphone,
  WifiOff,
  X,
  Wifi,
  ChevronRight,
  Settings,
  LogOut,
  RotateCcw,
  Bug,
  Copy,
} from 'lucide-react';
import LogoWordmark from './assets/logo-wordmark.svg';
import LogoFavicon from './assets/logo-favicon.svg';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── Color Tokens ──────────────────────────────────────────────
const C = {
  bg:          '#f9fafb',
  card:        '#ffffff',
  border:      '#e5e7eb',
  text:        '#111827',
  textSec:     '#4b5563',
  textMuted:   '#9ca3af',
  accent:      '#000000',
  accentHover: '#333333',
  error:       '#ef4444',
  errorBg:     'rgba(239,68,68,0.1)',
  errorBorder: 'rgba(239,68,68,0.3)',
  warning:     '#f59e0b',
  dot:         '#d1d5db',
};

// ── Reusable inline-style fragments ───────────────────────────
const inputBase = {
  width: '100%',
  height: 44,
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  color: C.text,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color .2s',
};

const inputSmall = {
  ...inputBase,
  height: 38,
  fontSize: 13,
};

const btnPrimary = {
  width: '100%',
  height: 44,
  background: C.accent,
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  transition: 'background .2s, opacity .2s',
};

const errorBox = {
  background: C.errorBg,
  border: `1px solid ${C.errorBorder}`,
  borderRadius: 8,
  color: C.error,
  padding: 10,
  fontSize: 12,
  marginBottom: 12,
};

// ── Titlebar ──────────────────────────────────────────────────
function Titlebar() {
  const [hovMin, setHovMin] = useState(false);
  const [hovClose, setHovClose] = useState(false);

  return (
    <div
      style={{
        height: 36,
        background: C.bg,
        borderBottom: `1px solid ${C.card}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src={LogoFavicon} alt="Mini CRM" style={{ width: 14, height: 14, objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='inline-block'; }} />
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: C.accent,
            display: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>
          Mini CRM Bridge
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => window.dispatchEvent(new Event('toggle-logs'))}
          style={{ background: 'transparent', border: 'none', color: C.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
          title="Ver Logs"
        >
          <Bug size={14} />
        </button>
        <span
          role="button"
          tabIndex={0}
          onClick={() => window.bridgeAPI?.minimizeToTray()}
          onMouseEnter={() => setHovMin(true)}
          onMouseLeave={() => setHovMin(false)}
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: hovMin ? C.accent : C.dot,
            cursor: 'pointer',
            transition: 'background .2s',
          }}
        />
        <span
          role="button"
          tabIndex={0}
          onClick={() => window.bridgeAPI?.closeApp()}
          onMouseEnter={() => setHovClose(true)}
          onMouseLeave={() => setHovClose(false)}
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: hovClose ? C.error : C.dot,
            cursor: 'pointer',
            transition: 'background .2s',
          }}
        />
      </div>
    </div>
  );
}

// ── Login Screen ──────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [keepLogged, setKeepLogged] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await window.bridgeAPI.login({
        email,
        password,
        supabaseUrl,
        supabaseAnonKey: supabaseKey,
      });
      if (res.success) {
        if (keepLogged) {
          await window.bridgeAPI.saveAuth({ email, password });
        } else {
          await window.bridgeAPI.clearAuth();
        }
        onLogin(res);
      } else {
        setError(res.error || 'Erro ao fazer login');
      }
    } catch (err) {
      setError(err.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 32px',
      }}
    >
      {/* Icon */}
      <div
        style={{
          marginBottom: 16,
        }}
      >
        <img src={LogoWordmark} alt="Mini CRM" style={{ width: 140, objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(0,0,0,0.05)', display: 'none', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={48} color={C.accent} strokeWidth={1.5} />
        </div>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>
        Mini CRM Bridge
      </h1>
      <p
        style={{
          fontSize: 13,
          color: C.textSec,
          margin: '6px 0 24px',
          textAlign: 'center',
        }}
      >
        Conecte seu WhatsApp usando seu IP residencial
      </p>

      {/* Email */}
      <div style={{ position: 'relative', width: '100%', marginBottom: 12 }}>
        <Mail
          size={16}
          color={C.textMuted}
          style={{ position: 'absolute', left: 14, top: 14, pointerEvents: 'none' }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setFocusedField('email')}
          onBlur={() => setFocusedField(null)}
          style={{
            ...inputBase,
            paddingLeft: 40,
            paddingRight: 14,
            borderColor: focusedField === 'email' ? C.accent : C.border,
          }}
        />
      </div>

      {/* Password */}
      <div style={{ position: 'relative', width: '100%', marginBottom: 16 }}>
        <Lock
          size={16}
          color={C.textMuted}
          style={{ position: 'absolute', left: 14, top: 14, pointerEvents: 'none' }}
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setFocusedField('password')}
          onBlur={() => setFocusedField(null)}
          style={{
            ...inputBase,
            paddingLeft: 40,
            paddingRight: 14,
            borderColor: focusedField === 'password' ? C.accent : C.border,
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, cursor: 'pointer' }} onClick={() => setKeepLogged(!keepLogged)}>
        <input 
          type="checkbox" 
          checked={keepLogged} 
          onChange={(e) => setKeepLogged(e.target.checked)} 
          style={{ marginRight: 8, cursor: 'pointer' }} 
        />
        <span style={{ fontSize: 13, color: C.textSec }}>Mantenha-me conectado</span>
      </div>

      {/* Error */}
      {error && <div style={errorBox}>{error}</div>}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !email || !password}
        style={{
          ...btnPrimary,
          opacity: loading || !email || !password ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!loading) e.currentTarget.style.background = C.accentHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = C.accent;
        }}
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}

// ── Account Selector ──────────────────────────────────────────
function AccountSelector({ accounts, onSelect, onLogout }) {
  const [loading, setLoading] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [error, setError] = useState('');

  const select = async (acc) => {
    setLoading(acc.id);
    setError('');
    try {
      const res = await window.bridgeAPI.selectAccount({ account_id: acc.id });
      if (res.success) {
        onSelect(acc, res.tunnelUrl);
      } else {
        setError(res.error || 'Erro ao selecionar conta.');
      }
    } catch(err) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setLoading(null);
    }
  };

  const getInitials = (name) =>
    (name || '?')
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');

  const avatarColors = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4'];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 24px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
            Selecionar Projeto
          </h2>
          <p style={{ fontSize: 13, color: C.textSec, margin: '6px 0 20px' }}>
            Escolha o projeto que deseja gerenciar
          </p>
        </div>
        <button
          onClick={() => {
            window.bridgeAPI.clearAuth();
            if (onLogout) onLogout();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.error,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Sair
        </button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {accounts.map((acc, i) => (
          <div
            key={acc.id}
            onClick={() => !loading && select(acc)}
            onMouseEnter={() => setHoveredId(acc.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              background: C.card,
              border: `1px solid ${hoveredId === acc.id ? C.accent : C.border}`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 8,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'border-color .2s',
              opacity: loading && loading !== acc.id ? 0.5 : 1,
            }}
          >
            {/* Avatar */}
            {acc.logo_url ? (
              <img
                src={acc.logo_url}
                alt=""
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: avatarColors[i % avatarColors.length],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {getInitials(acc.nome)}
              </div>
            )}

            <span
              style={{
                flex: 1,
                marginLeft: 12,
                fontSize: 14,
                fontWeight: 700,
                color: C.text,
              }}
            >
              {acc.nome}
            </span>

            <span style={{ fontSize: 12, color: C.accent, flexShrink: 0 }}>
              {loading === acc.id ? 'Carregando...' : 'Selecionar →'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────
function MainScreen({ account, userEmail, tunnelUrl: initialTunnel, onLogout }) {
  const [proxyStatus, setProxyStatus] = useState(initialTunnel ? 'connected' : 'off');
  const [proxyUrl, setProxyUrl] = useState(initialTunnel || '');
  const [proxyLoading, setProxyLoading] = useState(false);
  const [instances, setInstances] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState('');

  // ── Load instances ──
  const loadInstances = useCallback(async () => {
    try {
      const res = await window.bridgeAPI.listInstances();
      if (res.success) setInstances(res.instancias || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadInstances();
    // Auto-start proxy on mount
    (async () => {
      setProxyStatus('connecting');
      try {
        const res = await window.bridgeAPI.startProxy();
        if (res.success) {
          setProxyStatus('connected');
          setProxyUrl(res.url);
        } else {
          setProxyStatus('off');
        }
      } catch {
        setProxyStatus('off');
      }
    })();
  }, [loadInstances]);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Polling for notifications
  useEffect(() => {
    let lastStatuses = {};
    const interval = setInterval(async () => {
      if (!instances || instances.length === 0) return;
      for (const inst of instances) {
        try {
          const st = await window.bridgeAPI.checkInstanceStatus({ instance_name: inst.instanceName || inst.instance_name });
          if (st.success && st.data) {
            const currentStatus = st.data.instance?.state;
            const iName = inst.instanceName || inst.instance_name;
            if (lastStatuses[iName] && lastStatuses[iName] !== currentStatus) {
              if (currentStatus === 'open') {
                window.bridgeAPI.showNotification('Mini CRM Bridge', `WhatsApp (${iName}) conectado com sucesso!`);
              } else if (currentStatus === 'close') {
                window.bridgeAPI.showNotification('Mini CRM Bridge', `Atenção! WhatsApp (${iName}) desconectou.`);
              }
            }
            lastStatuses[iName] = currentStatus;
          }
        } catch(e){}
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [instances]);

  // ── Proxy toggle ──
  const toggleProxy = async () => {
    setProxyLoading(true);
    try {
      if (proxyStatus === 'connected') {
        const res = await window.bridgeAPI.stopProxy();
        if (res.success) {
          setProxyStatus('off');
          setProxyUrl('');
        }
      } else {
        setProxyStatus('connecting');
        const res = await window.bridgeAPI.startProxy();
        if (res.success) {
          setProxyStatus('connected');
          setProxyUrl(res.url || '');
        } else {
          setProxyStatus('off');
        }
      }
    } catch {
      setProxyStatus('off');
    } finally {
      setProxyLoading(false);
    }
  };

  // ── Delete instance ──
  const deleteInstance = async (id) => {
    try {
      const res = await window.bridgeAPI.deleteInstance({ instance_id: id });
      if (res.success) loadInstances();
    } catch {}
  };

    const restartInstance = async (instance_name) => {
      setToast('Reiniciando instância...');
      try {
        const res = await window.bridgeAPI.restartInstance({ instance_name });
        if (res.success) {
          setToast('Instância reiniciada!');
          loadInstances();
        } else {
          setToast(res.error || 'Erro ao reiniciar');
        }
      } catch {}
    };

    const logoutInstance = async (instance_name) => {
      if (!confirm('Tem certeza que deseja deslogar o WhatsApp?')) return;
      setToast('Deslogando WhatsApp...');
      try {
        const res = await window.bridgeAPI.logoutInstance({ instance_name });
        if (res.success) {
          setToast('WhatsApp deslogado!');
          loadInstances();
        } else {
          setToast(res.error || 'Erro ao deslogar');
        }
      } catch {}
    };

  // Proxy dot color
  const dotColor =
    proxyStatus === 'connected'
      ? C.accent
      : proxyStatus === 'connecting'
      ? C.warning
      : C.textMuted;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 4px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
          {account.nome}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={onLogout}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.error)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
          style={{ fontSize: 12, color: C.textMuted, cursor: 'pointer', transition: 'color .2s' }}
        >
          Sair
        </span>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 0' }}>
        {/* Proxy Card */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: dotColor,
                display: 'inline-block',
                flexShrink: 0,
                animation:
                  proxyStatus === 'connecting'
                    ? 'pulse-dot 1.2s ease-in-out infinite'
                    : 'none',
              }}
            />
            {proxyStatus === 'connected' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: C.accent, fontWeight: 600, flexShrink: 0 }}>
                  Proxy ativo
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: C.textMuted,
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {proxyUrl}
                </span>
              </div>
            )}
            {proxyStatus === 'connecting' && (
              <span style={{ fontSize: 13, color: C.warning, fontWeight: 600 }}>
                Conectando...
              </span>
            )}
            {proxyStatus === 'off' && (
              <span style={{ fontSize: 13, color: C.textMuted }}>Proxy desligado</span>
            )}
          </div>

          <button
            onClick={toggleProxy}
            disabled={proxyLoading}
            style={{
              fontSize: 10,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.textSec,
              borderRadius: 6,
              padding: '4px 10px',
              cursor: proxyLoading ? 'wait' : 'pointer',
              flexShrink: 0,
              opacity: proxyLoading ? 0.6 : 1,
            }}
          >
            {proxyStatus === 'connected' ? 'Desligar' : 'Ligar'}
          </button>
        </div>

        {/* Instances header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Instâncias</span>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: C.accent,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background .2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.accentHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
          >
            <Plus size={14} /> Nova
          </button>
        </div>

        {/* New Instance Form */}
        {showForm && (
          <NewInstanceForm
            onClose={() => setShowForm(false)}
            onConnected={() => {
              setShowForm(false);
              setToast('Instância conectada com sucesso!');
              loadInstances();
            }}
          />
        )}

        {/* Instance List */}
        {instances.length === 0 && !showForm ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 0',
            }}
          >
            <WifiOff size={32} color={C.border} />
            <span style={{ fontSize: 13, color: C.textMuted, marginTop: 10 }}>
              Nenhuma instância encontrada
            </span>
          </div>
        ) : (
          instances.map((inst) => (
            <InstanceCard 
              key={inst.id || inst.instance_name} 
              inst={inst} 
              onDelete={deleteInstance}
              onRestart={restartInstance}
              onLogout={logoutInstance}
            />
          ))
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 52,
            left: 16,
            right: 16,
            background: C.accent,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            padding: '10px 14px',
            borderRadius: 8,
            textAlign: 'center',
            zIndex: 100,
            animation: 'fadeIn .3s ease',
          }}
        >
          {toast}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          height: 40,
          borderTop: `1px solid ${C.card}`,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: C.textMuted }}>{userEmail}</span>
        <button
          onClick={() => window.bridgeAPI?.minimizeToTray()}
          style={{
            fontSize: 11,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: '4px 12px',
            color: C.textSec,
            cursor: 'pointer',
          }}
        >
          Ocultar
        </button>
      </div>
    </div>
  );
}

// ── Instance Card ─────────────────────────────────────────────
function InstanceCard({ inst, onDelete, onRestart, onLogout }) {
  const [hovDel, setHovDel] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const status = (inst.status || inst.estado || 'disconnected').toLowerCase();
  const isConnected = status === 'conectado' || status === 'connected' || status === 'open';
  const isConnecting = status === 'connecting' || status === 'conectando';

  const badgeStyle = isConnected
    ? {
        background: 'rgba(16,185,129,0.15)',
        color: C.accent,
        border: '1px solid rgba(16,185,129,0.3)',
      }
    : isConnecting
    ? {
        background: 'rgba(245,158,11,0.15)',
        color: C.warning,
        border: '1px solid rgba(245,158,11,0.3)',
      }
    : {
        background: C.errorBg,
        color: C.error,
        border: `1px solid ${C.errorBorder}`,
      };

  const badgeText = isConnected ? 'Conectado' : isConnecting ? 'Conectando' : 'Desconectado';

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 8,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Smartphone size={16} color={C.textMuted} />
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
            {inst.instance_name || inst.nome}
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 6,
            ...badgeStyle,
          }}
        >
          {badgeText}
        </span>
      </div>

      {(inst.phone_number || inst.telefone) && (
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, marginLeft: 24 }}>
          {inst.phone_number || inst.telefone}
        </div>
      )}
      {/* Advanced Options Menu */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 10, position: 'relative' }}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.textSec,
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Opções Avançadas"
        >
          <Settings size={16} />
        </button>
        <button
          onClick={() => onDelete(inst.id || inst.instance_name)}
          onMouseEnter={() => setHovDel(true)}
          onMouseLeave={() => setHovDel(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: hovDel ? C.error : C.textSec,
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color .2s',
          }}
          title="Apagar Instância"
        >
          <Trash2 size={16} />
        </button>

        {showMenu && (
          <div style={{
            position: 'absolute',
            top: 24,
            right: 0,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10,
            minWidth: 160
          }}>
            <button
              onClick={() => { setShowMenu(false); onRestart(inst.instance_name); }}
              style={{
                background: 'transparent', border: 'none', color: C.text, textAlign: 'left',
                padding: '6px 8px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13
              }}
            >
              <RotateCcw size={14} /> Reiniciar
            </button>
            <button
              onClick={() => { setShowMenu(false); onLogout(inst.instance_name); }}
              style={{
                background: 'transparent', border: 'none', color: C.error, textAlign: 'left',
                padding: '6px 8px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13
              }}
            >
              <LogOut size={14} /> Deslogar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── New Instance Form ─────────────────────────────────────────
function NewInstanceForm({ onClose, onConnected }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrcode, setQrcode] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const pollRef = useRef(null);
  const instanceNameRef = useRef('');

  // Cleanup polling
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleConnect = async () => {
    if (!name.trim()) return;
    setError('');
    setLoading(true);
    setQrcode('');

    try {
      const res = await window.bridgeAPI.connectInstance({
        instance_name: name.trim(),
        phone_number: phone.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || 'Erro ao conectar instância');
        setLoading(false);
        return;
      }

      instanceNameRef.current = name.trim();

      if (res.qrcode && res.qrcode.startsWith('data:image')) {
        setQrcode(res.qrcode);
      }

      setLoading(false);

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const st = await window.bridgeAPI.checkInstanceStatus({
            instance_name: instanceNameRef.current,
          });
          if (
            st.success &&
            (st.status === 'conectado' || st.status === 'connected' || st.status === 'open')
          ) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            onConnected();
          }
        } catch {}
      }, 4000);
    } catch (err) {
      setError(err.message || 'Erro inesperado');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.accent}`,
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
        position: 'relative',
      }}
    >
      {/* Close */}
      <span
        role="button"
        tabIndex={0}
        onClick={() => {
          if (pollRef.current) clearInterval(pollRef.current);
          onClose();
        }}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          cursor: 'pointer',
          lineHeight: 0,
          padding: 4,
        }}
      >
        <X size={16} color={C.textSec} />
      </span>

      <div
        style={{
          fontSize: 11,
          color: C.textSec,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Nova Conexão
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Nome da instância"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocusedField('name')}
          onBlur={() => setFocusedField(null)}
          style={{
            ...inputSmall,
            flex: 1,
            padding: '0 12px',
            borderColor: focusedField === 'name' ? C.accent : C.border,
          }}
        />
        <input
          placeholder="Telefone (opcional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onFocus={() => setFocusedField('phone')}
          onBlur={() => setFocusedField(null)}
          style={{
            ...inputSmall,
            flex: 1,
            padding: '0 12px',
            borderColor: focusedField === 'phone' ? C.accent : C.border,
          }}
        />
      </div>

      {!qrcode && (
        <button
          onClick={handleConnect}
          disabled={loading || !name.trim()}
          style={{
            ...btnPrimary,
            height: 38,
            opacity: loading || !name.trim() ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.background = C.accentHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = C.accent;
          }}
        >
          {loading ? 'Conectando...' : 'Conectar'}
        </button>
      )}

      {/* QR Code */}
      {qrcode && (
        <div style={{ textAlign: 'center' }}>
          <img
            src={qrcode}
            alt="QR Code"
            style={{
              width: 200,
              height: 200,
              borderRadius: 12,
              border: `2px solid ${C.border}`,
              background: '#fff',
              margin: '16px auto',
              display: 'block',
            }}
          />
          <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>
            Escaneie o QR Code no seu WhatsApp
          </p>
        </div>
      )}
    </div>
  );
}

// ── Global CSS Keyframes (injected once) ──────────────────────
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  *::-webkit-scrollbar { width: 4px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  input::placeholder { color: #9ca3af !important; }
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; overflow: hidden; }
`;
if (!document.getElementById('bridge-styles')) {
  styleTag.id = 'bridge-styles';
  document.head.appendChild(styleTag);
}

// ── Log Console Component ───────────────────────────────────────
function LogConsole({ open, onClose }) {
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const fetchInitial = async () => {
      const initialLogs = await window.bridgeAPI.getLogs();
      setLogs(initialLogs || []);
    };
    fetchInitial();

    const unsubs = window.bridgeAPI.onLog((newLog) => {
      setLogs(prev => {
        const next = [...prev, newLog];
        if (next.length > 200) next.shift();
        return next;
      });
    });

    return () => {
      // no unsubscribe function exposed right now, but it's fine for this app lifetime
    };
  }, [open]);

  useEffect(() => {
    if (open && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, open]);

  const copyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message} ${l.meta ? JSON.stringify(l.meta) : ''}`).join('\\n');
    navigator.clipboard.writeText(text);
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'absolute', top: 36, bottom: 0, left: 0, right: 0,
      background: '#1e1e1e', color: '#d4d4d4', zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Consolas, monospace', fontSize: 12
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#252526', borderBottom: '1px solid #000' }}>
        <span style={{ fontWeight: 600 }}>Terminal de Logs</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={copyLogs} style={{ background: 'transparent', border: 'none', color: '#d4d4d4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Copy size={12} /> Copiar
          </button>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <X size={14} /> Fechar
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {logs.map(log => (
          <div key={log.id} style={{ marginBottom: 4, display: 'flex', gap: 8 }}>
            <span style={{ color: '#569cd6', flexShrink: 0 }}>[{log.timestamp.split('T')[1].substring(0, 8)}]</span>
            <span style={{
              color: log.level === 'error' ? '#f48771' : log.level === 'warn' ? '#cca700' : '#4ec9b0',
              fontWeight: 600, width: 45, flexShrink: 0
            }}>
              [{log.level.toUpperCase()}]
            </span>
            <span style={{ wordBreak: 'break-all' }}>
              {log.message}
              {log.meta && <span style={{ color: '#ce9178', marginLeft: 8 }}>{JSON.stringify(log.meta)}</span>}
            </span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('login'); // login | accounts | main
  const [userEmail, setUserEmail] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [logsOpen, setLogsOpen] = useState(false);

  useEffect(() => {
    const toggleLogs = () => setLogsOpen(prev => !prev);
    window.addEventListener('toggle-logs', toggleLogs);
    return () => window.removeEventListener('toggle-logs', toggleLogs);
  }, []);

  useEffect(() => {
    (async () => {
      const auth = await window.bridgeAPI.loadAuth();
      if (auth && auth.email && auth.password) {
        try {
          const res = await window.bridgeAPI.login({
            email: auth.email,
            password: auth.password,
            supabaseUrl,
            supabaseAnonKey: supabaseKey,
          });
          if (res.success) {
            handleLogin(res);
          }
        } catch(e) {}
      }
      setLoadingAuth(false);
    })();
  }, []);

  const handleLogin = (res) => {
    setUserEmail(res.email);
    const accs = res.accounts || [];

    if (accs.length === 1) {
      // Auto-select single account
      handleAccountSelect(accs[0]);
    } else if (accs.length > 1) {
      setAccounts(accs);
      setScreen('accounts');
    }
  };

  const handleAccountSelect = async (acc, tunnel) => {
    if (tunnel) {
      // Called from AccountSelector which already called selectAccount
      setSelectedAccount(acc);
      setTunnelUrl(tunnel);
      setScreen('main');
    } else {
      // Called from auto-select (single account)
      try {
        const res = await window.bridgeAPI.selectAccount({ account_id: acc.id });
        if (res.success) {
          setSelectedAccount(acc);
          setTunnelUrl(res.tunnelUrl || '');
          setScreen('main');
        }
      } catch {}
    }
  };

  const handleLogout = () => {
    setScreen('login');
    setUserEmail('');
    setAccounts([]);
    setSelectedAccount(null);
    setTunnelUrl('');
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        background: C.bg,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: C.text,
      }}
    >
      <Titlebar />

      {loadingAuth ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: C.textSec, fontSize: 14 }}>Carregando...</span>
        </div>
      ) : (
        <>
          {screen === 'login' && <LoginScreen onLogin={handleLogin} />}
          {screen === 'accounts' && (
            <AccountSelector accounts={accounts} onSelect={handleAccountSelect} onLogout={handleLogout} />
          )}
          {screen === 'main' && selectedAccount && (
            <MainScreen
              account={selectedAccount}
              userEmail={userEmail}
              tunnelUrl={tunnelUrl}
              onLogout={handleLogout}
            />
          )}
        </>
      )}
      <LogConsole open={logsOpen} onClose={() => setLogsOpen(false)} />
    </div>
  );
}
