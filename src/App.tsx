import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { Home, Map, FastForward, Trophy, Settings, ChevronRight, TrendingUp, Target, Award, Zap, Save, AlertCircle, DollarSign, PiggyBank, ShieldAlert, Lock, Unlock, Flag, Power, ShieldCheck, PhoneCall, Activity, Wrench, Ban, CheckCircle, Users, UserPlus, Edit2, Trash2, X, Check, CalendarDays, Star, BookOpen, RefreshCw } from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// --- FIREBASE CONFIGURATION (TUS LLAVES CORRECTAS) ---
const firebaseConfig = {
  apiKey: "AIzaSyDnRCHJ-ilQgyqSG5JOuzXaiwkz61xUjUk",
  authDomain: "rally-comercial-fc4ab.firebaseapp.com",
  projectId: "rally-comercial-fc4ab",
  storageBucket: "rally-comercial-fc4ab.firebasestorage.app",
  messagingSenderId: "657588773433",
  appId: "1:657588773433:web:40432aa188fcf0f484e3e8",
  measurementId: "G-2DF0LJHBM2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const COLL_PATH = 'rally_users';

// --- CONFIGURACIÓN DE LA APP ---
const MANAGER_PIN = '2026';
const MAX_USERS = 15;

const METAS = { 
  contencion: 85, 
  colocacion_nuevas: 7, 
  colocacion_total: 23, 
  pagahorros: 12,
  cuentas_ahorro: 3 
};

const SPLASH_TIPS = [
  "Todos inician en Pits al amanecer...",
  "Verificando requisitos de arranque...",
  "Sincronizando telemetría en tiempo real...",
  "Alineando parrilla de salida comercial..."
];

// --- ESCUDO SANITIZADOR DE DATOS ---
const sanitizeUser = (u: any) => ({
  id: u?.id || String(Math.random()),
  name: u?.name || 'Piloto Desconocido',
  status: u?.status || 'pits',
  isUpdated: !!u?.isUpdated,
  score: Number(u?.score) || 0,
  kpis: {
    contencion: Number(u?.kpis?.contencion) || 0,
    colocacion: {
      nuevas: Number(u?.kpis?.colocacion?.nuevas) || 0,
      renovaciones: Number(u?.kpis?.colocacion?.renovaciones) || 0,
    },
    rodamientos: {
      base: Number(u?.kpis?.rodamientos?.base) || 0,
      recuperado: Number(u?.kpis?.rodamientos?.recuperado) || 0,
    },
    pagahorros: Number(u?.kpis?.pagahorros) || 0,
    cuentas_ahorro: Number(u?.kpis?.cuentas_ahorro) || 0,
  },
  preventiva: {
    asignada: Number(u?.preventiva?.asignada) || 0,
    gestionada: Number(u?.preventiva?.gestionada) || 0,
    realizada: !!u?.preventiva?.realizada,
    agenda: !!u?.preventiva?.agenda,
  }
});

const RAW_INITIAL_USERS = [
  { id: '1', name: 'Ingrid' }, { id: '2', name: 'Lucia' }, { id: '3', name: 'Angela' },
  { id: '4', name: 'Richard' }, { id: '5', name: 'Fredy' }, { id: '6', name: 'María R.' },
  { id: '7', name: 'Néstor' }, { id: '8', name: 'Yhon' }, { id: '9', name: 'Eibar' },
  { id: '10', name: 'Luis' }, { id: '11', name: 'Liliana' }, { id: '12', name: 'Carlos' },
  { id: '13', name: 'Nohemi' }, { id: '14', name: 'Carolina' }, { id: '15', name: 'Juan' },
];

const INITIAL_USERS = RAW_INITIAL_USERS.map(sanitizeUser);

// --- UTILS & GAMIFICATION LOGIC ---
const formatNumber = (num: number) => new Intl.NumberFormat('es-CO').format(Number(num) || 0);
const formatMillions = (num: number) => `$${((Number(num) || 0) / 1000000).toFixed(0)}M`;

const calculateScore = (kpis: any, status: string) => {
  if (!kpis) return 0;
  let score = 0;
  
  const contencionRatio = METAS.contencion > 0 ? Math.min(kpis.contencion / METAS.contencion, 1) : 0;
  score += contencionRatio * 300;

  const totalColocadas = kpis.colocacion.nuevas + kpis.colocacion.renovaciones;
  const colocacionRatio = METAS.colocacion_total > 0 ? Math.min(totalColocadas / METAS.colocacion_total, 1) : 0;
  const nuevasRatio = METAS.colocacion_nuevas > 0 ? Math.min(kpis.colocacion.nuevas / METAS.colocacion_nuevas, 1) : 0;
  score += (colocacionRatio * 150) + (nuevasRatio * 150);

  const pagaRatio = METAS.pagahorros > 0 ? Math.min(kpis.pagahorros / METAS.pagahorros, 1) : 0;
  score += pagaRatio * 150;
  
  const cuentasRatio = METAS.cuentas_ahorro > 0 ? Math.min(kpis.cuentas_ahorro / METAS.cuentas_ahorro, 1) : 0;
  score += cuentasRatio * 150;

  const rodamientosRatio = kpis.rodamientos.base > 0 ? Math.min(kpis.rodamientos.recuperado / kpis.rodamientos.base, 1) : 0;
  score += rodamientosRatio * 150;

  let finalScore = Math.round(score * 100);
  
  if (status === 'penalty') {
    finalScore -= 15000;
  }
  
  return Math.max(0, finalScore);
};

const getLeague = (score: number) => {
  const safeScore = Number(score) || 0;
  if (safeScore >= 80000) return { name: 'Diamante', color: 'from-fuchsia-500 to-purple-600', text: 'text-purple-600', border: 'border-purple-300' };
  if (safeScore >= 60000) return { name: 'Oro', color: 'from-yellow-400 to-amber-500', text: 'text-amber-700', border: 'border-yellow-400' };
  if (safeScore >= 40000) return { name: 'Plata', color: 'from-slate-300 to-slate-400', text: 'text-slate-600', border: 'border-slate-300' };
  return { name: 'Bronce', color: 'from-orange-700 to-amber-900', text: 'text-orange-800', border: 'border-orange-200' };
};

const getBadges = (user: any, allUsers: any[]) => {
  let badges = [];
  if (!user || user.status !== 'active') return badges;
  const activeUsers = allUsers.filter(u => u.status === 'active');
  if (activeUsers.length === 0) return badges;

  const maxContencion = Math.max(0, ...activeUsers.map(u => u.kpis.contencion));
  const maxNuevas = Math.max(0, ...activeUsers.map(u => u.kpis.colocacion.nuevas));
  const maxRecuperacionRatio = Math.max(0, ...activeUsers.map(u => u.kpis.rodamientos.base > 0 ? (u.kpis.rodamientos.recuperado / u.kpis.rodamientos.base) : 0));
  const maxPaga = Math.max(0, ...activeUsers.map(u => u.kpis.pagahorros));
  
  const userRecuperacionRatio = user.kpis.rodamientos.base > 0 ? (user.kpis.rodamientos.recuperado / user.kpis.rodamientos.base) : 0;

  if (user.kpis.contencion === maxContencion && maxContencion > 0) badges.push({ id: 'cont', name: 'Guardián', Icon: ShieldCheck, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50 border-indigo-200 text-indigo-700', desc: 'Mejor Contención' });
  if (user.kpis.colocacion.nuevas === maxNuevas && maxNuevas > 0) badges.push({ id: 'col', name: 'Top Closer', Icon: Target, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50 border-emerald-200 text-emerald-700', desc: 'Líder en Nuevas' });
  if (userRecuperacionRatio === maxRecuperacionRatio && maxRecuperacionRatio > 0) badges.push({ id: 'rod', name: 'Titán', Icon: TrendingUp, colorClass: 'text-orange-600', bgClass: 'bg-orange-50 border-orange-200 text-orange-700', desc: 'Líder en Rodamientos' });
  if (user.kpis.pagahorros === maxPaga && maxPaga > 0) badges.push({ id: 'pag', name: 'As Ahorro', Icon: PiggyBank, colorClass: 'text-purple-600', bgClass: 'bg-purple-50 border-purple-200 text-purple-700', desc: 'Líder en Pagahorros' });
  
  if (user.preventiva?.realizada && user.preventiva?.agenda) badges.push({ id: 'prev', name: 'Impecable', Icon: Activity, colorClass: 'text-rose-600', bgClass: 'bg-rose-50 border-rose-200 text-rose-700', desc: 'Requisitos Cumplidos' });

  return badges;
};

const getUsersWithScores = (users: any[]) => users.map(u => {
  const safeUser = sanitizeUser(u);
  return { ...safeUser, score: calculateScore(safeUser.kpis, safeUser.status) };
});

const getVehicleData = (id: string | number) => {
  const vehicles = [
    { emoji: '🏎️', bg: 'from-red-500 to-red-600', shadow: 'rgba(239, 68, 68, 0.5)' },
    { emoji: '🚀', bg: 'from-orange-400 to-orange-500', shadow: 'rgba(249, 115, 22, 0.5)' },
    { emoji: '🛸', bg: 'from-purple-500 to-purple-600', shadow: 'rgba(168, 85, 247, 0.5)' },
    { emoji: '🏍️', bg: 'from-blue-500 to-blue-600', shadow: 'rgba(59, 130, 246, 0.5)' },
    { emoji: '🚙', bg: 'from-cyan-400 to-cyan-500', shadow: 'rgba(6, 182, 212, 0.5)' },
    { emoji: '🚁', bg: 'from-teal-400 to-teal-500', shadow: 'rgba(20, 184, 166, 0.5)' },
    { emoji: '🚤', bg: 'from-emerald-400 to-emerald-500', shadow: 'rgba(16, 185, 129, 0.5)' },
    { emoji: '🚜', bg: 'from-green-500 to-green-600', shadow: 'rgba(34, 197, 94, 0.5)' },
    { emoji: '🛩️', bg: 'from-sky-400 to-sky-500', shadow: 'rgba(14, 165, 233, 0.5)' },
    { emoji: '🚂', bg: 'from-slate-600 to-slate-800', shadow: 'rgba(71, 85, 105, 0.5)' },
    { emoji: '🚒', bg: 'from-rose-500 to-rose-600', shadow: 'rgba(244, 63, 94, 0.5)' },
    { emoji: '🚑', bg: 'from-indigo-400 to-indigo-500', shadow: 'rgba(99, 102, 241, 0.5)' },
    { emoji: '🚕', bg: 'from-yellow-400 to-yellow-500', shadow: 'rgba(234, 179, 8, 0.5)' },
    { emoji: '🚓', bg: 'from-blue-700 to-blue-900', shadow: 'rgba(30, 58, 138, 0.5)' },
    { emoji: '🛴', bg: 'from-lime-400 to-lime-500', shadow: 'rgba(132, 204, 22, 0.5)' },
  ];
  return vehicles[(parseInt(String(id)) - 1) % vehicles.length] || vehicles[0];
};

// --- COMPONENTS ---

const Kart3D = memo(({ user, className = "w-24 h-24", emojiSize = "text-5xl", isFloating = true }: any) => {
  if (!user) return null;
  const vData = getVehicleData(user.id);
  const league = getLeague(user.score);
  const isActive = user.status === 'active';
  const isPits = user.status === 'pits';
  
  const auraClass = isActive ? `bg-gradient-to-br ${vData.bg} opacity-50 blur-lg group-hover:opacity-100` :
                    isPits ? 'bg-yellow-400 opacity-30 blur-lg' : 'bg-slate-400 opacity-10 blur-sm';

  const pedestalClass = isActive ? `bg-white/60 border-white/90 border-t border-b-4 border-black/10 ${league.border} border-2` :
                        isPits ? 'bg-yellow-100/60 border-yellow-400/50 border-t border-b-4 border-yellow-700/20 border-2' :
                        'bg-slate-200/50 border-slate-300/50 border-t border-b-2 border-slate-400/20';

  const emojiAnimClass = isActive ? 'drop-shadow-md transform -translate-y-2' :
                         isPits ? 'sepia-[.4] transform translate-y-0' : 'grayscale opacity-70 transform translate-y-0';
  
  return (
    <div className={`relative flex items-center justify-center ${className} transition-transform duration-300 hover:scale-110 ${isFloating && isActive ? 'animate-float' : ''}`}>
      <div className={`absolute inset-0 rounded-full transition-all duration-500 ${auraClass}`} />
      <div className={`absolute inset-1 backdrop-blur-sm rounded-full shadow-sm transition-colors duration-500 ${pedestalClass}`} />
      <span className={`relative z-10 ${emojiSize} transition-all duration-500 ${emojiAnimClass} select-none`}>
        {vData.emoji}
      </span>
    </div>
  );
}, (prev: any, next: any) => prev.user?.id === next.user?.id && prev.user?.status === next.user?.status && prev.user?.score === next.user?.score && prev.isFloating === next.isFloating);

const FormattedNumberInput = memo(({ value, onChange, disabled, className, placeholder = "0" }: any) => {
  const safeValue = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(formatNumber(safeValue));

  useEffect(() => {
    setDisplayValue(formatNumber(Number(value) || 0));
  }, [value]);

  const handleChange = (e: any) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numValue = Number(rawValue);
    setDisplayValue(formatNumber(numValue));
    onChange(numValue);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue === "0" && !safeValue ? '' : displayValue}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
});

const MetricCard = memo(({ title, value, meta, type = 'normal' }: any) => {
  const valNum = Number(value) || 0;
  const metaNum = Number(meta) || 0;
  const percentage = metaNum > 0 ? Math.min((valNum / metaNum) * 100, 100) : 0;
  
  return (
    <div className="w-full">
      <span className="opacity-70 block text-[9px] uppercase tracking-wider mb-0.5 flex items-center gap-1">{title}</span>
      <div className="flex items-end justify-between mb-1">
        <span className="text-lg leading-none font-black text-white">
          {type === 'money' ? formatMillions(valNum) : valNum}{type === 'percent' ? '%' : ''}
        </span>
        <span className="opacity-60 text-[9px] font-normal">
          Meta: {type === 'money' ? formatMillions(metaNum) : metaNum}{type === 'percent' ? '%' : ''}
        </span>
      </div>
      <div className="w-full bg-black/30 rounded-full h-1 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-700 ${percentage >= 100 ? 'bg-green-400' : percentage >= 50 ? 'bg-orange-400' : 'bg-red-500'}`} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
    </div>
  );
});

const PitsTopUserButton = memo(({ u, isSelected, onSelect }: any) => (
  <button 
    onClick={() => onSelect(u.id)}
    className={`snap-center flex-shrink-0 relative w-20 h-24 rounded-[2rem] transition-all duration-300 pt-4 ${isSelected ? 'bg-[#ED1C24] shadow-[0_10px_30px_rgba(237,28,36,0.3)] scale-110 border-none z-10' : 'bg-white/70 border border-white/60 shadow-sm hover:bg-white/90'}`}
  >
    <div className="absolute -top-6 left-1/2 -translate-x-1/2 relative">
      <Kart3D user={u} className={`w-16 h-16 transition-all duration-300 ${!isSelected ? 'opacity-80 scale-75' : ''}`} emojiSize="text-3xl" isFloating={isSelected} />
      {u.isUpdated && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 shadow-md border-2 border-white z-20">
          <CheckCircle size={12} strokeWidth={4} />
        </div>
      )}
    </div>
    <div className="absolute bottom-3 w-full text-center">
      <span className={`text-[11px] font-black tracking-wide ${isSelected ? 'text-white' : 'text-slate-600'}`}>{u.name}</span>
    </div>
  </button>
));


const SplashScreen = ({ onComplete }: any) => {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => setIsFading(true), 400);
          setTimeout(onComplete, 1000);
          return 100;
        }
        return p + 4; 
      });
    }, 40);

    const tipInterval = setInterval(() => {
      setTipIndex(i => (i + 1) % SPLASH_TIPS.length);
    }, 1800);

    return () => {
      clearInterval(progressInterval);
      clearInterval(tipInterval);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white transition-opacity duration-500 ease-in-out ${isFading ? 'opacity-0' : 'opacity-100'} overflow-hidden`}>
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-red-600/20 rounded-full blur-3xl opacity-60" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-slate-600/20 rounded-full blur-3xl opacity-60" />
      
      <div className="flex flex-col items-center flex-1 justify-center w-full max-w-md px-8 relative z-10">
        <div className="relative mb-10 group">
          <div className="absolute inset-0 bg-orange-500/50 blur-xl rounded-full animate-pulse" />
          <div className="w-28 h-28 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(249,115,22,0.4)] border-b-4 border-orange-800 relative overflow-hidden">
            <span 
              className="text-white text-[4.5rem] font-black leading-none drop-shadow-md absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-1"
              style={{ WebkitTextStroke: '2px white' }}
            >
              W
            </span>
          </div>
        </div>
        
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight italic text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-slate-400 drop-shadow-sm">
            RALLY COMERCIAL
          </h1>
          <h2 className="text-[#ED1C24] text-lg font-black tracking-[0.2em] uppercase mt-1">
            Edición Modelo
          </h2>
        </div>

        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-6 relative border border-slate-700">
          <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all duration-100 ease-out" style={{ width: `${progress}%` }}>
            <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/50 blur-sm rounded-full" />
          </div>
        </div>

        <div className="h-12 flex items-center justify-center">
          <p className="text-xs font-bold text-slate-400 text-center uppercase tracking-widest">
            {SPLASH_TIPS[tipIndex]}
          </p>
        </div>
      </div>
      
      {/* FIRMA DE AUTORÍA */}
      <div className="pb-10 opacity-50 flex flex-col items-center relative z-10 text-slate-500">
        <span className="text-[10px] font-black tracking-[0.3em] uppercase mb-1">
          Oficina Popayán Modelo
        </span>
        <span className="text-[8px] font-bold tracking-widest uppercase opacity-70">
          Creado por Juan Carlos Rengifo v042026
        </span>
      </div>
    </div>
  );
};

const Dashboard = ({ users, openManagerPanel }: any) => {
  const { topUser, topLeague, badges, promContencion, totalColocadas, totalRodamientosRecuperados, totalRodamientosBase, totalPagahorros, pilotosAutorizados, pilotosTotal, autorizadosRatio, totalFaltaRecuperar, progresoRecuperacionGlobal, preventivasOk, agendasOk } = useMemo(() => {
    const tUser = users.length > 0 ? [...users].sort((a: any, b: any) => b.score - a.score)[0] : null;
    const tLeague = tUser ? getLeague(tUser.score) : null;
    const bdgs = tUser ? getBadges(tUser, users) : [];
    
    const validUsers = users.length > 0 ? users.length : 1; 
    const pCont = users.reduce((acc: number, u: any) => acc + (u.kpis?.contencion || 0), 0) / validUsers;
    const tCol = users.reduce((acc: number, u: any) => acc + (u.kpis?.colocacion?.nuevas || 0) + (u.kpis?.colocacion?.renovaciones || 0), 0);
    const tRec = users.reduce((acc: number, u: any) => acc + (u.kpis?.rodamientos?.recuperado || 0), 0);
    const tBas = users.reduce((acc: number, u: any) => acc + (u.kpis?.rodamientos?.base || 0), 0);
    const tPag = users.reduce((acc: number, u: any) => acc + (u.kpis?.pagahorros || 0), 0);
    
    const pAut = users.filter((u: any) => u.status === 'active').length;
    const pTot = users.length;
    const autRat = pTot > 0 ? (pAut / pTot) * 100 : 0;
    
    const prevOkCount = users.filter((u: any) => u.preventiva?.realizada).length;
    const agendaOkCount = users.filter((u: any) => u.preventiva?.agenda).length;
    
    const tFalta = Math.max(0, tBas - tRec);
    const gProg = tBas > 0 ? (tRec / tBas) * 100 : 0;

    return {
      topUser: tUser, topLeague: tLeague, badges: bdgs, promContencion: pCont, totalColocadas: tCol, totalRodamientosRecuperados: tRec, totalRodamientosBase: tBas, totalPagahorros: tPag, pilotosAutorizados: pAut, pilotosTotal: pTot, autorizadosRatio: autRat, totalFaltaRecuperar: tFalta, progresoRecuperacionGlobal: gProg, preventivasOk: prevOkCount, agendasOk: agendaOkCount
    };
  }, [users]);

  return (
    <div className="pb-32 pt-8 px-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-slate-500 font-bold text-sm uppercase tracking-wider">Pole Position</h2>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight italic">Rally Comercial</h1>
        </div>
        <div className="w-12 h-12 bg-white rounded-[1.5rem] shadow-sm flex items-center justify-center border border-slate-100 relative overflow-hidden group cursor-pointer">
          <div className="absolute inset-0 bg-[#ED1C24]/10 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"/>
          <Flag className="text-[#ED1C24] relative z-10" size={24} />
        </div>
      </header>

      <button 
        onClick={openManagerPanel} 
        className="w-full bg-slate-900 text-white rounded-[2rem] p-4 flex items-center justify-between shadow-lg mb-8 group active:scale-95 transition-transform border border-slate-800"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-inner group-hover:bg-red-500 transition-colors relative overflow-hidden">
            <Power size={20} className="text-white relative z-10" />
          </div>
          <div className="text-left">
             <h3 className="font-black text-sm uppercase tracking-widest text-red-400">Dirección Deportiva</h3>
             <p className="text-[10px] font-bold text-slate-400 leading-tight">Control de Pista y Escudería</p>
          </div>
        </div>
        <div className="bg-slate-800 p-2 rounded-full">
           <Lock size={14} className="text-slate-400 group-hover:text-white transition-colors" />
        </div>
      </button>

      {topUser ? (
        <div className="relative bg-gradient-to-br from-[#ED1C24] to-[#B0151B] rounded-[3rem] p-7 shadow-[0_20px_40px_rgba(237,28,36,0.3)] border border-red-400/30 overflow-visible mt-12 group">
          <div className="absolute -top-16 -right-6 pointer-events-none group-hover:scale-105 transition-transform duration-500">
            <Kart3D user={topUser} className="w-48 h-48" emojiSize="text-[6rem]" />
          </div>
          
          <div className="relative z-10 w-full">
            <div className="flex items-center space-x-2 mb-3">
               <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 border border-white/30">
                 <Trophy size={14} className="text-yellow-300" />
                 <span className="text-white text-xs font-bold uppercase tracking-wider">Líder Rally</span>
               </div>
               <div className={`inline-flex items-center space-x-1 bg-gradient-to-r ${topLeague?.color || 'from-slate-400 to-slate-500'} rounded-full px-3 py-1.5 shadow-sm border border-white/40`}>
                 <span className="text-white text-[10px] font-black uppercase tracking-wider">Liga {topLeague?.name || 'Base'}</span>
               </div>
            </div>
            
            <h3 className="text-white text-4xl font-black mb-1 leading-tight drop-shadow-sm">{topUser.name}</h3>
            
            <p className="text-red-200 font-bold text-lg mb-4 flex items-center space-x-2">
              <Zap size={16} className="text-yellow-400 animate-pulse" />
              <span>{formatNumber(topUser.score)} pts globales</span>
            </p>

            {badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {badges.map(b => (
                  <div key={b.id} className="bg-black/20 backdrop-blur-sm border border-white/20 rounded-xl px-2 py-1 flex items-center space-x-1.5 shadow-sm" title={b.desc}>
                    <b.Icon size={12} className="text-white/90" />
                    <span className="text-white text-[9px] font-bold uppercase tracking-wider">{b.name}</span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mb-4 bg-black/20 rounded-2xl p-3 border border-white/10">
               <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider mb-2 block text-center">Requisitos de Arranque</span>
               <div className="flex justify-around items-center">
                  <div className="flex items-center gap-1.5">
                    <PhoneCall size={14} className={topUser.preventiva?.realizada ? 'text-green-400' : 'text-slate-400'} />
                    <span className="text-white font-black text-xs">{topUser.preventiva?.realizada ? '✅ Preventiva' : '❌ Preventiva'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen size={14} className={topUser.preventiva?.agenda ? 'text-green-400' : 'text-slate-400'} />
                    <span className="text-white font-black text-xs">{topUser.preventiva?.agenda ? '✅ Agenda' : '❌ Agenda'}</span>
                  </div>
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-3 text-white font-bold bg-black/10 rounded-3xl p-4 backdrop-blur-sm border border-white/10">
               <MetricCard title="Contención" value={topUser.kpis?.contencion} meta={METAS.contencion} type="percent" />
               <MetricCard title="Pagahorros" value={topUser.kpis?.pagahorros} meta={METAS.pagahorros} type="normal" />
               <MetricCard 
                  title={<><Star size={10} className="inline mr-1 text-yellow-400" />Cuentas Ahorro</>} 
                  value={topUser.kpis?.cuentas_ahorro} 
                  meta={METAS.cuentas_ahorro} 
                  type="normal" 
               />
               <MetricCard title="Rodamientos" value={topUser.kpis?.rodamientos?.recuperado} meta={topUser.kpis?.rodamientos?.base} type="money" />

               <div className="col-span-2 border-t border-white/10 pt-3">
                 <span className="opacity-70 block text-[9px] uppercase tracking-wider mb-1">Colocación (Meta Total: {METAS.colocacion_total})</span>
                 <div className="flex justify-between items-center bg-white/10 rounded-xl px-3 py-2 border border-white/5">
                   <div>
                     <span className="text-white font-black text-sm leading-none">{topUser.kpis?.colocacion?.nuevas || 0}</span>
                     <span className="text-white/60 font-bold text-[9px] ml-1">Nuevas (M: {METAS.colocacion_nuevas})</span>
                   </div>
                   <div>
                     <span className="text-white font-black text-sm leading-none">{(topUser.kpis?.colocacion?.nuevas || 0) + (topUser.kpis?.colocacion?.renovaciones || 0)}</span>
                     <span className="text-white/60 font-bold text-[9px] ml-1">Totales</span>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/50 backdrop-blur-xl rounded-[2rem] p-8 text-center border border-white/80 mt-12 shadow-sm">
           <h3 className="font-black text-slate-800 text-lg">No hay pilotos registrados</h3>
           <p className="text-xs text-slate-500 mt-2">Usa el panel de Dirección Deportiva para agregar analistas a la escudería.</p>
        </div>
      )}

      <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mt-8 mb-2 pl-2">Marcadores de Oficina</h3>
      
      <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-5 border border-white shadow-sm flex flex-col justify-between mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
              <Power size={16} />
            </div>
            <p className="text-slate-600 font-black text-sm uppercase tracking-wider">Escudería Autorizada</p>
          </div>
          <span className="text-2xl font-black text-slate-800">{pilotosAutorizados}/{pilotosTotal}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
          <div 
            className={`h-full rounded-full transition-all duration-700 ${autorizadosRatio >= 100 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-orange-400 to-red-500'}`}
            style={{ width: `${Math.min(autorizadosRatio, 100)}%` }} 
          />
        </div>
        <div className="flex justify-between mt-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <span className="flex items-center gap-1"><PhoneCall size={12}/> {preventivasOk} Preventivas</span>
          <span className="flex items-center gap-1"><BookOpen size={12}/> {agendasOk} Agendas</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-5 border border-white/80 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-default">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Target size={20} />
          </div>
          <p className="text-slate-400 font-bold text-[9px] uppercase tracking-wider mb-1">Contención Promedio</p>
          <p className="text-2xl font-black text-slate-800 tracking-tight">{promContencion.toFixed(1)}%</p>
        </div>
        <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-5 border border-white/80 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-default">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <TrendingUp size={20} />
          </div>
          <p className="text-slate-400 font-bold text-[9px] uppercase tracking-wider mb-1">Colocaciones Totales</p>
          <p className="text-2xl font-black text-slate-800 tracking-tight">{formatNumber(totalColocadas)}</p>
        </div>
        <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-5 border border-white/80 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-default">
          <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <DollarSign size={20} />
          </div>
          <p className="text-slate-400 font-bold text-[9px] uppercase tracking-wider mb-1">Rodamientos Recuperado</p>
          <p className="text-xl font-black text-slate-800 tracking-tight">{formatMillions(totalRodamientosRecuperados)}</p>
        </div>
        <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-5 border border-white/80 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-default">
          <div className="w-10 h-10 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <PiggyBank size={20} />
          </div>
          <p className="text-slate-400 font-bold text-[9px] uppercase tracking-wider mb-1">Pagahorros Totales</p>
          <p className="text-2xl font-black text-slate-800 tracking-tight">{formatNumber(totalPagahorros)}</p>
        </div>
      </div>

      <div className="mt-4 relative bg-white/70 backdrop-blur-md rounded-[2.5rem] border-2 border-orange-400/50 shadow-sm overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-red-50/50" />
        <div className="relative p-6">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 text-white rounded-full flex items-center justify-center shadow-sm">
                <ShieldAlert size={20} />
              </div>
              <h3 className="text-slate-800 font-black text-sm uppercase tracking-wider">Falta por Recuperar</h3>
            </div>
            <span className="bg-white px-3 py-1 rounded-full text-[9px] font-bold text-slate-500 border border-slate-100">Meta Oficial</span>
          </div>
          <div className="mt-4 mb-5">
            <p className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-red-600 tracking-tighter">
              ${formatNumber(totalFaltaRecuperar)}
            </p>
          </div>
          <div className="w-full">
             <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <span className="text-slate-500">Progreso del Rally</span>
                <span className="text-orange-600 font-black">{Math.round(progresoRecuperacionGlobal)}%</span>
             </div>
             <div className="w-full bg-orange-100/60 rounded-full h-2.5 overflow-hidden shadow-inner border border-orange-200/50">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-700 ease-out" 
                  style={{ width: `${Math.min(progresoRecuperacionGlobal, 100)}%` }} 
                />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Track = memo(({ users }: any) => {
  if (users.length === 0) return <div className="p-8 text-center text-slate-500 font-bold mt-12">Aún no hay pilotos en la pista.</div>;

  const { milestones, currentDay, monthName, timeProgress } = useMemo(() => {
    const today = new Date();
    const currDay = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const mName = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(today);
    const tProgress = currDay / daysInMonth;

    const ms = [
      { label: "🏁 Cierre de Mes (Meta)", date: `${daysInMonth} de ${mName}`, threshold: 80000, users: [] },
      { label: "📍 Corte 3", date: `${Math.floor(daysInMonth * 0.75)} de ${mName}`, threshold: 50000, users: [] },
      { label: "📍 Corte 2", date: `${Math.floor(daysInMonth * 0.5)} de ${mName}`, threshold: 25000, users: [] },
      { label: "🚦 Arranque", date: `1 de ${mName}`, threshold: 0, users: [] },
    ];

    const sorted = [...users].sort((a: any, b: any) => b.score - a.score);

    sorted.forEach((u: any) => {
      if (u.score >= ms[0].threshold) ms[0].users.push(u);
      else if (u.score >= ms[1].threshold) ms[1].users.push(u);
      else if (u.score >= ms[2].threshold) ms[2].users.push(u);
      else ms[3].users.push(u);
    });

    return { milestones: ms, currentDay: currDay, monthName: mName, timeProgress: tProgress };
  }, [users]);

  return (
    <div className="pb-32 pt-8 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">Avance del Mes</h2>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight italic capitalize">Circuito {monthName}</h1>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black text-[#ED1C24]">{currentDay}</span>
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Día Actual</span>
        </div>
      </div>

      <div className="relative mt-8">
        <div className="absolute left-8 top-4 bottom-4 w-6 bg-slate-800 rounded-full shadow-inner border-2 border-slate-600 overflow-hidden">
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 border-l-2 border-dashed border-white/30 -translate-x-1/2" />
          
          <div 
            className="absolute left-0 right-0 h-2 bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.9)] z-20 transition-all duration-1000"
            style={{ top: `${(1 - timeProgress) * 100}%` }}
          >
            <div className="absolute left-8 -top-2 bg-yellow-400 text-yellow-900 text-[8px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-md flex items-center gap-1">
               <CalendarDays size={10} /> HOY
            </div>
          </div>
        </div>

        <div className="space-y-14">
          {milestones.map((ms: any, idx: number) => (
            <div key={idx} className="relative pl-24 min-h-[90px]">
              <div className="absolute left-[1.6rem] top-1 w-5 h-5 rounded-full bg-white border-4 border-[#ED1C24] shadow-[0_0_10px_rgba(237,28,36,0.3)] z-10 flex items-center justify-center" />
              
              <div className="mb-4">
                <h3 className="text-[13px] font-black text-slate-700 bg-white/70 inline-block px-4 py-1.5 rounded-full backdrop-blur-sm shadow-sm border border-white/80">
                  {ms.label}
                </h3>
                <span className="block text-[10px] font-bold text-[#ED1C24] uppercase tracking-wider ml-4 mt-1">
                  🗓️ {ms.date}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-x-6 gap-y-6 mt-2">
                {ms.users.map((u: any) => (
                  <div key={u.id} className="relative group cursor-pointer flex flex-col items-center">
                    <Kart3D user={u} className="w-14 h-14" emojiSize="text-3xl" isFloating={false} />
                    <div className="mt-3 text-center">
                      <p className="text-[11px] font-black text-slate-700 leading-tight mb-1">{u.name}</p>
                      
                      {u.status === 'active' && (
                        <p className="text-[9px] font-bold text-slate-500 bg-white/60 px-2 rounded-full border border-white shadow-sm tabular-nums">
                          {formatNumber(u.score)} pts
                        </p>
                      )}
                      {u.status === 'pits' && (
                        <p className="text-[8px] font-black text-yellow-800 bg-yellow-400 px-2 py-0.5 rounded-full mt-1 shadow-sm uppercase tracking-wider">
                          Bandera Amarilla
                        </p>
                      )}
                      {u.status === 'penalty' && (
                        <div className="flex flex-col items-center gap-0.5">
                          <p className="text-[9px] font-bold text-slate-500 bg-white/60 px-2 rounded-full border border-white shadow-sm tabular-nums">
                            {formatNumber(u.score)} pts
                          </p>
                          <p className="text-[8px] font-black text-white bg-red-600 px-2 py-0.5 rounded-full shadow-sm uppercase tracking-wider">
                            Penalizado (-15k)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {ms.users.length === 0 && (
                  <p className="text-slate-400 text-xs font-bold italic w-full ml-4">Tramo despejado</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

const Pits = ({ users, updateUserKpis }: any) => {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); 
  
  useEffect(() => {
    if (users.length > 0 && (!selectedUserId || !users.find((u: any) => u.id === selectedUserId))) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  const user = users.find((u: any) => u.id === selectedUserId) || users[0];
  const [formData, setFormData] = useState({ kpis: user?.kpis, preventiva: user?.preventiva });

  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFormData({ kpis: { ...user.kpis }, preventiva: { ...user.preventiva } });
      setHasUnsavedChanges(false);
    }
  }, [selectedUserId, user]);

  useEffect(() => {
    if (showPinModal && pinInputRef.current) pinInputRef.current.focus();
  }, [showPinModal]);

  if (users.length === 0) return <div className="p-8 text-center text-slate-500 font-bold mt-12">Agrega pilotos desde Dirección Deportiva para ajustar la telemetría.</div>;

  const handleUnlockClick = () => {
    setPinInput(''); setPinError(false); setShowPinModal(true);
  };

  const submitPin = () => {
    if (pinInput === MANAGER_PIN) {
      setIsUnlocked(true); setShowPinModal(false);
    } else {
      setPinError(true); setPinInput('');
      if (pinInputRef.current) pinInputRef.current.focus();
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
  };

  const handleInputChange = useCallback((category: string, field: string, subfield: string | null, value: any) => {
    if (!isUnlocked) return; 
    const finalValue = typeof value === 'boolean' ? value : (value === '' ? 0 : Number(value));
    
    setFormData((prev: any) => {
      const updated = { ...prev };
      if (subfield) {
        updated[category] = { ...updated[category], [field]: { ...updated[category][field], [subfield]: finalValue } };
      } else {
        updated[category] = { ...updated[category], [field]: finalValue };
      }
      return updated;
    });
    setHasUnsavedChanges(true); 
  }, [isUnlocked]);

  const handleSave = () => {
    if (!isUnlocked) return;
    setIsUpdating(true);
    updateUserKpis(user.id, formData.kpis, formData.preventiva);
    setTimeout(() => {
      setIsUpdating(false);
      setHasUnsavedChanges(false); 
    }, 400);
  };

  const showAsSaved = user.isUpdated && !hasUnsavedChanges;

  return (
    <div className="pb-40 pt-8 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col relative">
      
      {showPinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl w-full max-w-sm flex flex-col items-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-50 text-[#ED1C24] rounded-full flex items-center justify-center mb-4 shadow-inner">
              <Lock size={28} />
            </div>
            <h3 className="font-black text-slate-800 text-xl mb-1 text-center">Acceso Dirección</h3>
            <p className="text-xs text-slate-500 font-bold mb-6 text-center">Ingresa el PIN para actualizar la telemetría.</p>
            <input 
              ref={pinInputRef} type="password" inputMode="numeric" maxLength={4} value={pinInput}
              onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && submitPin()}
              className={`w-full bg-slate-100 rounded-2xl px-4 py-4 text-center font-black text-3xl tracking-[0.5em] mb-2 outline-none border-2 transition-colors ${pinError ? 'border-red-400 bg-red-50 text-red-600' : 'border-transparent focus:border-[#ED1C24] text-slate-800'}`}
              placeholder="••••"
            />
            <div className="h-6">
              {pinError && <p className="text-red-500 text-[11px] font-black uppercase tracking-wider text-center animate-bounce">PIN Incorrecto</p>}
            </div>
            <div className="flex gap-3 mt-2 w-full">
              <button onClick={() => setShowPinModal(false)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-black rounded-2xl active:scale-95 transition-transform">Cancelar</button>
              <button onClick={submitPin} className="flex-1 py-3.5 bg-[#ED1C24] text-white font-black rounded-2xl active:scale-95 transition-transform shadow-sm">Verificar</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">Carga Diaria</h2>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none italic">Pits</h1>
        </div>
        {isUnlocked ? (
           <button onClick={handleLock} className="flex items-center space-x-1 bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider hover:bg-slate-300 transition-colors">
              <Lock size={12} /><span>Bloquear</span>
           </button>
        ) : (
          <button onClick={handleUnlockClick} className="flex items-center space-x-1 bg-[#ED1C24]/10 text-[#ED1C24] px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider hover:bg-[#ED1C24]/20 transition-colors">
            <Unlock size={12} /><span>Editar</span>
          </button>
        )}
      </div>

      <div className="flex overflow-x-auto pb-8 -mx-6 px-6 space-x-4 hide-scrollbar snap-x pt-2">
        {users.map((u: any) => (
          <PitsTopUserButton 
            key={u.id} 
            u={u} 
            isSelected={selectedUserId === u.id} 
            onSelect={setSelectedUserId} 
          />
        ))}
      </div>

      <div className="mt-2 flex-1 relative">
        <div className={`w-full bg-white/80 backdrop-blur-md rounded-[3rem] p-6 border border-white/80 shadow-sm transition-all duration-300 ${isUpdating ? 'ring-4 ring-green-400 scale-[1.02]' : ''}`}>
          
          {!isUnlocked && (
            <div className="absolute inset-0 z-20 backdrop-blur-sm bg-white/60 rounded-[3rem] flex flex-col items-center justify-center p-6 transition-all">
              <div className="bg-white p-8 rounded-[2rem] shadow-lg flex flex-col items-center text-center max-w-[260px] border border-slate-100 transform transition-all hover:scale-105">
                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <Lock size={28} />
                </div>
                <h3 className="font-black text-slate-800 text-lg mb-2">Modo Lectura</h3>
                <p className="text-xs text-slate-500 font-bold mb-6">El ingreso de métricas está protegido.</p>
                <button onClick={handleUnlockClick} className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-sm w-full shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2">
                  <Unlock size={16} /><span>Desbloquear</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-4 mb-6 border-b border-slate-100 pb-4">
            <div className="relative">
              <Kart3D user={user} className="w-16 h-16" emojiSize="text-3xl" isFloating={false} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-slate-800">{user.name}</h3>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${showAsSaved ? 'text-green-500' : 'text-slate-400'}`}>
                {isUnlocked ? (showAsSaved ? 'Métricas al día ✔️' : 'Ajuste de Métricas') : 'Modo Lectura'}
              </p>
            </div>
          </div>

          <div className={`space-y-5 ${!isUnlocked ? 'opacity-50 pointer-events-none' : ''} transition-opacity duration-300`}>

            {/* SECCIÓN ROJA DE REQUISITOS DE ARRANQUE */}
            <div className="flex flex-col gap-4 bg-orange-50/50 p-4 rounded-[1.5rem] border border-orange-100">
              <span className="block text-[11px] font-black text-orange-700 uppercase tracking-wider">Requisitos de Arranque</span>
              
              <div className="flex items-center justify-between">
                 <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5"><PhoneCall size={14} className="text-orange-500"/> Preventiva Realizada</span>
                 <button 
                    onClick={() => handleInputChange('preventiva', 'realizada', null, !formData.preventiva?.realizada)}
                    className={`w-11 h-6 rounded-full transition-colors relative shadow-inner ${formData.preventiva?.realizada ? 'bg-green-500' : 'bg-slate-300'}`}
                 >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${formData.preventiva?.realizada ? 'left-6' : 'left-1'}`} />
                 </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-orange-200/50">
                 <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5"><BookOpen size={14} className="text-orange-500"/> Agenda Presentada</span>
                 <button 
                    onClick={() => handleInputChange('preventiva', 'agenda', null, !formData.preventiva?.agenda)}
                    className={`w-11 h-6 rounded-full transition-colors relative shadow-inner ${formData.preventiva?.agenda ? 'bg-green-500' : 'bg-slate-300'}`}
                 >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${formData.preventiva?.agenda ? 'left-6' : 'left-1'}`} />
                 </button>
              </div>
            </div>

            <div>
              <label className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                <span>Contención (%)</span><span className="text-[#ED1C24]">Meta: {METAS.contencion}%</span>
              </label>
              <div className={`flex items-center rounded-2xl border overflow-hidden bg-slate-50 border-slate-200 focus-within:border-slate-400 transition-colors`}>
                <input 
                  type="text" inputMode="numeric" value={formData.kpis?.contencion === 0 ? '' : formData.kpis?.contencion} 
                  onChange={(e) => handleInputChange('kpis', 'contencion', null, e.target.value)}
                  placeholder="0" className="flex-1 bg-transparent px-4 py-3 font-black text-slate-800 outline-none w-full"
                />
                <span className="px-4 font-black text-slate-400 bg-black/5">%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Nuevas <span className="text-[#ED1C24] text-[9px]">(M: {METAS.colocacion_nuevas})</span></label>
                <input 
                  type="text" inputMode="numeric" value={formData.kpis?.colocacion?.nuevas === 0 ? '' : formData.kpis?.colocacion?.nuevas} 
                  onChange={(e) => handleInputChange('kpis', 'colocacion', 'nuevas', e.target.value)}
                  placeholder="0" className="w-full bg-slate-50 rounded-2xl px-4 py-3 font-black text-slate-800 border border-slate-200 outline-none focus:border-slate-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Renovaciones</label>
                <input 
                  type="text" inputMode="numeric" value={formData.kpis?.colocacion?.renovaciones === 0 ? '' : formData.kpis?.colocacion?.renovaciones} 
                  onChange={(e) => handleInputChange('kpis', 'colocacion', 'renovaciones', e.target.value)}
                  placeholder="0" className="w-full bg-slate-50 rounded-2xl px-4 py-3 font-black text-slate-800 border border-slate-200 outline-none focus:border-slate-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Rodamientos (Base Asignada)</label>
              <div className={`flex items-center rounded-2xl border overflow-hidden mb-3 bg-slate-50 border-slate-200 focus-within:border-slate-400 transition-colors`}>
                <span className="px-4 font-black text-slate-400 bg-black/5">$</span>
                <FormattedNumberInput 
                  value={formData.kpis?.rodamientos?.base} onChange={(val: any) => handleInputChange('kpis', 'rodamientos', 'base', val)}
                  disabled={!isUnlocked} className="flex-1 bg-transparent px-4 py-3 font-black text-slate-800 outline-none w-full"
                />
              </div>

              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Rodamientos (Recuperado)</label>
              <div className={`flex items-center rounded-2xl border overflow-hidden bg-emerald-50 border-emerald-200 focus-within:border-emerald-400 transition-colors`}>
                <span className="px-4 font-black text-emerald-600 bg-emerald-100/50">$</span>
                <FormattedNumberInput 
                  value={formData.kpis?.rodamientos?.recuperado} onChange={(val: any) => handleInputChange('kpis', 'rodamientos', 'recuperado', val)}
                  disabled={!isUnlocked} className="flex-1 bg-transparent px-4 py-3 font-black text-emerald-800 outline-none w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <span>Pagahorros</span><span className="text-[#ED1C24] text-[9px]">(M: {METAS.pagahorros})</span>
                </label>
                <input 
                  type="text" inputMode="numeric" value={formData.kpis?.pagahorros === 0 ? '' : formData.kpis?.pagahorros} 
                  onChange={(e) => handleInputChange('kpis', 'pagahorros', null, e.target.value)}
                  placeholder="0" className="w-full bg-slate-50 rounded-2xl px-4 py-3 font-black text-slate-800 border border-slate-200 outline-none focus:border-slate-400 transition-colors"
                />
              </div>
              <div>
                <label className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <span className="flex items-center gap-1"><Star size={12} className="text-yellow-500"/>Cuentas Ah.</span><span className="text-[#ED1C24] text-[9px]">(M: {METAS.cuentas_ahorro})</span>
                </label>
                <input 
                  type="text" inputMode="numeric" value={formData.kpis?.cuentas_ahorro === 0 ? '' : formData.kpis?.cuentas_ahorro} 
                  onChange={(e) => handleInputChange('kpis', 'cuentas_ahorro', null, e.target.value)}
                  placeholder="0" className="w-full bg-slate-50 rounded-2xl px-4 py-3 font-black text-slate-800 border border-slate-200 outline-none focus:border-slate-400 transition-colors"
                />
              </div>
            </div>
          </div>

          <button 
            disabled={!isUnlocked} onClick={handleSave}
            className={`w-full mt-8 text-white rounded-2xl py-4 font-black flex items-center justify-center space-x-2 transition-all duration-300 ${!isUnlocked ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${showAsSaved ? 'bg-green-500 hover:bg-green-600 shadow-md' : 'bg-[#ED1C24] hover:bg-red-700 shadow-md active:scale-95'}`}
          >
            {showAsSaved ? <CheckCircle size={20} /> : <Save size={20} />}
            <span>{showAsSaved ? 'Telemetría Actualizada' : 'Guardar Telemetría'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const Ranking = memo(({ users }: any) => {
  if (users.length === 0) return <div className="p-8 text-center">No hay pilotos.</div>;
  const sorted = [...users].sort((a: any, b: any) => b.score - a.score);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const podiumUsers = [top3[1], top3[0], top3[2]];

  return (
    <div className="pb-32 pt-8 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">Clasificación General</h2>
      <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-20 italic">Podio de Honor</h1>

      <div className="flex items-end justify-center h-64 mb-16 space-x-2">
        {podiumUsers.map((u, i) => {
          if (!u) return null;
          const isGold = i === 1;
          const isSilver = i === 0;
          const isBronze = i === 2;

          const height = isGold ? 'h-48' : isSilver ? 'h-36' : 'h-28';
          const bg = isGold ? 'bg-gradient-to-t from-yellow-400 to-yellow-200' 
                   : isSilver ? 'bg-gradient-to-t from-slate-300 to-slate-100'
                   : 'bg-gradient-to-t from-orange-400 to-orange-200';
          
          const rank = isGold ? 1 : isSilver ? 2 : 3;

          return (
            <div key={u.id} className={`relative w-24 ${height} ${bg} rounded-t-[2rem] shadow-sm flex flex-col items-center justify-end pb-4 border-t-4 border-white/80 cursor-default`}>
              
              {/* ETIQUETAS EN EL PODIO */}
              {u.status === 'pits' && <div className="absolute -top-3 -right-3 bg-yellow-400 text-yellow-900 text-[8px] font-black px-2 py-0.5 rounded-full z-30 shadow-sm uppercase border border-white">Bandera Amarilla</div>}
              {u.status === 'penalty' && <div className="absolute -top-3 -right-3 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full z-30 shadow-sm uppercase border border-white">Penalizado</div>}

              <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-white/50 to-transparent rounded-t-[2rem]" />
              <div className="absolute bottom-full mb-4 w-full flex justify-center group-hover:-translate-y-2 transition-transform duration-300">
                <Kart3D user={u} className={isGold ? 'w-28 h-28' : 'w-20 h-20'} emojiSize={isGold ? "text-[4.5rem]" : "text-4xl"} isFloating={false} />
              </div>
              <span className="text-slate-800/20 font-black text-6xl absolute top-4 select-none">{rank}</span>
              <span className="text-slate-800 font-black text-sm z-10 truncate w-full text-center px-1 tracking-tight">{u.name}</span>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        {rest.map((u, i) => {
          const league = getLeague(u.score);
          const isPenalty = u.status === 'penalty';
          return (
            <div key={u.id} className={`bg-white/70 backdrop-blur-sm rounded-[2rem] p-4 flex items-center justify-between shadow-sm transition-all group ${isPenalty ? 'border-red-200 opacity-80 bg-red-50/30' : 'border border-white/80'}`}>
              <div className="flex items-center space-x-4">
                <span className="text-slate-400 font-black w-6 text-center text-sm">{i + 4}</span>
                <Kart3D user={u} className="w-12 h-12" emojiSize="text-2xl" isFloating={false} />
                <div className="flex flex-col">
                  <span className="font-black text-slate-700 group-hover:text-[#ED1C24] transition-colors leading-tight">{u.name}</span>
                  <span className={`text-[9px] font-bold ${league.text} uppercase tracking-wider`}>Liga {league.name}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                 <span className={`font-black tabular-nums bg-white/60 border px-3 py-1 rounded-full shadow-sm text-sm ${isPenalty ? 'text-red-400 border-red-200' : 'text-[#ED1C24] border-white/50'}`}>
                  {formatNumber(u.score)} pts
                </span>
                {u.status === 'pits' && <span className="text-[8px] bg-yellow-100 text-yellow-700 border border-yellow-300 px-2 py-0.5 rounded-full font-black uppercase shadow-sm">Bandera Amarilla</span>}
                {u.status === 'penalty' && <span className="text-[8px] bg-red-100 text-red-600 border border-red-300 px-2 py-0.5 rounded-full font-black uppercase shadow-sm">Penalizado (-15k)</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

const Garage = memo(({ users }: any) => {
  if (users.length === 0) return <div className="p-8 text-center text-slate-500 font-bold mt-12">Sin pilotos.</div>;
  return (
    <div className="pb-32 pt-8 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">Métricas Individuales</h2>
      <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-8 italic">Garage</h1>

      <div className="space-y-4">
        {users.map((u: any) => {
          const totalCol = (u.kpis?.colocacion?.nuevas || 0) + (u.kpis?.colocacion?.renovaciones || 0);
          const faltaRodamientos = Math.max(0, (u.kpis?.rodamientos?.base || 0) - (u.kpis?.rodamientos?.recuperado || 0));
          const league = getLeague(u.score);
          const badges = getBadges(u, users);

          return (
            <div key={u.id} className={`bg-white/90 backdrop-blur-sm rounded-[2.5rem] p-5 border shadow-sm transition-shadow ${u.status === 'active' ? 'border-white/80' : u.status === 'pits' ? 'border-yellow-300 bg-yellow-50/50' : 'border-red-300 bg-red-50/50'}`}>
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-4">
                  <Kart3D user={u} className="w-12 h-12" emojiSize="text-2xl" isFloating={false} />
                  <div>
                    <h3 className="font-black text-slate-800 text-lg leading-tight">{u.name}</h3>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r ${league.color} text-white`}>
                        Liga {league.name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{formatNumber(u.score)} pts</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* ETIQUETAS DE ESTADO Y PENALIZACIÓN EN GARAGE */}
              {u.status === 'penalty' && (
                 <div className="bg-red-100 text-red-600 rounded-xl p-3 flex flex-col items-center justify-center space-y-1 mb-4 border border-red-200 text-center">
                    <div className="flex items-center space-x-2">
                       <Ban size={14} />
                       <span className="text-[10px] font-black uppercase tracking-wider">Penalizado (-15.000 pts)</span>
                    </div>
                    <span className="text-[9px] font-bold opacity-80">Por no cumplir requisitos de arranque.</span>
                 </div>
              )}
              {u.status === 'pits' && (
                 <div className="bg-yellow-100 text-yellow-700 rounded-xl p-3 flex items-center justify-center space-x-2 mb-4 border border-yellow-300">
                    <Wrench size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wider">En Pits (Permiso Especial)</span>
                 </div>
              )}

              {/* INSIGNIAS COMERCIALES EN GARAGE */}
              {badges.length > 0 && u.status === 'active' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {badges.map(b => (
                    <div key={b.id} className={`${b.bgClass} border rounded-lg px-2 py-1.5 flex items-center space-x-1.5 shadow-sm`} title={b.desc}>
                      <b.Icon size={14} className={b.colorClass} />
                      <span className={`text-[9px] font-black uppercase tracking-wider ${b.colorClass}`}>{b.name}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* VISTA DETALLADA DE INDICADORES CON METAS CLARAS */}
              <div className={`space-y-4 ${u.status !== 'active' ? 'opacity-60 grayscale' : ''}`}>
                
                {/* SALUD REQUISITOS ARRANQUE (AHORA SOLO CHECKS BOOLEANOS) */}
                <div className="bg-orange-50/50 p-3 rounded-2xl border border-orange-100 flex flex-col gap-2">
                  <div className="flex justify-between items-center pb-2 border-b border-orange-200/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-800 flex items-center gap-1.5"><PhoneCall size={12}/> Preventiva Realizada</span>
                    <span className={u.preventiva?.realizada ? 'text-green-600 font-black text-[10px]' : 'text-red-500 font-black text-[10px]'}>
                      {u.preventiva?.realizada ? '✅ SÍ' : '❌ NO'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-800 flex items-center gap-1.5"><BookOpen size={12}/> Agenda Presentada</span>
                    <span className={u.preventiva?.agenda ? 'text-green-600 font-black text-[10px]' : 'text-red-500 font-black text-[10px]'}>
                      {u.preventiva?.agenda ? '✅ SÍ' : '❌ NO'}
                    </span>
                  </div>
                </div>
                
                <MetricCard title="Contención" value={u.kpis?.contencion} meta={METAS.contencion} type="percent" />

                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100/50 shadow-sm w-full mb-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2">Colocación</span>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <span className="font-black text-emerald-600 text-sm leading-none">{u.kpis?.colocacion?.nuevas || 0} <span className="text-[9px] text-slate-400">Nuevas</span></span>
                        <span className="text-[9px] font-bold text-slate-500">Meta: {METAS.colocacion_nuevas}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                        <div className="bg-emerald-500 h-1 rounded-full" style={{width: `${Math.min(((u.kpis?.colocacion?.nuevas || 0)/METAS.colocacion_nuevas)*100, 100)}%`}}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <span className="font-black text-slate-800 text-sm leading-none">{totalCol} <span className="text-[9px] text-slate-400">Totales</span></span>
                        <span className="text-[9px] font-bold text-slate-500">Meta: {METAS.colocacion_total}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                        <div className="bg-slate-700 h-1 rounded-full" style={{width: `${Math.min((totalCol/METAS.colocacion_total)*100, 100)}%`}}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <MetricCard title="Pagahorros" value={u.kpis?.pagahorros} meta={METAS.pagahorros} />
                   <MetricCard 
                     title={<><Star size={10} className="inline mr-1 text-yellow-500" />Cuentas Ah.</>} 
                     value={u.kpis?.cuentas_ahorro} 
                     meta={METAS.cuentas_ahorro} 
                   />
                </div>

                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100/50 shadow-sm">
                   <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Rodamientos</span>
                      {faltaRodamientos > 0 ? (
                        <span className="text-[9px] font-bold text-orange-500 flex items-center"><AlertCircle size={10} className="mr-1"/> Faltan ${formatMillions(faltaRodamientos)}</span>
                      ) : (
                         <span className="text-[9px] font-bold text-green-500 flex items-center">¡Completado!</span>
                      )}
                   </div>
                   <div className="flex justify-between text-xs font-black">
                      <span className="text-emerald-600">{formatMillions(u.kpis?.rodamientos?.recuperado)}</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-slate-600">{formatMillions(u.kpis?.rodamientos?.base)}</span>
                   </div>
                   <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                     <div className="bg-emerald-500 h-full rounded-full" style={{width: `${(u.kpis?.rodamientos?.base || 0) > 0 ? Math.min(((u.kpis?.rodamientos?.recuperado || 0)/u.kpis.rodamientos.base)*100, 100) : 0}%`}}></div>
                   </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// --- PANEL GERENCIAL ---
const ManagerPanel = ({ users, onClose, changeStatus, addUser, deleteUser, renameUser, resetDay }: any) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [tab, setTab] = useState('engines'); 
  const [newUserName, setNewUserName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isUnlocked && pinInputRef.current) pinInputRef.current.focus();
  }, [isUnlocked]);

  const submitPin = () => {
    if (pinInput === MANAGER_PIN) {
      setIsUnlocked(true);
    } else {
      setPinError(true); setPinInput('');
      if (pinInputRef.current) pinInputRef.current.focus();
    }
  };

  const handleAddUser = () => {
    if (newUserName.trim() && users.length < MAX_USERS) {
      addUser(newUserName.trim());
      setNewUserName('');
    }
  };

  const handleSaveRename = (id: any) => {
    if (editNameValue.trim()) {
      renameUser(id, editNameValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="bg-white p-5 sm:p-6 rounded-[2.5rem] shadow-2xl w-full max-w-sm flex flex-col animate-in zoom-in-95 duration-300 relative overflow-hidden max-h-[90vh] sm:max-h-[85vh]">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 z-10 bg-white rounded-full shadow-sm">
          <X size={20} />
        </button>

        {!isUnlocked ? (
          <div className="flex flex-col items-center w-full py-4 overflow-y-auto hide-scrollbar">
            <div className="w-16 h-16 bg-red-50 text-[#ED1C24] rounded-full flex items-center justify-center mb-4 shadow-inner mt-4 shrink-0">
              <Lock size={28} />
            </div>
            <h3 className="font-black text-slate-800 text-xl mb-1 text-center shrink-0">Acceso a Dirección</h3>
            <p className="text-[11px] text-slate-500 font-bold mb-6 text-center px-4 leading-tight shrink-0">
              Ingresa el PIN de gerencia para abrir el panel de control.
            </p>
            <input 
              ref={pinInputRef} type="password" inputMode="numeric" maxLength={4} value={pinInput}
              onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && submitPin()}
              className={`w-full bg-slate-100 rounded-2xl px-4 py-4 text-center font-black text-3xl tracking-[0.5em] mb-2 outline-none border-2 transition-colors shrink-0 ${pinError ? 'border-red-400 bg-red-50 text-red-600' : 'border-transparent focus:border-[#ED1C24] text-slate-800'}`}
              placeholder="••••"
            />
            <div className="h-6 shrink-0">
              {pinError && <p className="text-red-500 text-[11px] font-black uppercase tracking-wider text-center animate-bounce">PIN Incorrecto</p>}
            </div>
            <button onClick={submitPin} className="w-full mt-2 py-4 bg-[#ED1C24] text-white font-black rounded-2xl active:scale-95 transition-transform shadow-[0_10px_20px_rgba(237,28,36,0.3)] shrink-0">
              Verificar
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col pt-2 flex-1 min-h-0 overflow-hidden">
            <h3 className="font-black text-slate-800 text-lg mb-4 text-center italic tracking-tight shrink-0">Panel de Dirección</h3>
            
            <div className="flex bg-slate-100 p-1 rounded-xl w-full mb-4 shrink-0">
              <button onClick={() => setTab('engines')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${tab === 'engines' ? 'bg-white shadow-sm text-[#ED1C24]' : 'text-slate-400 hover:text-slate-600'}`}>
                <Power size={12}/> Pista
              </button>
              <button onClick={() => setTab('team')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${tab === 'team' ? 'bg-white shadow-sm text-[#ED1C24]' : 'text-slate-400 hover:text-slate-600'}`}>
                <Users size={12}/> Escudería
              </button>
            </div>

            {/* TAB PISTA */}
            {tab === 'engines' && (
              <div className="w-full flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 hide-scrollbar pb-2">
                  {users.length === 0 && <p className="text-center text-slate-400 text-xs py-4 font-bold">No hay pilotos.</p>}
                  {users.map((u: any) => {
                    const isPrev = !!u.preventiva?.realizada;
                    const isAgenda = !!u.preventiva?.agenda;
                    
                    return (
                      <div key={u.id} className="flex flex-col bg-white p-3 rounded-xl border border-slate-100 shadow-sm shrink-0 mb-2">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <span className="text-2xl opacity-90">{getVehicleData(u.id).emoji}</span>
                              <div>
                                <span className="block text-xs font-black text-slate-700 leading-tight">{u.name}</span>
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${u.status === 'active' ? 'text-green-500' : u.status === 'pits' ? 'text-yellow-600' : 'text-red-500'}`}>
                                  {u.status === 'active' ? 'Autorizado' : u.status === 'pits' ? 'En Pits' : 'Falla / Penalizado'}
                                </span>
                              </div>
                            </div>
                            
                            {/* INDICADOR RÁPIDO PARA EL GERENTE */}
                            <div className="flex gap-1.5">
                               <div className={`p-1.5 rounded-full shadow-inner ${isPrev ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`} title={`Preventiva: ${isPrev ? 'SÍ' : 'NO'}`}>
                                  <PhoneCall size={10} />
                               </div>
                               <div className={`p-1.5 rounded-full shadow-inner ${isAgenda ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`} title={`Agenda: ${isAgenda ? 'SÍ' : 'NO'}`}>
                                  <BookOpen size={10} />
                               </div>
                            </div>
                        </div>
                        <div className="flex bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                          <button onClick={() => changeStatus(u.id, 'active')} className={`flex-1 py-1.5 text-[9px] font-black uppercase transition-colors ${u.status === 'active' ? 'bg-green-500 text-white' : 'text-slate-500 hover:bg-slate-200'}`}>Pista</button>
                          <button onClick={() => changeStatus(u.id, 'pits')} className={`flex-1 py-1.5 text-[9px] font-black uppercase transition-colors border-l border-r border-slate-200 ${u.status === 'pits' ? 'bg-yellow-500 text-white border-none' : 'text-slate-500 hover:bg-slate-200'}`}>Pits</button>
                          <button onClick={() => changeStatus(u.id, 'penalty')} className={`flex-1 py-1.5 text-[9px] font-black uppercase transition-colors ${u.status === 'penalty' ? 'bg-red-500 text-white' : 'text-slate-500 hover:bg-slate-200'}`}>Falla</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* BOTON DE REINICIO DIARIO */}
                <div className="mt-2 pt-3 border-t border-slate-200 shrink-0">
                   {!confirmReset ? (
                     <button onClick={() => setConfirmReset(true)} className="w-full py-2.5 bg-yellow-100 text-yellow-800 font-black rounded-xl transition-colors border border-yellow-300 text-xs flex justify-center items-center gap-2 active:scale-95">
                       <RefreshCw size={14} /> Iniciar Nuevo Día (Reset Preventiva)
                     </button>
                   ) : (
                     <div className="flex gap-2">
                       <button onClick={() => { resetDay(); setConfirmReset(false); }} className="flex-1 py-2.5 bg-red-600 text-white font-black rounded-xl transition-transform active:scale-95 text-[10px] shadow-md uppercase tracking-wider">
                         Confirmar Reset
                       </button>
                       <button onClick={() => setConfirmReset(false)} className="flex-1 py-2.5 bg-slate-200 text-slate-700 font-black rounded-xl transition-transform active:scale-95 text-[10px] uppercase tracking-wider">
                         Cancelar
                       </button>
                     </div>
                   )}
                </div>
              </div>
            )}

            {/* TAB ESCUDERÍA */}
            {tab === 'team' && (
              <div className="w-full flex-1 flex flex-col min-h-0">
                <div className="mb-4 shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-100">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-[10px] font-black text-slate-600 uppercase">Nuevo Piloto</span>
                     <span className={`text-[9px] font-black ${users.length >= MAX_USERS ? 'text-red-500' : 'text-slate-400'}`}>{users.length}/{MAX_USERS} MAX</span>
                   </div>
                   <div className="flex gap-2">
                     <input 
                       type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)}
                       placeholder="Nombre..." maxLength={12} disabled={users.length >= MAX_USERS}
                       className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#ED1C24] disabled:opacity-50"
                     />
                     <button 
                       onClick={handleAddUser} disabled={!newUserName.trim() || users.length >= MAX_USERS}
                       className="bg-[#ED1C24] text-white px-3 rounded-lg flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
                     ><UserPlus size={14}/></button>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 hide-scrollbar pb-4 min-h-0">
                  {users.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm shrink-0 mb-2">
                      <div className="flex items-center space-x-3 flex-1 min-w-0 pr-2">
                        <span className="text-xl">{getVehicleData(u.id).emoji}</span>
                        {editingId === u.id ? (
                          <input 
                            type="text" autoFocus value={editNameValue} onChange={e=>setEditNameValue(e.target.value)} maxLength={12}
                            onKeyDown={e => e.key==='Enter' && handleSaveRename(u.id)}
                            className="flex-1 min-w-0 bg-slate-100 border border-slate-300 rounded px-2 py-1 text-xs font-black text-slate-800 outline-none"
                          />
                        ) : (
                          <span className="font-black text-slate-700 text-xs truncate">{u.name}</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {confirmDeleteId === u.id ? (
                          <>
                            <button onClick={() => deleteUser(u.id)} className="bg-red-500 text-white text-[9px] font-black uppercase px-2 py-1.5 rounded-md active:scale-95 transition-transform">Borrar</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="bg-slate-200 text-slate-600 p-1.5 rounded-md"><X size={12}/></button>
                          </>
                        ) : editingId === u.id ? (
                           <>
                             <button onClick={() => handleSaveRename(u.id)} className="bg-green-500 text-white p-1.5 rounded-md"><Check size={12}/></button>
                             <button onClick={() => setEditingId(null)} className="bg-slate-200 text-slate-600 p-1.5 rounded-md"><X size={12}/></button>
                           </>
                        ) : (
                          <>
                            <button onClick={() => {setEditingId(u.id); setEditNameValue(u.name); setConfirmDeleteId(null);}} className="text-slate-400 hover:text-blue-500 p-1.5 bg-slate-50 rounded-md transition-colors"><Edit2 size={12}/></button>
                            <button onClick={() => {setConfirmDeleteId(u.id); setEditingId(null);}} disabled={users.length <= 1} className="text-slate-400 hover:text-red-500 p-1.5 bg-slate-50 rounded-md transition-colors disabled:opacity-30"><Trash2 size={12}/></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={onClose} className="w-full mt-2 py-3 bg-slate-800 text-white font-black rounded-2xl active:scale-95 transition-transform shrink-0 shadow-[0_10px_20px_rgba(0,0,0,0.15)]">
              Cerrar Panel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- APP MAIN COMPONENT ---
export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showManagerPanel, setShowManagerPanel] = useState(false);
  
  const [users, setUsers] = useState(() => getUsersWithScores(INITIAL_USERS));
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { if (document.head.contains(link)) document.head.removeChild(link); };
  }, []);

  // --- LÓGICA DE FIREBASE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Error Auth Firebase:", err);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = collection(db, COLL_PATH);
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          if (snapshot.empty) {
            INITIAL_USERS.forEach(u => {
               setDoc(doc(db, COLL_PATH, u.id), u);
            });
          } else {
            const loadedUsers = snapshot.docs.map(doc => sanitizeUser(doc.data()));
            setUsers(getUsersWithScores(loadedUsers));
            setIsLoadingData(false);
          }
        }, (error) => {
           console.error("Error leyendo Firebase", error);
           setUsers(getUsersWithScores(INITIAL_USERS));
           setIsLoadingData(false);
        });
        return () => unsubscribeSnapshot();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // --- ACTUALIZACIONES A FIREBASE ---
  const updateUserKpis = useCallback(async (id: any, newKpis: any, preventiva: any) => {
    try {
      await updateDoc(doc(db, COLL_PATH, id), { kpis: newKpis, preventiva: preventiva, isUpdated: true });
    } catch (e) { console.error("Error guardando:", e); }
  }, []);

  const changeStatus = useCallback(async (id: any, newStatus: any) => {
    try {
      await updateDoc(doc(db, COLL_PATH, id), { status: newStatus });
    } catch (e) { console.error("Error cambiando status:", e); }
  }, []);

  const addUser = useCallback(async (name: any) => {
    const newId = String(Math.max(0, ...users.map(u => parseInt(u?.id || 0))) + 1);
    const newUser = sanitizeUser({
      id: newId, name, status: 'pits', isUpdated: true
    });
    try {
      await setDoc(doc(db, COLL_PATH, newId), newUser);
    } catch (e) { console.error("Error agregando:", e); }
  }, [users]);

  const deleteUser = useCallback(async (id: any) => {
    if (users.length <= 1) return; 
    try {
      await deleteDoc(doc(db, COLL_PATH, id));
    } catch (e) { console.error("Error borrando:", e); }
  }, [users]);

  const renameUser = useCallback(async (id: any, newName: any) => {
    try {
      await updateDoc(doc(db, COLL_PATH, id), { name: newName });
    } catch (e) { console.error("Error renombrando:", e); }
  }, []);

  const resetDay = useCallback(async () => {
    try {
      const promises = users.map(u => 
        updateDoc(doc(db, COLL_PATH, u.id), { 
          status: 'pits', 
          isUpdated: false,
          preventiva: { realizada: false, agenda: false }
        })
      );
      await Promise.all(promises);
    } catch (e) { console.error("Error reiniciando día:", e); }
  }, [users]);

  if (showSplash || isLoadingData) {
    return (
      <div className="font-['Nunito',sans-serif] bg-slate-900 min-h-screen">
        <SplashScreen onComplete={() => setShowSplash(false)} />
      </div>
    );
  }

  const TABS = [
    { id: 'dashboard', icon: Home, label: 'Lobby' },
    { id: 'track', icon: Map, label: 'Pista' },
    { id: 'pits', icon: FastForward, label: 'Pits' },
    { id: 'ranking', icon: Trophy, label: 'Podio' },
    { id: 'garage', icon: Settings, label: 'Garage' },
  ];

  return (
    <div className="font-['Nunito',sans-serif] bg-[#F8FAFC] min-h-screen text-slate-800 selection:bg-red-200">
      
      {showManagerPanel && (
        <ManagerPanel 
          users={users} 
          onClose={() => setShowManagerPanel(false)} 
          changeStatus={changeStatus} 
          addUser={addUser}
          deleteUser={deleteUser}
          renameUser={renameUser}
          resetDay={resetDay}
        />
      )}

      {/* Fondos dinámicos ligeros */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-red-200/40 rounded-full blur-3xl opacity-50 animate-blob" style={{ transform: 'translateZ(0)' }} />
        <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-slate-300/40 rounded-full blur-3xl opacity-50 animate-blob animation-delay-2000" style={{ transform: 'translateZ(0)' }} />
      </div>

      <main className="relative z-10 max-w-md mx-auto min-h-screen bg-[#F8FAFC]/90 backdrop-blur-md shadow-2xl overflow-x-hidden pb-4">
        {activeTab === 'dashboard' && <Dashboard users={users} openManagerPanel={() => setShowManagerPanel(true)} />}
        {activeTab === 'track' && <Track users={users} />}
        {activeTab === 'pits' && <Pits users={users} updateUserKpis={updateUserKpis} />}
        {activeTab === 'ranking' && <Ranking users={users} />}
        {activeTab === 'garage' && <Garage users={users} />}
      </main>

      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-6 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-xl border border-white shadow-[0_20px_40px_rgba(0,0,0,0.05)] rounded-[2.5rem] px-6 py-4 flex items-center justify-between w-full max-w-md pointer-events-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center w-12 transition-all duration-300 ${isActive ? 'text-[#ED1C24] -translate-y-2' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <div className={`absolute inset-0 bg-red-50 rounded-full transition-transform duration-400 ease-out ${isActive ? 'scale-110 opacity-100' : 'scale-0 opacity-0'}`} style={{ zIndex: -1 }} />
                <Icon size={24} strokeWidth={isActive ? 3 : 2} className="mb-1" />
                <span className={`text-[9px] font-black uppercase tracking-wider transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 absolute top-10'}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-3 w-1.5 h-1.5 bg-[#ED1C24] rounded-full shadow-sm" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(20px, -30px) scale(1.05); }
          66% { transform: translate(-15px, 15px) scale(0.95); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
          100% { transform: translateY(0px); }
        }
        .animate-blob { animation: blob 10s infinite; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
      `}} />
    </div>
  );
}