import {cookies} from 'next/headers';
import type {ReactNode} from 'react';
import {PixelScene} from '../../../components/pixel-scenes/pixel-scene.tsx';
import {shadowProgress} from '../../../components/pixel-scenes/model.ts';
import {SESSION_COOKIE} from '../../../core/session.ts';
import {practiceSessionKey,loadPractice} from './practice-store.ts';
import {roadmapPath} from '../today-roadmap/repository.ts';
import {getTodaySettings} from '../today-roadmap/server.ts';
import {RouteHeading} from '../../../components/route-heading.tsx';
import {ShadowingLibrary} from './library.tsx';import {listShadowingClips} from './clips.ts';import type {Clip} from './clip-model.ts';import {resolveShadowingSelection,type ShadowingQuery} from './query.ts';import {requireSession} from '../../../server/auth.ts';
import {tokenizeClipSegments} from '../common-tools/tokenize.ts';
const PRACTICE_NOTE = <p>Chỉ tính khi tab đang hiện và video tiến hoặc đang ghi âm. Buổi tự ghi cần đủ 4 điều kiện; server lưu thời gian luyện và ID/độ dài bản ghi, không nhận audio. Có thể ghi tay dự phòng ở Hôm nay.</p>;
const RECORD_NOTE = 'Bản ghi mới thay bản cũ của cùng câu. Không tải lên máy chủ; tải xuống để giữ lại. Đổi clip hoặc rời trang sẽ mất bản ghi. ';
function clipNotice(clip: Clip): ReactNode {
  if (clip.isDemo) return <><strong>Bản thử tương tác · không phải tư liệu luyện nói</strong><p>Video tổng hợp 9 giây với tiếng bíp. Câu Nhật / Việt tự soạn chỉ để thử phụ đề; không khớp lời nói. Không tính buổi học hoặc tiến độ.</p></>;
  if (clip.youtubeId) return <><strong>YouTube · {clip.level} · {clip.topic}</strong><p>{clip.attribution} · {clip.license}</p><p>Câu Nhật và mốc từ phụ đề ja manual; tiếng Việt từ phụ đề vi manual. Chỉ nhúng video sau khi bạn bấm, không tải video/audio và không dùng Whisper.</p></>;
  return <><strong>Tư liệu riêng · {clip.level} · {clip.topic}</strong><p>{clip.attribution}</p><p>Phụ đề từ script chính thức; mốc thời gian chờ tester duyệt. Không gửi video hoặc bản ghi lên dịch vụ AI.</p></>;
}
export default async function ShadowingPage({searchParams}:{searchParams?:Promise<ShadowingQuery>}) {
  await requireSession();const query=searchParams?await searchParams:{},rawClips=listShadowingClips(),clips=await Promise.all(rawClips.map(async clip=>({...clip,segments:await tokenizeClipSegments(clip.segments)}))),initial=resolveShadowingSelection(clips,query),notices=Object.fromEntries(clips.map(c=>[c.id,clipNotice(c)])),settings=await getTodaySettings(),key=practiceSessionKey((await cookies()).get(SESSION_COOKIE)!.value),progress=shadowProgress(loadPractice(roadmapPath(),key,clips,new Date(),settings.timeZone));return <><PixelScene id="shadowing-inari" params={{progress}}/><RouteHeading title="Shadowing" eyebrow="NGHE · DỪNG · NÓI THEO" species="bird"><p>Một câu mỗi lần, theo nhịp của bạn.</p></RouteHeading><ShadowingLibrary clips={clips} initialClipId={initial.clipId} initialSegment={initial.segmentIndex} notices={notices} practiceNote={PRACTICE_NOTE} recordNote={RECORD_NOTE} /></>;
}
