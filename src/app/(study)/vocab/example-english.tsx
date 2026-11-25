export function ExampleEnglish({
  english,
  method,
  originalClassName,
  detailsClassName,
}: {
  english: string | null;
  method: string;
  originalClassName?: string;
  detailsClassName?: string;
}) {
  const text = english?.trim();
  if (!text) return null;
  if (method === 'machine') {
    return (
      <p lang="en" className={originalClassName}>
        {text}
      </p>
    );
  }
  return (
    <details className={detailsClassName}>
      <summary>Xem câu Anh gốc</summary>
      <p lang="en">{text}</p>
    </details>
  );
}
