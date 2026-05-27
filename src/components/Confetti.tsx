'use client';

import { useEffect, useState } from 'react';

const EMOJIS = ['🎉', '✨', '🎊', '⭐', '💫', '🌟'];

interface Particle {
  id:       number;
  left:     number;
  emoji:    string;
  duration: number;
  delay:    number;
}

/**
 * 觸發 confetti — fire(60) 灑 60 顆粒子
 */
export function useConfetti() {
  const [particles, setParticles] = useState<Particle[]>([]);

  const fire = (count = 40) => {
    const arr: Particle[] = Array.from({ length: count }, (_, i) => ({
      id:       Date.now() + i,
      left:     Math.random() * 100,
      emoji:    EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      duration: 2 + Math.random() * 2,
      delay:    Math.random() * 0.5,
    }));
    setParticles((prev) => [...prev, ...arr]);
    // 清理
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !arr.find((a) => a.id === p.id)));
    }, 5000);
  };

  useEffect(() => () => setParticles([]), []);

  const view = (
    <>
      {particles.map((p) => (
        <span
          key={p.id}
          className="confetti-particle"
          style={{
            left:           `${p.left}vw`,
            animationDuration: `${p.duration}s`,
            animationDelay:    `${p.delay}s`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </>
  );

  return { fire, view };
}
