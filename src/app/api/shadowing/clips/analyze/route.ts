import { isSignedIn } from '../../../../../server/auth.ts';
import { sameOrigin } from '../../../../../server/http.ts';
import { databasePath } from '../../../../../core/config.ts';
import { readTodaySettings } from '../../../../(study)/today-roadmap/settings.ts';
import { handleShadowingClipsAnalyzePost } from './handler.ts';

export async function POST(request: Request): Promise<Response> {
  return handleShadowingClipsAnalyzePost(request, {
    isAuthenticated: isSignedIn,
    sameOriginCheck: sameOrigin,
    dbFile: databasePath(),
    startDate: readTodaySettings().startDate,
  });
}
