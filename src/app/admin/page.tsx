'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Entry {
  email:   string;
  addedAt: number;
  isAdmin: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [list, setList]       = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [newEmail, setNew]    = useState('');
  const [error, setError]     = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/whitelist');
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || '讀取失敗'); return; }
      setList(j.list || []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

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
    </div>
  );
}
