import { getToday } from './server.ts';
import { Today } from './today.tsx';
import {PixelScene} from '../../../components/pixel-scenes/pixel-scene.tsx';
import { todayPlan, allocateRoadmap, plusDays } from './model.ts';
export default async function TodayRoadmapPage() {
 const data=await getToday(),plan=todayPlan(data.progress,data.settings,new Date(data.now),data.data.due);
 const current=allocateRoadmap(data.data.items,plusDays(data.settings.startDate,plan.delayedWeeks*7))[plan.week-1];
 return <><PixelScene id="home-tokyo"/><Today {...data} /></>;
}
