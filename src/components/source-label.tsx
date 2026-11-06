import type { Translation } from '../core/content.ts';
import { ViText } from './text.tsx';
export function SourceLabel({
  translation,
  fallback = 'OpenJLPT',
}: {
  translation: Translation | null;
  fallback?: string;
}) {
  if (!translation) return <ViText className="source-label">{`Bản Anh · ${fallback}`}</ViText>;
  const labels: Record<string, string> = {
    machine: 'Dịch máy',
    dictionary: 'Từ điển',
    han_viet: 'Hán Việt',
    tatoeba: 'Bản dịch cộng đồng',
  };
  const kind = translation.autoSelected ? 'Tự chọn' : (labels[translation.method] ?? 'Bản dịch');
  return (
    <ViText
      className="source-label"
      title={`${translation.sourceId} · ${translation.releaseId}${translation.promptVersion ? ' · ' + translation.promptVersion : ''}`}
    >{`${kind} · ${translation.sourceName}${translation.model ? ' · ' + translation.model : ''}`}</ViText>
  );
}
