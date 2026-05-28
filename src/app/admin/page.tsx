'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Entry {
  email:   string;
  addedAt: number;
  isAdmin: boolean;
}

interface BlockEntry {
  ip:        string;
  blockedAt: number;
  reason:    string;
}

export default function AdminPage() {
  const router = useRouter();
  const [list, setList]       = useState<Entry[]>([]);
  const [blocked, setBlocked] = useState<BlockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [newEmail, setNew]    = useState('');
  const [error, setError]     = useState('');
  const [confirmDel, setConfirmDel]         = useState<string | null>(null);
  const [confirmUnblock, setConfirmUnblock] = useState<string | null>(null);

  // B5: Admin tab
  type AdminTab = 'whitelist' | 'blocklist' | 'totp' | 'pack';
  const [adminTab, setAdminTab] = useState<AdminTab>('whitelist');

  // 壓縮密碼
  const [packPw,        setPackPw]        = useState('');
  const [packLvl,       setPackLvl]       = useState(9);
  const [packPwShow,    setPackPwShow]    = useState(false);
  const [packPwSaving,  setPackPwSaving]  = useState(false);
  const [packPwError,   setPackPwError]   = useState('');
  const [packPwOk,      setPackPwOk]      = useState('');
  const [packPwUpdated, setPackPwUpdated] = useState<number>(0);

  useEffect(() => {
    fetch('/api/pack-password').then(r => r.json()).then(j => {
      setPackPw(j.password ?? '');
      setPackLvl(j.compressionLevel ?? 9);
      setPackPwUpdated(j.updatedAt ?? 0);
    }).catch(() => {});
  }, []);

  async function savePackPw() {
    if (packPw.length < 1) { setPackPwError('密碼不可為空'); return; }
    setPackPwSaving(true); setPackPwError(''); setPackPwOk('');
    try {
      const r = await fetch('/api/pack-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: packPw, compressionLevel: packLvl }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setPackPwError(j.error ?? '儲存失敗'); return; }
      setPackPwUpdated(Date.now());
      setPackPwOk('已儲存');
      setTimeout(() => setPackPwOk(''), 2000);
    } finally { setPackPwSaving(false); }
  }

  // TOTP 狀態
  const [totpConfigured, setTotpConfigured]   = useState<boolean | null>(null);
  const [totpSetup, setTotpSetup]             = useState<{ secret: string; qrCode: string } | null>(null);
  const [totpVerifyCode, setTotpVerifyCode]   = useState('');
  const [totpLoading, setTotpLoading]         = useState(false);
  const [totpError, setTotpError]             = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [rW, rB] = await Promise.all([
        fetch('/api/admin/whitelist'),
        fetch('/api/admin/blocklist'),
      ]);
      const jW = await rW.json().catch(() => ({}));
      const jB = await rB.json().catch(() => ({}));
      if (!rW.ok) setError(jW.error || '讀取白名單失敗');
      else setList(jW.list || []);
      if (rB.ok) setBlocked(jB.list || []);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    fetch('/api/admin/totp').then(r => r.json()).then(j => setTotpConfigured(!!j.configured)).catch(() => {});
  }, []);

  async function unblock(ip: string) {
    setConfirmUnblock(null);
    setError('');
    const r = await fetch(`/api/admin/blocklist?ip=${encodeURIComponent(ip)}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error || '解除失敗'); return; }
    await load();
  }

  async function addEmail() {
    if (!newEmail.trim()) return;
    setAdding(true); setError('');
    try {
      const r = await fetch('/api/admin/whitelist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: newEmail.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || '新增失敗'); return; }
      setNew('');
      await load();
    } finally { setAdding(false); }
  }

  async function delEmail(email: string) {
    setConfirmDel(null);
    setError('');
    const r = await fetch(`/api/admin/whitelist?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error || '刪除失敗'); return; }
    await load();
  }

  async function startTotpSetup() {
    setTotpLoading(true); setTotpError('');
    const r = await fetch('/api/admin/totp', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setTotpError(j.error || '產生 QR Code 失敗'); setTotpLoading(false); return; }
    setTotpSetup({ secret: j.secret, qrCode: j.qrCode });
    setTotpLoading(false);
  }

  async function confirmTotpSetup() {
    if (!totpSetup || !totpVerifyCode.trim()) return;
    setTotpLoading(true); setTotpError('');
    const r = await fetch('/api/admin/totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: totpSetup.secret, code: totpVerifyCode.trim() }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setTotpError(j.error || '驗證失敗'); setTotpLoading(false); return; }
    setTotpConfigured(true); setTotpSetup(null); setTotpVerifyCode(''); setTotpLoading(false);
  }

  async function disableTotp() {
    setTotpLoading(true); setTotpError('');
    await fetch('/api/admin/totp', { method: 'DELETE' });
    setTotpConfigured(false); setTotpSetup(null); setTotpLoading(false);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  const fmtDate = (ms: number) => {
    if (!ms) return '系統預設';
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="liquid-glass-strong sticky top-0 z-40 px-3 sm:px-6 lg:px-10">
        <div className="max-w-[960px] mx-auto flex items-center gap-2 sm:gap-4 h-16">
          <button
            onClick={() => router.push('/')}
            className="liquid-glass-thin rounded-full px-3 py-1.5 text-[13px] font-display font-medium text-secondary hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.5 9L4 6L7.5 3" />
            </svg>
            回首頁
          </button>
          <span className="font-display font-bold text-[16px] sm:text-[18px] tracking-tight text-primary">白名單管理</span>
          <div className="flex-1" />
          <button
            onClick={logout}
            className="liquid-glass-thin rounded-full px-3 py-1.5 text-[12px] font-display text-tertiary hover:text-primary transition-colors"
          >
            登出
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-[720px] mx-auto w-full px-3 sm:px-6 py-6 space-y-5">

        {/* B5: Tab nav */}
        <div className="liquid-glass-thin rounded-full p-1 flex gap-1 w-full sm:w-fit">
          {([
            { id: 'whitelist' as AdminTab, label: '白名單', count: list.length },
            { id: 'blocklist' as AdminTab, label: '封鎖 IP', count: blocked.length },
            { id: 'totp'      as AdminTab, label: '備援登入', count: totpConfigured ? 1 : 0 },
            { id: 'pack'      as AdminTab, label: '壓縮密碼', count: packPwUpdated ? 1 : 0 },
          ]).map((t) => {
            const active = adminTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setAdminTab(t.id)}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-full text-[13px] font-display transition-all flex items-center justify-center gap-2 ${
                  active ? 'text-white font-bold' : 'text-tertiary hover:text-secondary font-semibold'
                }`}
                style={active ? {
                  background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue))',
                  boxShadow:  '0 4px 12px rgba(10,132,255,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
                } : undefined}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-white/[0.06]'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 白名單分頁 */}
        {adminTab === 'whitelist' && (<>
        {/* Stat */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-0.5 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, var(--tech-blue-300), var(--ios-cyan))' }} />
            <span className="text-[11px] font-display font-semibold text-tertiary tracking-wider uppercase">已授權 Email</span>
          </div>
          <span className="text-[12px] font-mono text-tertiary">{list.length} 筆 / 上限 100</span>
        </div>

        {/* Add form */}
        <div className="liquid-glass-strong liquid-lensing rounded-ios-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[13px] font-display font-semibold text-secondary">新增授權 Email</span>
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => { setNew(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !adding) addEmail(); }}
              placeholder="user@example.com"
              disabled={adding}
              className="flex-1 liquid-glass-thin rounded-ios-md py-2.5 px-3.5 text-[14px] font-display text-primary outline-none placeholder:text-quaternary disabled:opacity-50"
            />
            <button
              onClick={addEmail}
              disabled={adding || !newEmail.trim()}
              className="px-5 rounded-ios-md font-display font-semibold text-[14px] text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))',
                boxShadow: '0 4px 14px rgba(10,132,255,0.40)',
                opacity: (adding || !newEmail.trim()) ? 0.45 : 1,
                cursor:  (adding || !newEmail.trim()) ? 'not-allowed' : 'pointer',
              }}
            >
              {adding ? '新增中…' : '新增'}
            </button>
          </div>
          {error && <p className="text-[12px] mt-3 font-display" style={{ color: 'var(--ios-red)' }}>{error}</p>}
        </div>

        {/* List */}
        {loading ? (
          <div className="liquid-glass liquid-lensing rounded-ios-xl p-8 text-center text-tertiary text-[13px] font-display">載入中…</div>
        ) : list.length === 0 ? (
          <div className="liquid-glass liquid-lensing rounded-ios-xl p-8 text-center text-tertiary text-[13px] font-display">尚無資料</div>
        ) : (
          <div className="space-y-2.5">
            {list.map((e) => (
              <div key={e.email} className="liquid-glass liquid-lensing rounded-ios-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-ios-md flex items-center justify-center flex-shrink-0"
                  style={{
                    background: e.isAdmin
                      ? 'linear-gradient(135deg, var(--ios-orange), var(--ios-yellow))'
                      : 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-cyan))',
                    boxShadow: e.isAdmin
                      ? '0 4px 12px rgba(255,159,10,0.35)'
                      : '0 4px 12px rgba(10,132,255,0.30)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 4h12v8H2z" />
                    <path d="M2 4l6 5 6-5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-display font-medium text-primary break-all">{e.email}</span>
                    {e.isAdmin && (
                      <span className="liquid-tint-orange rounded-full px-2 py-0.5 text-[10px] font-display font-semibold flex-shrink-0">系統管理員</span>
                    )}
                  </div>
                  <div className="text-[11px] text-tertiary font-display mt-0.5">
                    {e.isAdmin ? '建立者預設 · 不可刪除' : `加入：${fmtDate(e.addedAt)}`}
                  </div>
                </div>
                {!e.isAdmin && (
                  <button
                    onClick={() => setConfirmDel(e.email)}
                    className="liquid-glass-thin liquid-tint-red rounded-ios-md px-3 py-2 text-[12px] font-display font-semibold flex-shrink-0 hover:opacity-80 transition-opacity"
                    title="刪除"
                  >
                    刪除
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        </>)}

        {/* 封鎖 IP 分頁 */}
        {adminTab === 'blocklist' && (<>
        {/* Blocklist 標題 */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-0.5 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, var(--ios-red), var(--ios-orange))' }} />
            <span className="text-[11px] font-display font-semibold text-tertiary tracking-wider uppercase">已封鎖 IP</span>
          </div>
          <span className="text-[12px] font-mono text-tertiary">{blocked.length} 筆</span>
        </div>

        {/* Blocklist 列表 */}
        {blocked.length === 0 ? (
          <div className="liquid-glass liquid-lensing rounded-ios-xl p-6 text-center text-tertiary text-[13px] font-display">
            目前無封鎖紀錄
          </div>
        ) : (
          <div className="space-y-2.5">
            {blocked.map((b) => (
              <div key={b.ip} className="liquid-glass liquid-lensing rounded-ios-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-ios-md flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--ios-red), var(--ios-orange))',
                    boxShadow:  '0 4px 12px rgba(255,69,58,0.30)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M3.5 3.5l9 9" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-mono font-medium text-primary break-all">{b.ip}</div>
                  <div className="text-[11px] text-tertiary font-display mt-0.5">
                    {fmtDate(b.blockedAt)} · {b.reason}
                  </div>
                </div>
                <button
                  onClick={() => setConfirmUnblock(b.ip)}
                  className="liquid-glass-thin liquid-tint-green rounded-ios-md px-3 py-2 text-[12px] font-display font-semibold flex-shrink-0 hover:opacity-80 transition-opacity"
                >
                  解除封鎖
                </button>
              </div>
            ))}
          </div>
        )}
        </>)}

        {/* TOTP 分頁 */}
        {adminTab === 'totp' && (<>
        {/* TOTP 備援登入 */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-0.5 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #8b5cf6, #6366f1)' }} />
            <span className="text-[11px] font-display font-semibold text-tertiary tracking-wider uppercase">備援登入（TOTP）</span>
          </div>
          <span className="text-[12px] font-mono text-tertiary">
            {totpConfigured === null ? '…' : totpConfigured ? '已設定' : '未設定'}
          </span>
        </div>

        <div className="liquid-glass liquid-lensing rounded-ios-xl p-5 space-y-4">
          {totpConfigured === false && !totpSetup && (
            <div className="space-y-3">
              <p className="text-[13px] text-secondary font-display">
                收不到驗證信時，可用 Google Authenticator 等 App 產生備援驗證碼。
              </p>
              <button
                onClick={startTotpSetup}
                disabled={totpLoading}
                className="px-5 py-2.5 rounded-ios-md font-display font-semibold text-[13px] text-white"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', opacity: totpLoading ? 0.5 : 1, cursor: totpLoading ? 'not-allowed' : 'pointer' }}
              >
                {totpLoading ? '產生中…' : '開始設定'}
              </button>
            </div>
          )}

          {totpSetup && (
            <div className="space-y-4">
              <p className="text-[13px] text-secondary font-display font-semibold">步驟 1 — 用 Authenticator App 掃描 QR Code</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={totpSetup.qrCode} alt="TOTP QR Code" className="w-44 h-44 rounded-ios-md mx-auto bg-white p-2" />
              <p className="text-[10px] text-quaternary font-mono text-center break-all px-2">{totpSetup.secret}</p>
              <p className="text-[13px] text-secondary font-display font-semibold">步驟 2 — 輸入 App 顯示的 6 位數確認</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpVerifyCode}
                  onChange={(e) => { setTotpVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setTotpError(''); }}
                  placeholder="000000"
                  className="flex-1 liquid-glass-thin rounded-ios-md py-2.5 px-3 text-center text-[20px] font-mono tracking-widest text-primary outline-none"
                />
                <button
                  onClick={confirmTotpSetup}
                  disabled={totpLoading || totpVerifyCode.length < 6}
                  className="px-5 rounded-ios-md font-display font-semibold text-[13px] text-white"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', opacity: (totpLoading || totpVerifyCode.length < 6) ? 0.45 : 1, cursor: (totpLoading || totpVerifyCode.length < 6) ? 'not-allowed' : 'pointer' }}
                >
                  {totpLoading ? '確認中…' : '確認設定'}
                </button>
              </div>
            </div>
          )}

          {totpConfigured && !totpSetup && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-display text-secondary">✓ TOTP 備援登入已啟用</p>
                <p className="text-[11px] font-display text-tertiary mt-0.5">登入頁下方可切換使用 Authenticator App 驗證</p>
              </div>
              <button
                onClick={disableTotp}
                disabled={totpLoading}
                className="liquid-glass-thin liquid-tint-red rounded-ios-md px-3 py-2 text-[12px] font-display font-semibold hover:opacity-80 transition-opacity"
                style={{ color: 'var(--ios-red)' }}
              >
                停用
              </button>
            </div>
          )}

          {totpError && <p className="text-[12px] font-display" style={{ color: 'var(--ios-red)' }}>{totpError}</p>}
        </div>
        </>)}

        {/* 壓縮密碼分頁 */}
        {adminTab === 'pack' && (<>
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-0.5 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, var(--ios-cyan), var(--tech-blue-500))' }} />
              <span className="text-[11px] font-display font-semibold text-tertiary tracking-wider uppercase">7z 打包壓縮密碼</span>
            </div>
            <span className="text-[12px] font-mono text-tertiary">
              {packPwUpdated ? new Date(packPwUpdated).toLocaleString('zh-TW') : '未設定'}
            </span>
          </div>

          <div className="liquid-glass liquid-lensing rounded-ios-xl p-5 space-y-3">
            <p className="text-[13px] text-secondary font-display">
              所有登入使用者選擇「打包下載壓縮檔（.7z）」時，會使用此密碼加密檔名與內容。
            </p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={packPwShow ? 'text' : 'password'}
                  value={packPw}
                  onChange={(e) => { setPackPw(e.target.value); setPackPwError(''); }}
                  placeholder="輸入壓縮密碼"
                  className="w-full liquid-glass-thin rounded-ios-md py-2.5 px-3 pr-10 text-[14px] font-mono text-primary outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPackPwShow(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary text-[11px] px-2"
                >
                  {packPwShow ? '隱藏' : '顯示'}
                </button>
              </div>
              <button
                onClick={savePackPw}
                disabled={packPwSaving || packPw.length < 1}
                className="px-5 rounded-ios-md font-display font-semibold text-[13px] text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--ios-cyan), var(--tech-blue-500))',
                  opacity: (packPwSaving || packPw.length < 1) ? 0.45 : 1,
                  cursor:  (packPwSaving || packPw.length < 1) ? 'not-allowed' : 'pointer',
                }}
              >
                {packPwSaving ? '儲存中…' : '儲存'}
              </button>
            </div>
            <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-display text-secondary">壓縮率（0=不壓縮，9=極致壓縮）</span>
                <span className="text-[13px] font-mono font-semibold text-primary">{packLvl}</span>
              </div>
              <input
                type="range"
                min={0}
                max={9}
                step={1}
                value={packLvl}
                onChange={(e) => setPackLvl(Number(e.target.value))}
                className="w-full accent-tech-blue-500"
              />
              <p className="text-[11px] font-display text-quaternary">
                {packLvl === 0 ? '不壓縮（最快）' : packLvl <= 3 ? '快速（壓縮率低）' : packLvl <= 6 ? '標準' : packLvl === 9 ? '極致（速度最慢、檔案最小）' : '高'}
              </p>
            </div>
            {packPwError && <p className="text-[12px] font-display" style={{ color: 'var(--ios-red)' }}>{packPwError}</p>}
            {packPwOk    && <p className="text-[12px] font-display" style={{ color: 'var(--ios-green)' }}>{packPwOk}</p>}
          </div>
        </>)}

      </div>

      {/* Confirm modal */}
      {confirmDel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmDel(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="liquid-glass-strong liquid-lensing rounded-ios-xl p-6 max-w-sm w-full space-y-4 animate-ios-pop"
          >
            <h3 className="font-display font-bold text-[17px] text-primary">確認刪除？</h3>
            <p className="text-[13px] text-secondary font-display break-all">
              此 Email 將失去登入權限：<br />
              <span className="font-mono text-primary">{confirmDel}</span>
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmDel(null)}
                className="flex-1 liquid-glass-thin rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-secondary"
              >
                取消
              </button>
              <button
                onClick={() => delEmail(confirmDel)}
                className="flex-1 liquid-tint-red rounded-ios-md py-2.5 text-[13px] font-display font-semibold"
                style={{ color: 'var(--ios-red)' }}
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock modal */}
      {confirmUnblock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmUnblock(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="liquid-glass-strong liquid-lensing rounded-ios-xl p-6 max-w-sm w-full space-y-4 animate-ios-pop"
          >
            <h3 className="font-display font-bold text-[17px] text-primary">確認解除封鎖？</h3>
            <p className="text-[13px] text-secondary font-display break-all">
              此 IP 將恢復寄送驗證碼權限：<br />
              <span className="font-mono text-primary">{confirmUnblock}</span>
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmUnblock(null)}
                className="flex-1 liquid-glass-thin rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-secondary"
              >
                取消
              </button>
              <button
                onClick={() => unblock(confirmUnblock)}
                className="flex-1 liquid-tint-green rounded-ios-md py-2.5 text-[13px] font-display font-semibold"
                style={{ color: 'var(--ios-green)' }}
              >
                確認解除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
