import { OfflineManager } from '../../components/offline-manager.tsx';
import { startDailyBackups } from '../../server/maintenance.ts';
import { getStudyPreferences } from '../../server/preferences.ts';
import { PreferencesProvider } from '../../components/preferences-provider.tsx';
import { requireSession } from '../../server/auth.ts';
import { getContentSummary } from '../../server/dal.ts';
import { Shell } from '../../components/shell.tsx';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function StudyLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  startDailyBackups();
  const summary = await getContentSummary();
  return <Shell reviewCount={summary.review}><PreferencesProvider initial={await getStudyPreferences()} /><OfflineManager />{children}</Shell>;
}
