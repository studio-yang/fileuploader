'use client';

import { StorageProvider } from '@/lib/types';

interface Props {
  selected: StorageProvider;
  onChange: (p: StorageProvider) => void;
}

const ENABLED = {
  gcs:    false,
  gdrive: true,
  github: true,
};

const ALL_PROVIDERS = [
  {
    id:        'gdrive' as StorageProvider,
    label:     'Google Drive',
    sublabel:  'Google One Storage',
    icon:      '☁',
    tintClass: 'liquid-tint-blue',
    iosColor:  'var(--tech-blue-300)',
    iosColor2: 'var(--ios-cyan)',
    desc:      '瀏覽器直傳，支援超大檔案',
    limit:     '依雲端硬碟容量',
  },
  {
    id:        'github' as StorageProvider,
    label:     'GitHub',
    sublabel:  'Release Assets',
    icon:      '◐',
    tintClass: 'liquid-tint-indigo',
    iosColor:  'var(--ios-indigo)',
    iosColor2: 'var(--ios-purple)',
    desc:      '版本管理整合，適合小檔案',
    limit:     '2 GB / asset',
  },
  {
    id:        'gcs' as StorageProvider,
    label:     'Cloud Storage',
    sublabel:  'Google Cloud',
    icon:      '◇',
    tintClass: 'liquid-tint-cyan',
    iosColor:  'var(--ios-cyan)',
    iosColor2: 'var(--tech-blue-300)',
    desc:      'Presigned URL 直傳，最高 5 TB',
    limit:     '5 TB',
  },
];

const PROVIDERS = ALL_PROVIDERS.filter((p) => ENABLED[p.id as keyof typeof ENABLED]);

export default function ProviderSelector({ selected, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2.5">
      {PROVIDERS.map((p, idx) => {
        const active = selected === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            style={{ animationDelay: `${idx * 80}ms` }}
            className={`
              relative overflow-hidden rounded-ios-md p-4 text-left
              animate-ios-pop liquid-hover liquid-lensing
              ${active ? 'liquid-glass-strong' : 'liquid-glass'}
            `}
          >
            {active && (
              <div
                className="absolute inset-0 opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(ellipse at 30% 20%, ${p.iosColor}30, transparent 70%)`,
                }}
              />
            )}

            {active && (
              <div
                className="absolute top-4 right-4 z-10 w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${p.iosColor}, ${p.iosColor2})`,
                  boxShadow:  `0 4px 12px ${p.iosColor}50`,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}

            <div className="relative z-10">
              <div
                className={`w-10 h-10 rounded-ios-sm flex items-center justify-center text-xl mb-3 transition-all duration-500 ${p.tintClass}`}
                style={{
                  border:    `0.5px solid ${active ? p.iosColor + '60' : 'rgba(255,255,255,0.10)'}`,
                  boxShadow: active
                    ? `0 8px 20px ${p.iosColor}30, inset 0 1px 0 rgba(255,255,255,0.20)`
                    : 'inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                {p.icon}
              </div>

              <div className="text-[11px] font-display font-medium text-tertiary mb-1 tracking-tight">
                {p.sublabel}
              </div>
              <div
                className="text-[15px] font-display font-semibold mb-1.5 tracking-tight"
                style={{ color: active ? p.iosColor : 'var(--text-primary)' }}
              >
                {p.label}
              </div>

              <p className="text-[12px] text-secondary leading-snug mb-2.5">
                {p.desc}
              </p>

              <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <span className="text-[11px] font-display font-medium text-quaternary">容量</span>
                <span
                  className="text-[12px] font-mono font-medium"
                  style={{ color: active ? p.iosColor : 'var(--text-tertiary)' }}
                >
                  {p.limit}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
