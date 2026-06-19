'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Star, Play, Pause, RotateCcw, Hand, MonitorPlay,
  ShieldAlert, CheckCircle2, Sparkles, Store, ChevronRight,
} from 'lucide-react';

const C = {
  ink: '#1f2937', paper: '#fff7ed', panel: '#ffffff', line: '#e5e7eb',
  orange: '#f97316', orangeDk: '#ea580c', orangeSoft: '#fff7ed',
  waChat: '#ECE5DD', waOut: '#DCF8C6', waIn: '#FFFFFF',
  marigold: '#f59e0b', marigoldSoft: '#fef3c7',
  clay: '#dc2626', claySoft: '#fef2f2', muted: '#6b7280', star: '#f59e0b',
};

const intro = (channel: string) => ([
  { t: 'sys', text: channel === 'pos' ? 'Petpooja · bill settled at Spice Garden' : 'QR scanned · customer opened chat', delay: 700 },
  { t: 'biz', text: 'Namaste! 🙏 Thanks for dining at Spice Garden. How was your meal today?', delay: 1300 },
  { t: 'stars', delay: 1100 },
]);

interface Beat {
  t: string;
  text?: string;
  n?: number;
  branch?: string;
  delay: number;
}

const SCRIPTS: Record<string, Beat[]> = {
  happy: [
    ...intro('pos'),
    { t: 'rating', n: 5, delay: 1300 },
    { t: 'gate', branch: 'public', delay: 900 },
    { t: 'biz', text: 'Wonderful — so glad you loved it! 🌟 Would you share a quick Google review? It really helps us.', delay: 1500 },
    { t: 'googleBtn', delay: 1100 },
    { t: 'cust', text: 'Done! Just left 5 stars ⭐', delay: 1600 },
    { t: 'dash-review', delay: 700 },
    { t: 'biz', text: 'Thank you so much! 🙏 See you again soon.', delay: 1400 },
    { t: 'end', delay: 1800 },
  ],
  unhappy: [
    ...intro('qr'),
    { t: 'rating', n: 2, delay: 1300 },
    { t: 'gate', branch: 'private', delay: 900 },
    { t: 'biz', text: "Oh no — we're really sorry it wasn't up to the mark. What went wrong?", delay: 1500 },
    { t: 'reasons', delay: 1100 },
    { t: 'cust', text: 'Food was cold', delay: 1600 },
    { t: 'dash-alert', delay: 700 },
    { t: 'biz', text: 'Thank you for telling us — our manager will make it right. Please accept 20% off your next visit. 🙏', delay: 1500 },
    { t: 'end', delay: 1800 },
  ],
};

function StarsDisplay({ n, size = 16, color = C.star }: { n: number; size?: number; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= n ? color : 'none'} color={i <= n ? color : '#d1d5db'} strokeWidth={2} />
      ))}
    </span>
  );
}

function Bubble({ b, manual, chosen, canTap, onTap }: {
  b: Beat; manual: boolean; chosen: number | null; canTap: boolean; onTap: (n: number) => void;
}) {
  if (b.t === 'sys')
    return <div style={{ alignSelf: 'center', background: '#d7e8d0', color: '#3a5238', fontSize: 10, padding: '3px 9px', borderRadius: 8, fontWeight: 600 }}>{b.text}</div>;
  const mine = b.t === 'cust' || b.t === 'rating';
  const base: React.CSSProperties = {
    maxWidth: '84%', alignSelf: mine ? 'flex-end' : 'flex-start',
    background: mine ? C.waOut : C.waIn, borderRadius: 10, padding: '7px 10px',
    fontSize: 12, lineHeight: 1.45, color: '#1f2b25', boxShadow: '0 1px 0 rgba(0,0,0,.05)',
  };
  if (b.t === 'stars')
    return (
      <div style={base}>
        <div style={{ marginBottom: 5, color: C.muted, fontSize: 10.5 }}>Tap to rate</div>
        <div style={{ display: 'flex', gap: 3 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} onClick={() => onTap(i)} disabled={!canTap}
              style={{ background: 'none', border: 'none', cursor: canTap ? 'pointer' : 'default', padding: 1 }}>
              <Star size={22} color={C.star} fill="none" strokeWidth={2} />
            </button>
          ))}
        </div>
      </div>
    );
  if (b.t === 'rating') return <div style={base}><StarsDisplay n={manual && chosen !== null ? chosen : (b.n ?? 0)} size={17} /></div>;
  if (b.t === 'googleBtn')
    return (
      <div style={base}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', background: '#fff', border: '1px solid #EAF1FE', color: '#1A56C4', fontWeight: 700, fontSize: 12, padding: '7px 9px', borderRadius: 8 }}>
          <Star size={14} fill="#1A56C4" color="#1A56C4" /> Leave a Google review
        </div>
      </div>
    );
  if (b.t === 'reasons')
    return (
      <div style={base}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {['Food was cold', 'Slow service', 'Pricing', 'Other'].map((r) => (
            <span key={r} style={{ background: C.claySoft, color: C.clay, fontWeight: 600, fontSize: 11, padding: '5px 9px', borderRadius: 999 }}>{r}</span>
          ))}
        </div>
      </div>
    );
  if (['gate', 'dash-review', 'dash-alert', 'end'].includes(b.t)) return null;
  return <div style={base}>{b.text}</div>;
}

function Lane({ active, dim, color, bg, icon, title, sub }: {
  active: boolean; dim: boolean; color: string; bg: string;
  icon: React.ReactNode; title: string; sub: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10,
      background: active ? bg : '#fff', border: `1px solid ${active ? color : C.line}`,
      opacity: dim ? 0.4 : 1, transition: 'all .3s ease',
    }}>
      <div style={{ display: 'grid', placeItems: 'center', width: 22 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: active ? color : C.ink }}>{title}</div>
        <div style={{ fontSize: 10.5, color: C.muted }}>{sub}</div>
      </div>
      {active && <CheckCircle2 size={15} color={color} />}
    </div>
  );
}

function Stat({ label, value, icon, accent, bump }: {
  label: string; value: string | number; icon: React.ReactNode; accent?: string; bump?: boolean;
}) {
  return (
    <div style={{
      border: `1px solid ${bump ? (accent || C.orange) : C.line}`, borderRadius: 11, padding: '8px 9px',
      background: bump ? (accent ? C.claySoft : C.orangeSoft) : '#fff', transition: 'all .3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        {icon}<span style={{ fontSize: 9.5, color: C.muted, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent || C.ink }}>{value}</div>
    </div>
  );
}

function pillBtn(filled: boolean, color = C.orange): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    padding: '7px 13px', borderRadius: 999,
    border: filled ? 'none' : `1px solid ${color}`,
    background: filled ? color : '#fff',
    color: filled ? '#fff' : color,
  };
}

const anim: React.CSSProperties = { animation: 'ri .35s ease both' };

export default function DemoPlayer({ compact = false }: { compact?: boolean }) {
  const [scenario, setScenario] = useState<'happy' | 'unhappy'>('happy');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [manual, setManual] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const script = SCRIPTS[scenario];
  const revealed = script.slice(0, step);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [step]);

  useEffect(() => {
    if (step >= script.length) {
      if (!manual) {
        const id = setTimeout(() => {
          setScenario((s) => (s === 'happy' ? 'unhappy' : 'happy'));
          setStep(0);
        }, 1500);
        return () => clearTimeout(id);
      }
      return;
    }
    const beat = script[step];
    if (manual && beat.t === 'rating' && chosen == null) return;
    if (!manual && !playing) return;
    const id = setTimeout(() => setStep((s) => s + 1), beat.delay);
    return () => clearTimeout(id);
  }, [step, script, scenario, playing, manual, chosen]);

  const atEnd = step >= script.length;
  const gateShown = revealed.some((b) => b.t === 'gate');
  const activeBranch = gateShown ? (scenario === 'happy' ? 'public' : 'private') : null;
  const reviewAdded = revealed.some((b) => b.t === 'dash-review');
  const alertAdded = revealed.some((b) => b.t === 'dash-alert');

  function tryIt() {
    setManual(true); setPlaying(false); setChosen(null);
    setScenario('happy'); setStep(3);
  }
  function autoMode() {
    setManual(false); setChosen(null); setScenario('happy'); setStep(0); setPlaying(true);
  }
  function replay() {
    if (manual) { setChosen(null); setStep(3); }
    else { setStep(0); setPlaying(true); }
  }
  function pickScenario(s: 'happy' | 'unhappy') {
    setManual(false); setChosen(null); setScenario(s); setStep(0); setPlaying(true);
  }
  function tapStar(n: number) {
    if (!manual || chosen != null) return;
    setChosen(n);
    setScenario(n >= 4 ? 'happy' : 'unhappy');
  }

  const progress = Math.min(100, Math.round((step / script.length) * 100));

  return (
    <div>
      {/* control bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {!manual ? (
          <button onClick={() => setPlaying((p) => !p)} style={pillBtn(true)}>
            {playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Play'}
          </button>
        ) : (
          <button onClick={autoMode} style={pillBtn(false)}><MonitorPlay size={14} /> Watch auto demo</button>
        )}
        {!manual && (
          <div style={{ display: 'flex', gap: 4, background: '#f9fafb', border: `1px solid ${C.line}`, borderRadius: 999, padding: 3 }}>
            {([['happy', 'Happy path'], ['unhappy', 'Unhappy path']] as const).map(([k, label]) => (
              <button key={k} onClick={() => pickScenario(k)} style={{
                fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 999, cursor: 'pointer', border: 'none',
                background: scenario === k ? (k === 'happy' ? C.orange : C.clay) : 'transparent',
                color: scenario === k ? '#fff' : C.muted,
              }}>{label}</button>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {!manual
          ? <button onClick={tryIt} style={pillBtn(false, C.marigold)}><Hand size={14} /> Try it yourself</button>
          : <button onClick={replay} style={pillBtn(false)}><RotateCcw size={14} /> Replay</button>}
      </div>

      {/* progress bar */}
      {!manual && (
        <div style={{ height: 3, background: C.line, borderRadius: 999, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: scenario === 'happy' ? C.orange : C.clay, transition: 'width .4s linear' }} />
        </div>
      )}

      {/* three panels */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'stretch' }}>

        {/* PHONE */}
        <div style={{ flex: '1 1 300px', minWidth: 280 }}>
          <div style={{ background: '#1c1917', borderRadius: 24, padding: 7, height: '100%' }}>
            <div style={{ background: C.orangeDk, borderRadius: '17px 17px 0 0', padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: '#ffffff22', display: 'grid', placeItems: 'center' }}>
                <Store size={14} color="#fff" />
              </div>
              <div style={{ color: '#fff' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Spice Garden</div>
                <div style={{ fontSize: 9.5, opacity: 0.8 }}>business account</div>
              </div>
              {manual && chosen == null && (
                <span style={{ marginLeft: 'auto', fontSize: 9.5, color: '#fff', background: C.marigold, padding: '2px 7px', borderRadius: 999, fontWeight: 700 }}>
                  tap a star ↓
                </span>
              )}
            </div>
            <div ref={chatRef} style={{
              background: C.waChat, height: compact ? 300 : 330, overflowY: 'auto',
              padding: '11px 9px', display: 'flex', flexDirection: 'column', gap: 7,
            }}>
              {revealed.map((b, i) => (
                <Bubble key={i} b={b} manual={manual} chosen={chosen} canTap={manual && chosen == null} onTap={tapStar} />
              ))}
              {revealed.length === 0 && <div style={{ margin: 'auto', color: C.muted, fontSize: 12 }}>Starting…</div>}
            </div>
            <div style={{ height: 8, background: C.waChat, borderRadius: '0 0 17px 17px' }} />
          </div>
        </div>

        {/* RIGHT: explainer + dashboard */}
        <div style={{ flex: '1 1 320px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* GATING EXPLAINER */}
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.3, marginBottom: 10 }}>THE GATING FORK</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, whiteSpace: 'nowrap' }}>Rating</div>
              <ChevronRight size={16} color={C.line} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <Lane active={activeBranch === 'public'} dim={activeBranch === 'private'}
                  color={C.orange} bg={C.orangeSoft} icon={<Star size={14} fill={C.orange} color={C.orange} />}
                  title="4–5★ → public" sub="Sent to Google review link" />
                <Lane active={activeBranch === 'private'} dim={activeBranch === 'public'}
                  color={C.clay} bg={C.claySoft} icon={<ShieldAlert size={14} color={C.clay} />}
                  title="1–3★ → private" sub="Manager alerted, never goes public" />
              </div>
            </div>
          </div>

          {/* DASHBOARD PEEK */}
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.3, marginBottom: 10 }}>OWNER DASHBOARD</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <Stat label="Avg rating" value="4.6" icon={<Star size={13} fill={C.star} color={C.star} />} />
              <Stat label="Public" value={reviewAdded ? 129 : 128} bump={reviewAdded} icon={<CheckCircle2 size={13} color={C.orange} />} />
              <Stat label="Intercepted" value={alertAdded ? 13 : 12} bump={alertAdded} accent={C.clay} icon={<ShieldAlert size={13} color={C.clay} />} />
            </div>
            <div style={{ minHeight: 78 }}>
              {!reviewAdded && !alertAdded && (
                <div style={{ fontSize: 12, color: C.muted, padding: '14px 6px', textAlign: 'center' }}>Watch a result land here →</div>
              )}
              {reviewAdded && (
                <div style={anim}>
                  <div style={{ border: `1px solid ${C.line}`, borderRadius: 11, padding: 10, background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                      <span style={{ background: '#EAF1FE', color: '#1A56C4', fontWeight: 600, fontSize: 10.5, padding: '2px 7px', borderRadius: 999 }}>Google</span>
                      <StarsDisplay n={5} size={12} />
                      <span style={{ fontSize: 11.5, fontWeight: 600 }}>Priya · just now</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#27332D', marginBottom: 6 }}>Fantastic food and lovely service — highly recommend!</div>
                    <div style={{ fontSize: 10.5, color: C.orange, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Sparkles size={11} /> AI reply drafted · ready to post
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, marginTop: 6, textAlign: 'center' }}>+1 public review on Google ✓</div>
                </div>
              )}
              {alertAdded && (
                <div style={anim}>
                  <div style={{ border: `1px solid ${C.claySoft}`, borderRadius: 11, padding: 10, background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                      <span style={{ background: C.claySoft, color: C.clay, fontWeight: 600, fontSize: 10.5, padding: '2px 7px', borderRadius: 999 }}>Private</span>
                      <StarsDisplay n={2} size={12} color={C.clay} />
                      <span style={{ fontSize: 11.5, fontWeight: 600 }}>QR · dine-in · just now</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#27332D' }}>Reason: Food was cold → manager notified for recovery</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.clay, fontWeight: 700, marginTop: 6, textAlign: 'center' }}>Intercepted privately — never went public ✓</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 12 }}>
        {manual ? "You're driving — tap a star rating in the chat." : atEnd ? 'Replaying…' : 'Auto-playing. Tap "Try it yourself" to take over.'}
      </div>

      <style>{`@keyframes ri{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
