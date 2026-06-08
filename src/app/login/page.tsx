'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LEN  = 6;

// ── 6 分格 OTP 輸入元件 ────────────────────────────────────────────────────
interface OtpBoxesProps {
  value:      string[];
  onChange:   (v: string[]) => void;
  onComplete: (code: string) => void;
  disabled:   boolean;
  shake:      boolean;
}

function OtpBoxes({ value, onChange, onComplete, disabled, shake }: OtpBoxesProps) {
  const refs       = useRef<(HTMLInputElement | null)[]>(Array(OTP_LEN).fill(null));
  const [focused, setFocused] = useState(-1);

  function handleChange(i: number, raw: string) {
    const v    = raw.replace(/\D/g, '').slice(-1);
    const next = [...value];
    next[i]    = v;
    onChange(next);
    if (v && i < OTP_LEN - 1) refs.current[i + 1]?.focus();
    const code = next.join('');
    if (code.length === OTP_LEN && !disabled) onComplete(code);
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (value[i]) {
        const next = [...value]; next[i] = ''; onChange(next);
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft'  && i > 0)           refs.current[i - 1]?.focus();
    else if   (e.key === 'ArrowRight' && i < OTP_LEN - 1) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN);
    if (!pasted) return;
    const next = (pasted.split('').concat(Array(OTP_LEN).fill(''))).slice(0, OTP_LEN) as string[];
    onChange(next);
    refs.current[Math.min(pasted.length, OTP_LEN - 1)]?.focus();
    if (pasted.length === OTP_LEN && !disabled) onComplete(pasted);
  }

  return (
    <div className={`flex gap-2.5 justify-center ${shake ? 'animate-shake' : ''}`}>
      {Array.from({ length: OTP_LEN }).map((_, i) => {
        const isFilled  = !!value[i];
        const isFocused = focused === i;
        return (
          <input
            key={i}
            ref={el => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={2}           /* 允許輸入後 slice(-1) 取最後一位，maxLength=2 避免 iOS 吃字 */
            value={value[i]}
            disabled={disabled}
            autoFocus={i === 0}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={() => setFocused(i)}
            onBlur={() => setFocused(-1)}
            className="w-11 h-14 text-center text-[22px] font-mono font-semibold rounded-ios-md outline-none transition-all duration-200 disabled:opacity-50 select-none"
            style={{
              background: isFocused
                ? 'linear-gradient(135deg, rgba(10,132,255,0.18) 0%, rgba(100,210,255,0.10) 100%)'
                : isFilled
                  ? 'linear-gradient(135deg, rgba(10,132,255,0.14) 0%, rgba(100,210,255,0.07) 100%)'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.05) 100%)',
              border: isFocused
                ? '1.5px solid rgba(10,132,255,0.75)'
                : isFilled
                  ? '1px solid rgba(10,132,255,0.40)'
                  : '1px solid rgba(255,255,255,0.12)',
              boxShadow: isFocused
                ? '0 0 0 3px rgba(10,132,255,0.18), inset 0 1px 0 rgba(255,255,255,0.22)'
                : isFilled
                  ? '0 2px 6px rgba(10,132,255,0.15), inset 0 1px 0 rgba(255,255,255,0.15)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.08)',
              color:      'var(--text-primary)',
              caretColor: 'var(--ios-blue)',
            }}
          />
        );
      })}
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [step,         setStep]         = useState<'request' | 'verify'>('request');
  const [email,        setEmail]        = useState('');
  const [digits,       setDigits]       = useState<string[]>(Array(OTP_LEN).fill(''));
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [info,         setInfo]         = useState('');
  const [checking,     setChecking]     = useState(true);
  const [showRemember, setShowRemember] = useState(false);
  const [totpMode,     setTotpMode]     = useState(false);
  const [countdown,    setCountdown]    = useState(0);
  const [shake,        setShake]        = useState(false);

  const emailValid = EMAIL_RE.test(email.trim());

  // 倒數計時 tick
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // 頁面載入：偵測已記住裝置
  useEffect(() => {
    fetch('/api/auth/check-device')
      .then(r => r.json())
      .then((j: { found: boolean; email?: string }) => {
        if (j.found && j.email) {
          setEmail(j.email);
          setInfo('驗證碼已寄出，請查收信件');
          setStep('verify');
          setCountdown(60);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // 錯誤搖晃
  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  async function requestOtp() {
    if (!emailValid) { setError('Email 格式不正確'); return; }
    setLoading(true); setError(''); setInfo('');
    try {
      const r = await fetch('/api/auth/request-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
      });
      const j = await r.json().catch(() => ({})) as { error?: string };
      if (!r.ok) { setError(j.error || '寄送失敗，請稍後再試'); return; }
      setStep('verify');
      setInfo('驗證碼已寄出，請查收信件');
      setCountdown(60);
    } finally { setLoading(false); }
  }

  async function verifyOtp(code: string) {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/verify-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), otp: code }),
      });
      const j = await r.json().catch(() => ({})) as { error?: string };
      if (!r.ok) {
        setError(j.error || '驗證失敗');
        setDigits(Array(OTP_LEN).fill(''));
        triggerShake();
        return;
      }
      setShowRemember(true);
    } finally { setLoading(false); }
  }

  async function verifyTotpLogin(code: string) {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/verify-totp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), code }),
      });
      const j = await r.json().catch(() => ({})) as { error?: string };
      if (!r.ok) {
        setError(j.error || '備援驗證失敗');
        setDigits(Array(OTP_LEN).fill(''));
        triggerShake();
        return;
      }
      setShowRemember(true);
    } finally { setLoading(false); }
  }

  async function doRemember() {
    await fetch('/api/auth/remember-device', { method: 'POST' }).catch(() => {});
    router.replace('/');
    router.refresh();
  }

  function skipRemember() {
    router.replace('/');
    router.refresh();
  }

  // 裝置辨識中
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div
          className="liquid-glass-strong liquid-lensing rounded-ios-xl p-8 w-full max-w-md flex items-center justify-center"
          style={{ minHeight: 220 }}
        >
          <p className="text-tertiary text-[13px] font-display animate-pulse">辨識裝置中…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* 主卡片：入場動畫 */}
      <div className="liquid-glass-strong liquid-lensing rounded-ios-xl p-8 w-full max-w-md space-y-6 animate-ios-slide-up">

        {/* ── Header ── */}
        <div className="text-center space-y-3">
          <div
            className="w-14 h-14 mx-auto rounded-ios-md flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))',
              boxShadow:  '0 8px 24px rgba(10,132,255,0.35), inset 0 1px 0 rgba(255,255,255,0.30)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>

          <div>
            <h1 className="font-display font-bold text-[22px] text-primary tracking-tight">
              CHB 檔案傳輸 · 登入
            </h1>
            {step === 'verify' ? (
              /* Email chip */
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-display font-medium"
                style={{
                  background: 'rgba(10,132,255,0.10)',
                  border:     '1px solid rgba(10,132,255,0.28)',
                  color:      'var(--ios-cyan)',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                {email}
              </div>
            ) : (
              <p className="text-tertiary text-[13px] mt-1 font-display">請輸入已授權的 Email</p>
            )}
          </div>
        </div>

        {/* ── Step 1：Email 輸入 ── */}
        {step === 'request' ? (
          <div className="space-y-3">
            <input
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              disabled={loading}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && emailValid && !loading) requestOtp(); }}
              placeholder="your-email@example.com"
              className="w-full liquid-glass-thin rounded-ios-md py-3.5 px-4 text-[15px] font-display text-primary outline-none placeholder:text-quaternary disabled:opacity-60"
            />
            <button
              onClick={requestOtp}
              disabled={loading || !emailValid}
              className="w-full py-3.5 rounded-ios-lg font-display font-semibold text-[15px] text-white liquid-lensing transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))',
                boxShadow:  '0 8px 24px rgba(10,132,255,0.40), inset 0 1px 0 rgba(255,255,255,0.30)',
                opacity:    (loading || !emailValid) ? 0.45 : 1,
                cursor:     (loading || !emailValid) ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '寄送中…' : '寄送驗證碼'}
            </button>
          </div>
        ) : (
          /* ── Step 2：驗證碼輸入 ── */
          <div className="space-y-4">
            {!totpMode ? (
              <>
                {/* 6 分格 OTP — key 切換模式時重置 focus */}
                <OtpBoxes
                  key="otp"
                  value={digits}
                  onChange={v => { setDigits(v); setError(''); }}
                  onComplete={verifyOtp}
                  disabled={loading}
                  shake={shake}
                />

                <p className="text-center text-[12px] font-display text-quaternary">
                  {loading ? '驗證中…' : '輸入完 6 位數即自動驗證'}
                </p>

                {/* 更換 Email ←→ 重新寄送 */}
                <div className="flex items-center justify-between text-[12px] font-display">
                  <button
                    type="button"
                    onClick={() => { setStep('request'); setDigits(Array(OTP_LEN).fill('')); setError(''); setInfo(''); }}
                    disabled={loading}
                    className="text-tertiary hover:text-secondary transition-colors disabled:opacity-50"
                  >
                    ← 更換 Email
                  </button>
                  {countdown > 0 ? (
                    <span className="text-quaternary tabular-nums">重新寄送 ({countdown}s)</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setDigits(Array(OTP_LEN).fill('')); setError(''); requestOtp(); }}
                      disabled={loading}
                      className="text-tertiary hover:text-secondary transition-colors disabled:opacity-50"
                    >
                      重新寄送 →
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => { setTotpMode(true); setDigits(Array(OTP_LEN).fill('')); setError(''); }}
                  disabled={loading}
                  className="w-full text-quaternary text-[11px] font-display hover:text-tertiary transition-colors py-0.5 disabled:opacity-50"
                >
                  收不到驗證信？改用備援驗證碼（Authenticator App）
                </button>
              </>
            ) : (
              <>
                <p className="text-center text-[12px] font-display text-secondary">
                  開啟 Authenticator App，輸入顯示的 6 位數
                </p>

                <OtpBoxes
                  key="totp"
                  value={digits}
                  onChange={v => { setDigits(v); setError(''); }}
                  onComplete={verifyTotpLogin}
                  disabled={loading}
                  shake={shake}
                />

                <p className="text-center text-[12px] font-display text-quaternary">
                  {loading ? '驗證中…' : '輸入完 6 位數即自動驗證'}
                </p>

                <button
                  type="button"
                  onClick={() => { setTotpMode(false); setDigits(Array(OTP_LEN).fill('')); setError(''); }}
                  disabled={loading}
                  className="w-full text-tertiary text-[12px] font-display hover:text-secondary transition-colors py-1 disabled:opacity-50"
                >
                  ← 返回使用驗證信
                </button>
              </>
            )}
          </div>
        )}

        {/* Info / Error — 帶 icon */}
        {info && !error && (
          <div className="flex items-center justify-center gap-1.5 text-[13px] font-display" style={{ color: 'var(--ios-green)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            {info}
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center gap-1.5 text-[13px] font-display" style={{ color: 'var(--ios-red)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            {error}
          </div>
        )}

        <p className="text-[11px] text-quaternary font-display text-center pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          僅授權 Email 可登入 · 所有登入行為均記錄
        </p>
      </div>

      {/* ── 記住這台裝置 Modal ── */}
      {showRemember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div className="liquid-glass-strong liquid-lensing rounded-ios-xl p-6 max-w-sm w-full space-y-4 animate-ios-pop">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-ios-md flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-cyan))',
                  boxShadow:  '0 4px 12px rgba(10,132,255,0.35)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="14" height="9" rx="2" />
                  <path d="M6 7V5a3 3 0 016 0v2" />
                  <circle cx="9" cy="12" r="1.2" fill="white" stroke="none" />
                </svg>
              </div>
              <div>
                <h3 className="font-display font-bold text-[16px] text-primary">記住這台裝置？</h3>
                <p className="text-[12px] text-tertiary font-display mt-0.5">有效期限 30 天</p>
              </div>
            </div>
            <p className="text-[13px] text-secondary font-display leading-relaxed">
              下次開啟時，系統自動寄出驗證碼給你，不用再輸入 Email。
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={skipRemember}
                className="flex-1 liquid-glass-thin rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-secondary"
              >
                這次不要
              </button>
              <button
                onClick={doRemember}
                className="flex-1 rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))',
                  boxShadow:  '0 4px 14px rgba(10,132,255,0.40)',
                }}
              >
                記住，快速登入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
