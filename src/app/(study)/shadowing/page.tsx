import {cookies} from 'next/headers';
import {PixelScene} from '../../../components/pixel-scenes/pixel-scene.tsx';
import {shadowProgress} from '../../../components/pixel-scenes/model.ts';
import {SESSION_COOKIE} from '../../../core/session.ts';
import {practiceSessionKey,loadPractice} from './practice-store.ts';
import {roadmapPath} from '../today-roadmap/repository.ts';
import {getTodaySettings} from '../today-roadmap/server.ts';
import {RouteHeading} from '../../../components/route-heading.tsx';
import {ShadowingLibrary} from './library.tsx';import {listShadowingClips} from './clips.ts';import {requireSession} from '../../../server/auth.ts';
export default async function ShadowingPage() {
  await requireSession();const clips=listShadowingClips(),settings=await getTodaySettings(),key=practiceSessionKey((await cookies()).get(SESSION_COOKIE)!.value),progress=shadowProgress(loadPractice(roadmapPath(),key,clips,new Date(),settings.timeZone));return <><PixelScene id="shadowing-inari" params={{progress}}/><RouteHeading title="Shadowing" eyebrow="NGHE · DỪNG · NÓI THEO" species="bird"><p>Một câu mỗi lần, theo nhịp của bạn.</p></RouteHeading><ShadowingLibrary clips={clips} /></>;
}
