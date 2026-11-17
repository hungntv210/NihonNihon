import {weatherLabels} from '../../components/pixel-scenes/weather.js';
import {PixelCanvas} from '../../components/pixel-scenes/pixel-canvas.tsx';
import {sceneClock} from '../../components/pixel-scenes/model.ts';
import styles from './login.module.css';
import { redirect } from 'next/navigation';
import { isSignedIn } from '../../server/auth.ts';
import { authConfig } from '../../core/config.ts';
export const dynamic = 'force-dynamic';
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  let configured = true;
  try {
    authConfig();
  } catch {
    configured = false;
  }
  if (configured && (await isSignedIn())) redirect('/');
  const { error } = await searchParams;
  const clock=sceneClock();
  return (
    <main className={'login-page '+styles.page}>
      <div className={styles.backdrop} data-scene-time={clock.period} data-scene-date={clock.date}><PixelCanvas id="login-shoji" clock={clock} params={{}}/><time className={styles.clock} dateTime={clock.now}>{clock.time} · <span lang="ja">{weatherLabels[clock.weather]}</span></time></div>
      <section className={styles.card} aria-labelledby="login-title">
        <h1 id="login-title"><span className={styles.title}>Đăng nhập</span></h1>
        <form action="/api/session" method="post">
          <label htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            disabled={!configured}
          />
          <p role="status" className={styles.message}>
            {!configured
              ? 'Ứng dụng chưa sẵn sàng. Hãy hoàn tất cài đặt trên máy chủ.'
              : error
                ? 'Mật khẩu chưa đúng. Bạn thử lại nhé.'
                : '\u00A0'}
          </p>
          <button className="button button-primary" disabled={!configured}>
            Mở góc học tập <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className={styles.note}>
          <span className="status-dot" />
          Nội dung chỉ hiển thị sau khi đăng nhập.
        </p>
      </section>
    </main>
  );
}
