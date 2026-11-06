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
  return (
    <main className="login-page">
      <div className="login-aside">
        <span className="brand-mark large" lang="ja">
          日
        </span>
        <p className="eyebrow">NIHON NIHON</p>
        <h1>
          Một khoảng nhỏ,
          <br />
          dành cho tiếng Nhật.
        </h1>
        <p>
          Quay lại với những điều đã học.
          <br />
          Mở thêm một điều mới, mỗi ngày.
        </p>
        <span className="login-aside-footer">Không gian học của riêng bạn.</span>
      </div>
      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">MỪNG BẠN TRỞ LẠI</p>
        <h2 id="login-title">Cùng học tiếp nhé.</h2>
        <p className="muted">Đăng nhập để mở sổ học của bạn.</p>
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
          <p role="status" className="login-message">
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
        <p className="login-note">
          <span className="status-dot" />
          Nội dung chỉ hiển thị sau khi đăng nhập.
        </p>
      </section>
    </main>
  );
}
