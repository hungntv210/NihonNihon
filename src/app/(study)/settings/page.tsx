import {RouteHeading} from '../../../components/route-heading.tsx';
import { getStudyPreferences } from '../../../server/preferences.ts';
import { SettingsForm } from './settings-form.tsx';
export default async function SettingsPage() { return <><RouteHeading title="Cài đặt" eyebrow="GÓC HỌC CỦA BẠN" species="shiba"><p>Nhịp học phù hợp với mỗi ngày.</p></RouteHeading><SettingsForm initial={await getStudyPreferences()} /></>; }
