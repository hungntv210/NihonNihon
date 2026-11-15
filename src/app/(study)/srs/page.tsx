import {RouteHeading} from '../../../components/route-heading.tsx';
import { getSession } from "./data.ts";
import { ReviewSession } from "./review-session.tsx";
export default async function SrsPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
 const mode = (await searchParams).mode === "quick" ? "quick" : "full";
 return <><RouteHeading title={mode==="quick"?"Ôn nhanh":"Ôn tập"} eyebrow="GẶP LẠI ĐỂ NHỚ LÂU" species="tanuki"><p>Đi từng thẻ, giữ từng điều đã học. Bạn có thể dừng bất cứ lúc nào.</p></RouteHeading><ReviewSession initial={await getSession(mode)} /></>;
}
