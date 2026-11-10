import {ShadowingLibrary} from './library.tsx';import {listShadowingClips} from './clips.ts';import {requireSession} from '../../../server/auth.ts';
export default async function ShadowingPage() {
  await requireSession();return <><div className="page-heading"><p className="eyebrow">NGHE · DỪNG · NÓI THEO</p><h1>Shadowing</h1><p>Một câu mỗi lần, theo nhịp của bạn.</p></div><ShadowingLibrary clips={listShadowingClips()} /></>;
}
