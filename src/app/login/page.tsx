'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep]       = useState<'request' | 'verify'>('request');
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');

  async function requestOtp() {
    setLoading(true); setError(''); setInfo('');
    try {
      const r = await fetch('/api/auth/request-otp', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || '寄送失敗，請稍後再試'); return; }
      setStep('verify');
      setInfo('驗證碼已寄出，請查看信箱');
    } finally { setLoading(false); }
  }

  async function verifyOtp(code: string) {
    if (!/^\d{6}$/.test(code)) { setError('請輸入 6 位數字'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/verify-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ otp: code }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error || '驗證失敗');
        setOtp('');
        return;
      }
      router.replace('/');
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="liquid-glass-strong liquid-lensing rounded-ios-xl p-8 w-full max-w-md space-y-6">
        <div className="text-center">
          <div
            className="w-14 h-14 mx-auto rounded-ios-md flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))',
              boxShadow: '0 8px 24px rgba(10,132,255,0.35), inset 0 1px 0 rgba(255,255,255,0.30)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h1 className="font-display font-bold text-[22px] text-primary tracking-tight">CHB 檔案傳輸 · 登入</h1>
          <p className="text-tertiary text-[13px] mt-1 font-display">
            {step === 'request' ? '驗證碼將寄至管理員信箱' : '請輸入信箱中的 6 位數驗證碼'}
          </p>
        </div>

        {step === 'request' ? (
          <button
            onClick={requestOtp}
            disabled={loading}
            className="w-full py-3.5 rounded-ios-lg font-display font-semibold text-[15px] text-white liquid-lensing transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))',
              boxShadow: '0 8px 24px rgba(10,132,255,0.40), inset 0 1px 0 rgba(255,255,255,0.30)',
              opacity: loading ? 0.55 : 1,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? '寄送中…' : '寄送驗證碼到我的信箱'}
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              disabled={loading}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtp(v);
                setError('');
                if (v.length === 6 && !loading) verifyOtp(v);
              }}
              placeholder="------"
              autoFocus
              className="w-full liquid-glass-thin rounded-ios-md py-3.5 px-4 text-center text-[26px] font-mono tracking-[0.5em] text-primary outline-none placeholder:text-quaternary disabled:opacity-60"
            />
            <p className="text-center text-[12px] font-display text-quaternary">
              {loading ? '驗證中…' : '輸入完 6 位數即自動驗證'}
            </p>
            <button
              type="button"
              onClick={() => { setStep('request'); setOtp(''); setError(''); setInfo(''); }}
              disabled={loading}
              className="w-full text-tertiary text-[12px] font-display hover:text-secondary transition-colors py-1 disabled:opacity-50"
            >
              重新寄送驗證碼
            </button>
          </div>
        )}

        {info  && <p className="text-[13px] text-center font-display" style={{ color: 'var(--ios-green)' }}>{info}</p>}
        {error && <p className="text-[13px] text-center font-display" style={{ color: 'var(--ios-red)' }}>{error}</p>}

        <p className="text-[11px] text-quaternary font-display text-center pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          僅授權人員可登入 · 所有登入行為均記錄
        </p>
      </div>
    </div>
  );
}
