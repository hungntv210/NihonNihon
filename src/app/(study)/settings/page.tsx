import { getStudyPreferences } from '../../../server/preferences.ts';
import { SettingsForm } from './settings-form.tsx';
export default async function SettingsPage() { return <><div className="page-heading"><p className="eyebrow">GÓC HỌC CỦA BẠN</p><h1>Cài đặt</h1><p>Nhịp học phù hợp với mỗi ngày.</p></div><SettingsForm initial={await getStudyPreferences()} /></>; }
