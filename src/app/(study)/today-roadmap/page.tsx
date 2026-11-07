import { getToday } from './server.ts';
import { Today } from './today.tsx';
export default async function TodayRoadmapPage() { return <Today {...await getToday()} />; }
