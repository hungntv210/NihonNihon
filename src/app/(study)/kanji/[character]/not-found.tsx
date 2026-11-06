import Link from 'next/link';
export default function MissingKanji() {
  return (
    <section className="empty-state">
      <h1>Chưa có chữ này trong thư viện.</h1>
      <p>Hãy quay lại sổ kanji để chọn một chữ khác.</p>
      <Link className="button button-primary" href="/kanji">
        Mở sổ kanji
      </Link>
    </section>
  );
}
