import { databasePath } from '../../../../core/config.ts';
import { isSignedIn } from '../../../../server/auth.ts';
import { boundedBody, sameOrigin } from '../../../../server/http.ts';
import { handleReportPost } from '../../../(study)/common-tools/report-handler.ts';

export async function POST(request: Request) {
  return handleReportPost(request, {
    isAuthenticated: isSignedIn,
    sameOriginCheck: sameOrigin,
    readBody: boundedBody,
    dbPath: databasePath(),
  });
}
