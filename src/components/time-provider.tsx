'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export function TimeProvider({ period }: { period: string }) {
  const router = useRouter();
  useEffect(() => {
    document.documentElement.dataset.time = period;
    const timer = setInterval(() => { if (!document.hidden) router.refresh(); }, 60000);
    return () => clearInterval(timer);
  }, [period, router]);
  return null;
}
