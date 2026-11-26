import { getRoadmapToday } from './server.ts';
import { Today } from './today.tsx';
import {PixelScene} from '../../../components/pixel-scenes/pixel-scene.tsx';
import { todayPlan } from './model.ts';
export default async function TodayRoadmapPage() {
 const data=await getRoadmapToday(),plan=todayPlan(data.progress,data.settings,new Date(data.now),data.data.due);
 return <><PixelScene id="roadmap-journey" params={{week:plan.week}}/><Today {...data} /></>;
}
