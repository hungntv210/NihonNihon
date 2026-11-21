import { databasePath } from '../../../../core/config.ts';
import { isSignedIn } from '../../../../server/auth.ts';
import { boundedBody, sameOrigin } from '../../../../server/http.ts';
import { handleLookupGet, handleLookupPost } from '../../../(study)/common-tools/lookup-handler.ts';
import { lookupContextPath } from '../../../(study)/common-tools/lookup-store.ts';

function routeDeps() {
  return {
    isAuthenticated: isSignedIn,
    sameOriginCheck: sameOrigin,
    readBody: boundedBody,
    dbPath: databasePath(),
    contextPath: lookupContextPath(),
  };
}

export async function GET(request: Request) {
  return handleLookupGet(request, routeDeps());
}

export async function POST(request: Request) {
  return handleLookupPost(request, routeDeps());
}
