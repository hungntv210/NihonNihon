'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
const links = [
  ['/today-roadmap', 'Hôm nay', 'home'],
  ['/srs', 'Ôn tập', 'review'],
  ['/vocab', 'Từ vựng', 'vocab'],
  ['/kanji', 'Kanji', 'kanji'],
  ['/grammar', 'Ngữ pháp', 'grammar'],
  ['/shadowing', 'Shadowing', 'sound'],
  ['/jlpt-daily', 'JLPT mỗi tối', 'jlpt'],
  ['/today-roadmap#roadmap-title', 'Lộ trình', 'map'],
] as const;
export function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: 'M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7',
    review: 'M4 8a8 8 0 1 1-1 8M4 3v5h5M12 8v5l3 2',
    vocab: 'M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4V4ZM12 6v15',
    kanji: 'M4 7h16M12 3v18M6 12l12 9M18 12 6 21',
    grammar: 'M4 5h16M4 12h11M4 19h16M19 10v5',
    sound: 'M4 9v6M8 5v14M12 2v20M16 6v12M20 9v6',
    jlpt: 'M8 3h8v4H8zM6 5H4v17h16V5h-2M8 14l3 3 5-7',
    map: 'M3 5l6-3 6 3 6-3v17l-6 3-6-3-6 3V5M9 2v17M15 5v17',
    all: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
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
const tools = [['/common-tools/search','Tra cứu'],['/common-tools/progress','Tiến độ'],['/common-tools/reports','Báo sai'],['/settings','Cài đặt'],['/sources','Nguồn dữ liệu']] as const;
export function MobileNavigation() {
  const dialog = useRef<HTMLDialogElement>(null), current = usePathname();
  return <><nav className="mobile-navigation" aria-label="Điều hướng điện thoại">
    {[links[0],links[1],links[5],links[7]].map(([href,label,icon])=><Link key={href} href={href} aria-current={current===href?'page':undefined}><NavIcon name={icon}/><span>{label}</span></Link>)}
    <button type="button" onClick={()=>dialog.current?.showModal()} aria-haspopup="dialog"><NavIcon name="all"/><span>Tất cả</span></button>
  </nav><dialog ref={dialog} className="all-navigation" aria-label="Tất cả góc học"><header><h2>Tất cả góc học</h2><button type="button" className="button" onClick={()=>dialog.current?.close()}>Đóng</button></header><nav>{[...links,...tools].map(([href,label])=><Link key={href} href={href} onClick={()=>dialog.current?.close()}>{label}</Link>)}</nav></dialog></>;
}
export function Navigation() {
  const current = usePathname() ?? '';
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

