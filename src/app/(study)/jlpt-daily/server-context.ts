import 'server-only';
import { getStudyPreferences } from '../../../server/preferences.ts';import { withContentDatabase } from '../../../server/dal.ts';import { readProgress } from '../today-roadmap/repository.ts';import { localClock,weekStart } from '../today-roadmap/model.ts';import { learnedCatalog,learnerLevel } from './catalog.ts';
export async function dailyContext(now=new Date()){
 const preferences=await getStudyPreferences(),progress=readProgress(),clock=localClock(now,preferences.timeZone),level=learnerLevel(preferences,progress,now),catalog=await withContentDatabase(learnedCatalog);
 return {date:clock.date,week:weekStart(clock.date),level,catalog,evening:clock.time>=preferences.eveningTime,shadow:preferences.shadowingDays.includes(new Date(clock.date+'T00:00:00Z').getUTCDay())};
}
