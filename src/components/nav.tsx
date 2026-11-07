'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const links = [
  ['/today-roadmap', 'Hôm nay', 'home'],
  ['/srs', 'Ôn tập', 'review'],
  ['/vocab', 'Từ vựng', 'vocab'],
  ['/kanji', 'Kanji', 'kanji'],
  ['/grammar', 'Ngữ pháp', 'grammar'],
] as const;
export function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: 'M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7',
    review: 'M4 8a8 8 0 1 1-1 8M4 3v5h5M12 8v5l3 2',
    vocab: 'M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4V4ZM12 6v15',
    kanji: 'M4 7h16M12 3v18M6 12l12 9M18 12 6 21',
    grammar: 'M4 5h16M4 12h11M4 19h16M19 10v5',
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.home} />
    </svg>
  );
}
export function Navigation() {
  const current = usePathname();
  return (
    <nav className="navigation" aria-label="Học tập">
      {links.map(([href, label, icon]) => (
        <Link
          href={href}
          key={href}
          className="nav-link"
          aria-current={
            current === href || current.startsWith(href + '/')
              ? 'page'
              : undefined
          }
        >
          <NavIcon name={icon} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

