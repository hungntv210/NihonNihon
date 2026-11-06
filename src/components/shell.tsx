import Link from 'next/link';
import type { ReactNode } from 'react';
import { Navigation } from './nav.tsx';
export function Shell({ children, reviewCount }: { children: ReactNode; reviewCount: number }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Đến nội dung chính
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Nihon Nihon — Hôm nay">
          <span className="brand-mark" lang="ja">
            日
          </span>
          <span>
            Nihon Nihon<small>Mỗi ngày một bước</small>
          </span>
        </Link>
        <p className="nav-caption">GÓC HỌC CỦA BẠN</p>
        <Navigation />
        <div className="sidebar-note">
          <span className="status-dot" />
          Không gian học riêng tư<small>Đi chậm, nhưng đều đặn.</small>
        </div>
        <div className="sidebar-footer">
          <Link href="/sources">Nguồn dữ liệu ↗</Link>
          <form action="/api/logout" method="post">
            <button className="quiet-button">Đăng xuất</button>
          </form>
        </div>
      </aside>
      <div className="main-sheet">
        <header className="topbar">
          <span className="topbar-label">TIẾNG NHẬT · N5 → N2</span>
          <div className="topbar-links">
            <Link href="/sources" className="mobile-source">
              Nguồn dữ liệu
            </Link>
            <Link href="/srs" className="review-pill">
              <span className="status-dot" />
              {reviewCount} thẻ trong hàng ôn
            </Link>
            <form action="/api/logout" method="post" className="mobile-logout">
              <button className="quiet-button">Đăng xuất</button>
            </form>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="page-footer">
          Học để hiểu, ôn để nhớ.<span>Nihon Nihon</span>
        </footer>
      </div>
    </div>
  );
}
