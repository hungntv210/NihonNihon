'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Chưa thể mở góc học tập.</h1>
      <p>Hãy thử lại sau ít phút. Nếu đây là lần đầu chạy, kiểm tra dữ liệu trên máy chủ.</p>
      <button type="button" className="button button-primary" onClick={reset}>
        Thử lại
      </button>
    </main>
  );
}
