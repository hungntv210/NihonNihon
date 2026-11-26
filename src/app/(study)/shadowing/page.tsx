import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { PixelScene } from '../../../components/pixel-scenes/pixel-scene.tsx';
import { shadowProgress } from '../../../components/pixel-scenes/model.ts';
import { SESSION_COOKIE } from '../../../core/session.ts';
import { practiceSessionKey, loadPractice } from './practice-store.ts';
import { roadmapPath } from '../today-roadmap/repository.ts';
import { getTodaySettings } from '../today-roadmap/server.ts';
import { RouteHeading } from '../../../components/route-heading.tsx';
import { ShadowingLibrary } from './library.tsx';
import { listShadowingClips } from './clips.ts';
import type { Clip } from './clip-model.ts';
import { resolveShadowingSelection, type ShadowingQuery } from './query.ts';
import { requireSession } from '../../../server/auth.ts';
import { tokenizeClipSegments } from '../common-tools/tokenize.ts';
import { readShadowingHistory } from './history-store.ts';
import { summarizeAllClips } from './history-model.ts';
import { buildClipMetaMap } from './clip-meta-server.ts';

const PRACTICE_NOTE = (
  <p>
    Chỉ tính khi tab đang hiện và video tiến hoặc đang ghi âm. Buổi tự ghi cần đủ 4 điều kiện; server lưu thời gian luyện và ID/độ dài bản ghi, không nhận audio tự động. Có thể ghi tay dự phòng ở Hôm nay.
  </p>
);
const RECORD_NOTE =
  'Bản ghi thử nằm trên thiết bị và mất khi đổi clip hoặc rời trang. Bấm “Ghim bản ghi tốt nhất” để lưu riêng câu ưng ý trên máy chủ (có sao lưu, không bị tự dọn). ';

function clipNotice(clip: Clip): ReactNode {
  if (clip.isDemo)
    return (
      <>
        <strong>Bản thử tương tác · không phải tư liệu luyện nói</strong>
        <p>
          Video tổng hợp 9 giây với tiếng bíp. Câu Nhật / Việt tự soạn chỉ để thử phụ đề; không khớp lời nói. Không tính buổi học hoặc tiến độ.
        </p>
      </>
    );
  if (clip.youtubeId)
    return (
      <>
        <strong>
          YouTube · {clip.level} · {clip.topic}
        </strong>
        <p>
          {clip.attribution} · {clip.license}
        </p>
        <p>
          Câu Nhật và mốc từ phụ đề ja manual; tiếng Việt từ phụ đề vi manual. Chỉ nhúng video sau khi bạn bấm, không tải video/audio và không dùng Whisper.
        </p>
      </>
    );
  return (
    <>
      <strong>
        Tư liệu riêng · {clip.level} · {clip.topic}
      </strong>
      <p>{clip.attribution}</p>
      <p>
        Phụ đề từ script chính thức; mốc thời gian chờ tester duyệt. Không gửi video hoặc bản ghi lên dịch vụ AI.
      </p>
    </>
  );
}

export default async function ShadowingPage({
  searchParams,
}: {
  searchParams?: Promise<ShadowingQuery>;
}) {
  await requireSession();
  const query = searchParams ? await searchParams : {};
  const rawClips = listShadowingClips();
  const clips = await Promise.all(
    rawClips.map(async (clip) => ({
      ...clip,
      segments: await tokenizeClipSegments(clip.segments),
    })),
  );
  const initial = resolveShadowingSelection(clips, query);
  const notices = Object.fromEntries(clips.map((c) => [c.id, clipNotice(c)]));
  const settings = await getTodaySettings();
  const key = practiceSessionKey((await cookies()).get(SESSION_COOKIE)!.value);
  const progress = shadowProgress(loadPractice(roadmapPath(), key, clips, new Date(), settings.timeZone));
  const initialHistory = summarizeAllClips(
    readShadowingHistory(),
    clips.map((c) => c.id),
  );
  const clipMetaById = buildClipMetaMap(clips);

  return (
    <>
      <PixelScene id="shadowing-inari" params={{ progress }} />
      <RouteHeading title="Shadowing" eyebrow="NGHE · DỪNG · NÓI THEO" species="bird">
        <p>Một câu mỗi lần, theo nhịp của bạn.</p>
      </RouteHeading>
      <ShadowingLibrary
        clips={clips}
        initialClipId={initial.clipId}
        initialSegment={initial.segmentIndex}
        notices={notices}
        practiceNote={PRACTICE_NOTE}
        recordNote={RECORD_NOTE}
        initialHistory={initialHistory}
        metaByClip={clipMetaById}
        timeZone={settings.timeZone}
      />
    </>
  );
}
