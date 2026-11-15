import {RouteHeading} from '../../../components/route-heading.tsx';
import {ShadowingLibrary} from './library.tsx';import {listShadowingClips} from './clips.ts';import {requireSession} from '../../../server/auth.ts';
export default async function ShadowingPage() {
  await requireSession();return <><RouteHeading title="Shadowing" eyebrow="NGHE · DỪNG · NÓI THEO" species="bird"><p>Một câu mỗi lần, theo nhịp của bạn.</p></RouteHeading><ShadowingLibrary clips={listShadowingClips()} /></>;
}
