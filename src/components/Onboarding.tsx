'use client';

import { useEffect, useState } from 'react';
import { X, Upload, Download, Shield } from 'lucide-react';

const STORAGE_KEY = 'chb-onboarding-seen';

interface Props {
  isAdmin: boolean;
}

export function Onboarding({ isAdmin }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEY)) {
      // 延遲 800ms 讓畫面先載入
      const t = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="liquid-glass-strong liquid-lensing rounded-ios-xl p-7 max-w-md w-full space-y-5 animate-ios-pop"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display font-bold text-[20px] text-primary">歡迎使用 CHB 檔案傳輸 👋</h2>
            <p className="text-[13px] text-tertiary font-display mt-1">3 件事讓你快速上手</p>
          </div>
          <button onClick={close} className="text-quaternary hover:text-secondary transition-colors">
            <X size={18}/>
          </button>
        </div>

        <div className="space-y-3">
          <Step icon={<Upload size={18}/>} title="上傳檔案" desc="拖拉或點選檔案，自動分塊上傳到 Google Drive / GitHub / GCS。" tint="liquid-tint-blue"/>
          <Step icon={<Download size={18}/>} title="下載中心" desc="所有已上傳檔案集中管理，可一鍵複製公開下載連結。" tint="liquid-tint-green"/>
          {isAdmin
            ? <Step icon={<Shield size={18}/>} title="管理員權限" desc="你有刪除權限。勾選多個檔案 → 移到垃圾桶，可隨時從垃圾桶還原。" tint="liquid-tint-orange"/>
            : <Step icon={<Shield size={18}/>} title="安全機制" desc="全站 HTTPS、Email OTP 登入、IP 自動封鎖機制保護你的資料。" tint="liquid-tint-orange"/>}
        </div>

        <button
          onClick={close}
          className="w-full py-3 rounded-ios-md font-display font-semibold text-[14px] text-white transition-all hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))',
            boxShadow:  '0 6px 20px rgba(10,132,255,0.40)',
          }}
        >
          開始使用
        </button>
      </div>
    </div>
  );
}

function Step({ icon, title, desc, tint }: { icon: React.ReactNode; title: string; desc: string; tint: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`liquid-glass-thin ${tint} w-10 h-10 rounded-ios-md flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-display font-semibold text-primary">{title}</p>
        <p className="text-[12px] text-tertiary font-display leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
