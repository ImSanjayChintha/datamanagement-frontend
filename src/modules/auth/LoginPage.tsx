import { useState, FormEvent } from 'react';
import { authApi } from '@/core/api';
import { useAuthStore } from '@/core/auth';
import toast from 'react-hot-toast';
import { Settings2, Truck, Headphones, Award, ShieldCheck } from 'lucide-react';

// ── Brand colours (from gmcindustrial.es logo) ────────────────────────────────
const C = {
  slate:    '#535769',   // exact logo background / primary brand
  slateD:   '#2d3042',   // darker shade for panel bg gradient start
  slateDD:  '#1e2030',   // deepest background
  slateL:   '#767a90',   // lighter accent
  slatePale:'#ececf2',   // very light tint (right-panel marquee pill bg)
  white:    '#ffffff',
} as const;

// ── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  { Icon: Settings2,  title: 'Transmisiones Industriales', desc: 'Catálogo completo de correas, cadenas, poleas y acoplamientos.' },
  { Icon: Award,      title: 'Rodamientos & Rodillos',     desc: 'Distribuidores autorizados de SKF, NSK, FAG, Timken y otros.' },
  { Icon: Truck,      title: 'Entrega Rápida',             desc: 'Envío el mismo día para referencias en stock a toda España y Europa.' },
  { Icon: Headphones, title: 'Soporte Técnico',            desc: 'Ingenieros especializados para selección e instalación de componentes.' },
  { Icon: ShieldCheck,title: 'Calidad Garantizada',        desc: 'Todos los productos cumplen normativa ISO con trazabilidad completa.' },
];

// ── Brand marquee ─────────────────────────────────────────────────────────────
const BRANDS = [
  'SKF', 'NSK', 'FAG / Schaeffler', 'Timken', 'NTN', 'INA', 'Rexnord',
  'Fenner', 'Gates', 'Continental', 'Optibelt', 'Bando', 'Dunlop',
  'Stieber', 'Ondrives', 'Tsubaki', 'Renold', 'SIT', 'Dodge', 'Lenze',
];

// ── GMC logo — actual SVG paths from gmcindustrial.es (white / light version) ─
function GmcLogo({ scale = 1 }: { scale?: number }) {
  const w = Math.round(199 * scale);
  const h = Math.round(107 * scale);
  return (
    <svg width={w} height={h} viewBox="0 0 199 107" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#gmc-logo-clip)">
        {/* Gear ring */}
        <path
          fill="white"
          d="M92.77 85.56L91.31 83.34C91.03 82.92 90.57 82.67 90.06 82.67H54.07C37.84 82.67 24.69 69.51 24.69 53.29C24.69 37.06 37.85 23.91 54.07 23.91H89.94C90.45 23.91 90.93 23.65 91.2 23.22L92.48 21.22C93.42 19.82 93.22 18.1 92.05 16.98L89.69 14.61C88.52 13.49 86.73 13.3 85.43 14.23L81.6 16.74C80.4 17.52 79.05 17.51 77.81 16.68L77.65 16.58C76.56 15.85 75.89 14.5 76.15 13.09L77.02 8.6C77.39 7.04 76.53 5.46 75.06 4.8L71.97 3.52C70.49 2.87 68.72 3.49 67.89 4.73L65.26 8.49C64.53 9.58 63.15 10.12 61.75 9.86L61.62 9.89C60.22 9.63 59.21 8.61 58.95 7.31L58.05 2.76C57.74 1.2 56.29 0 54.68 0.05L51.43 0.02C49.82 0.07 48.41 1.16 48.05 2.71L47.18 7.2C46.92 8.6 45.77 9.64 44.47 9.89C43.17 10.15 41.72 9.62 40.94 8.43L38.43 4.6C37.5 3.3 35.76 2.7 34.28 3.39L31.6 4.86C30.09 5.43 29.2 7.09 29.51 8.65L30.41 13.2C30.67 14.5 30.14 15.95 28.92 16.6L28.79 16.63C27.59 17.41 26.24 17.4 25.02 16.7L21.29 14.2C19.89 13.26 18.17 13.46 17.05 14.63L14.68 16.99C13.56 18.16 13.37 19.95 14.3 21.25L16.81 25.08C17.59 26.28 17.58 27.63 16.75 28.87L16.65 29.03C15.92 30.12 14.57 30.79 13.17 30.53L8.68 29.66C7.12 29.29 5.54 30.15 4.88 31.62L3.6 34.71C2.95 36.19 3.57 37.96 4.81 38.79L8.57 41.42C9.66 42.15 10.2 43.53 9.94 44.93L9.97 45.06C9.71 46.46 8.69 47.47 7.26 47.75L2.71 48.65C1.15 48.96 -0.05 50.41 0 52.02V55.4C0.04 57.01 1.13 58.42 2.68 58.78L7.17 59.65C8.57 59.91 9.61 61.06 9.86 62.36C10.12 63.66 9.59 65.11 8.4 65.89L4.57 68.4C3.27 69.33 2.67 71.07 3.36 72.55L4.65 75.67C5.22 77.18 6.88 78.07 8.44 77.76L12.99 76.86C14.29 76.6 15.74 77.13 16.39 78.35L16.42 78.48C17.2 79.68 17.19 81.03 16.49 82.25L14.14 85.41C13.2 86.81 13.4 88.53 14.57 89.65L16.93 92.02C18.1 93.14 19.89 93.33 21.19 92.4L25.02 89.89C26.22 89.11 27.57 89.12 28.81 89.95L28.97 90.05C30.06 90.78 30.73 92.13 30.47 93.54L29.6 98.03C29.23 99.59 30.08 101.17 31.56 101.83L34.65 103.11C36.13 103.76 37.9 103.14 38.73 101.9L41.36 98.14C42.09 97.05 43.47 96.51 44.87 96.77L45 96.74C46.4 97 47.41 98.02 47.67 99.32L48.57 103.87C48.88 105.43 50.33 106.63 51.94 106.58L55.19 106.61C56.8 106.56 58.21 105.47 58.57 103.92L59.44 99.43C59.7 98.03 60.85 96.99 62.15 96.74C63.45 96.48 64.9 97.01 65.68 98.2L68.19 102.03C69.12 103.33 70.86 103.93 72.34 103.24L75.46 101.95C76.97 101.38 77.86 99.72 77.55 98.16L76.65 93.61C76.39 92.31 76.92 90.86 78.14 90.21L78.27 90.18C79.47 89.4 80.82 89.41 82.04 90.11L85.77 92.61C87.17 93.55 88.89 93.35 90.01 92.18L92.38 89.82C93.5 88.65 93.69 86.86 92.76 85.56H92.77ZM53.49 12.95C55.03 12.95 56.27 14.2 56.27 15.73C56.27 17.26 55.02 18.51 53.49 18.51C51.96 18.51 50.71 17.26 50.71 15.73C50.71 14.2 51.96 12.95 53.49 12.95ZM15.94 56.06C14.4 56.06 13.16 54.81 13.16 53.28C13.16 51.75 14.41 50.5 15.94 50.5C17.47 50.5 18.72 51.75 18.72 53.28C18.72 54.81 17.47 56.06 15.94 56.06ZM24.97 24.76C26.06 23.67 27.82 23.67 28.91 24.76C30 25.85 30 27.61 28.91 28.7C27.82 29.79 26.06 29.79 24.97 28.7C23.88 27.61 23.88 25.85 24.97 24.76ZM28.9 81.8C27.81 82.89 26.05 82.89 24.96 81.8C23.87 80.71 23.87 78.95 24.96 77.86C26.05 76.77 27.81 76.77 28.9 77.86C29.99 78.95 29.99 80.71 28.9 81.8ZM53.49 93.61C51.95 93.61 50.71 92.36 50.71 90.83C50.71 89.3 51.96 88.05 53.49 88.05C55.02 88.05 56.27 89.3 56.27 90.83C56.27 92.36 55.02 93.61 53.49 93.61Z"
        />
        {/* G */}
        <path fill="white" d="M59.18 43.36H81.77V27.33H54.93C40.64 27.33 29.05 38.92 29.05 53.21C29.05 67.5 40.64 79.09 54.93 79.09H81.77V45.78H57.74V57.69H61.4V63.06H59.18C53.77 63.06 49.33 58.62 49.33 53.21C49.33 47.8 53.77 43.36 59.18 43.36Z"/>
        {/* M */}
        <path fill="white" d="M85.77 79.67V27.92H110.1L116.76 50.71L123.33 27.92H147.76V79.67H127.39V63.93L122.85 79.67H110.59L106.05 63.93V79.67"/>
        {/* C */}
        <path fill="white" d="M181.88 63.06H198.68V79.09H177.63C156.37 79.09 151.75 67.5 151.75 53.21C151.75 38.92 156.67 27.33 177.63 27.33H198.68V43.36H181.88C172.86 43.36 172.03 47.8 172.03 53.21C172.03 58.62 172 63.06 181.88 63.06Z"/>
      </g>
      <defs>
        <clipPath id="gmc-logo-clip">
          <rect width="198.68" height="106.61" fill="white"/>
        </clipPath>
      </defs>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { setAuth } = useAuthStore();
  const [email, setEmail]       = useState('admin@corex.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      setAuth(
        res.access_token,
        { id: res.admin_id, email, full_name: res.full_name, role: res.role },
        res.must_change_password,
      );
    } catch {
      toast.error('Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  }

  const allBrands = [...BRANDS, ...BRANDS];

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: "'Geist', system-ui, sans-serif",
    }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
      <div style={{
        width: '46%',
        minWidth: 380,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '52px 44px',
        background: `linear-gradient(160deg, ${C.slateDD} 0%, ${C.slateD} 45%, ${C.slate} 100%)`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle texture overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 70% 50% at 10% 20%, rgba(255,255,255,0.04) 0%, transparent 70%)`,
        }} />
        {/* Gear watermark — bottom-right, slow clockwise */}
        <div style={{
          position: 'absolute', right: -60, bottom: -60, pointerEvents: 'none', opacity: 0.06,
        }}>
          <svg className="login-gear-cw" width={280} height={280} viewBox="0 0 72 72" fill="none">
            <circle cx="36" cy="36" r="29" stroke="white" strokeWidth="4" fill="none"/>
            {Array.from({length:10},(_,i)=>i*36).map(a=>(
              <rect key={a} x="33.5" y="2" width="5" height="10" rx="2" fill="white" transform={`rotate(${a} 36 36)`}/>
            ))}
            <circle cx="36" cy="36" r="19.5" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>
        </div>

        {/* Gear watermark — top-left, counter-clockwise, smaller */}
        <div style={{
          position: 'absolute', left: -40, top: -40, pointerEvents: 'none', opacity: 0.04,
        }}>
          <svg className="login-gear-ccw" width={180} height={180} viewBox="0 0 72 72" fill="none">
            <circle cx="36" cy="36" r="29" stroke="white" strokeWidth="4" fill="none"/>
            {Array.from({length:10},(_,i)=>i*36).map(a=>(
              <rect key={a} x="33.5" y="2" width="5" height="10" rx="2" fill="white" transform={`rotate(${a} 36 36)`}/>
            ))}
            <circle cx="36" cy="36" r="19.5" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>
        </div>

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 52 }}>
          <GmcLogo scale={0.9} />
        </div>

        {/* Headline */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 40 }}>
          <h2 style={{
            margin: 0, color: C.white, fontSize: 26, fontWeight: 700,
            lineHeight: 1.35, letterSpacing: '-0.01em',
          }}>
            Su socio de confianza
          </h2>
          <p style={{
            margin: '4px 0 0', color: '#ffffff', fontSize: 22,
            fontWeight: 400, lineHeight: 1.3,
          }}>
            en suministro industrial
          </p>
          <p style={{
            margin: '16px 0 0', color: '#e0e3f0', fontSize: 13,
            lineHeight: 1.65, maxWidth: 310,
          }}>
            Más de 30 años sirviendo a fabricantes, equipos de mantenimiento y OEMs en
            España y toda Europa.
          </p>
        </div>

        {/* Feature list */}
        <ul style={{
          flex: 1, margin: 0, padding: 0, listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: 22,
          position: 'relative', zIndex: 1,
        }}>
          {FEATURES.map(({ Icon, title, desc }) => (
            <li key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                flexShrink: 0, background: 'rgba(255,255,255,0.09)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 9, padding: '7px 8px', marginTop: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={15} color="#d0d5e8" />
              </div>
              <div>
                <div style={{ color: C.white, fontWeight: 600, fontSize: 12.5 }}>{title}</div>
                <div style={{ color: '#d0d5e8', fontSize: 11.5, marginTop: 2, lineHeight: 1.55 }}>{desc}</div>
              </div>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <p style={{ position: 'relative', zIndex: 1, marginTop: 36, color: '#c0c4d8', fontSize: 11, fontWeight: 600 }}>
          &copy; {new Date().getFullYear()} GMC Transmisiones y Rodamientos S.L.
        </p>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: '#f7f8fa', overflow: 'hidden',
      }}>

        {/* Form centred in available space */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '48px 40px',
        }}>
          <div style={{ width: '100%', maxWidth: 360 }}>
            <div style={{ marginBottom: 32 }}>
              <h1 style={{
                margin: 0, fontSize: 23, fontWeight: 700,
                color: C.slateDD, letterSpacing: '-0.01em',
              }}>
                Bienvenido de nuevo
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#7a7e96' }}>
                Accede al portal de administración GMC
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label" htmlFor="email">Correo electrónico</label>
                <input
                  id="email" type="email" autoComplete="email" required
                  className="input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="label" htmlFor="password">Contraseña</label>
                <input
                  id="password" type="password" autoComplete="current-password" required
                  className="input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', padding: '10px 16px',
                  borderRadius: 8, border: 'none',
                  background: loading ? '#9ca3af' : C.slate,
                  color: C.white, fontSize: 14, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                  fontFamily: 'inherit', letterSpacing: '0.01em',
                }}
                onMouseEnter={e => { if (!loading)(e.currentTarget.style.background = C.slateD); }}
                onMouseLeave={e => { if (!loading)(e.currentTarget.style.background = C.slate);  }}
              >
                {loading ? 'Accediendo…' : 'Iniciar sesión'}
              </button>
            </form>

            <p style={{ marginTop: 22, fontSize: 12, textAlign: 'center', color: '#9ca3af' }}>
              ¿Necesitas acceso?{' '}
              <a
                href="mailto:it@gmcindustrial.es"
                style={{ color: C.slate, textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                Contacta con soporte IT
              </a>
            </p>
          </div>
        </div>

        {/* ── Brand marquee ───────────────────────────────────────────── */}
        <div style={{
          borderTop: '1px solid #e4e6ec', background: C.white,
          paddingTop: 14, paddingBottom: 18, overflow: 'hidden', flexShrink: 0,
        }}>
          <p style={{
            margin: '0 0 10px', textAlign: 'center', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b0b3c6',
          }}>
            Distribuidores autorizados de
          </p>
          <div style={{ overflow: 'hidden' }}>
            <div className="marquee-track" style={{ display: 'flex', gap: 8, width: 'max-content' }}>
              {allBrands.map((brand, i) => (
                <span
                  key={i}
                  style={{
                    flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 13px', borderRadius: 999,
                    background: C.slatePale, border: `1px solid #d8dae6`,
                    color: C.slateD, fontSize: 11, fontWeight: 600,
                    whiteSpace: 'nowrap', userSelect: 'none',
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.slate, flexShrink: 0 }} />
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
