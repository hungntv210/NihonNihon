import { requireSession } from '../../server/auth.ts';
import { getContentSummary } from '../../server/dal.ts';
import { Shell } from '../../components/shell.tsx';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function StudyLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const summary = await getContentSummary();
  return <Shell reviewCount={summary.review}>{children}</Shell>;
}
