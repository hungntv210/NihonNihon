import { getSession } from "./data.ts";
import { ReviewSession } from "./review-session.tsx";
export default async function SrsPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
 const mode = (await searchParams).mode === "quick" ? "quick" : "full";
 return <><div className="page-heading"><p className="eyebrow">GẶP LẠI ĐỂ NHỚ LÂU</p><h1>Ôn tập</h1><p>Đi từng thẻ, giữ từng điều đã học. Bạn có thể dừng bất cứ lúc nào.</p></div><ReviewSession initial={await getSession(mode)} /></>;
}
