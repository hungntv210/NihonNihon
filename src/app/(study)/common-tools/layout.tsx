import Link from 'next/link';
import styles from './tools.module.css';
export default function ToolsLayout({children}:{children:React.ReactNode}) {
  return <div className={styles.tools}><nav aria-label="Công cụ chung" className={styles.nav}><Link href="/common-tools">Công cụ</Link><Link href="/common-tools/search">Tra cứu</Link><Link href="/common-tools/reports">Báo sai</Link><Link href="/common-tools/progress">Tiến độ</Link><Link href="/common-tools/settings">Cài đặt</Link></nav>{children}</div>;
}
