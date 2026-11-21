import { isSignedIn } from '../../../../server/auth.ts';
import { sameOrigin } from '../../../../server/http.ts';
import { listShadowingClips } from '../../../(study)/shadowing/clips.ts';
import {
  shadowingHistoryPath,
  shadowingRecordingsDir,
} from '../../../(study)/shadowing/history-store.ts';
import { getTodaySettings } from '../../../(study)/today-roadmap/server.ts';
import {
  handleShadowingHistoryDelete,
  handleShadowingHistoryGet,
  handleShadowingHistoryPost,
  type ShadowingHistoryHandlerDeps,
} from './handler.ts';

async function makeDeps(): Promise<ShadowingHistoryHandlerDeps> {
  let timeZone = 'Asia/Ho_Chi_Minh';
  try {
    timeZone = (await getTodaySettings()).timeZone;
  } catch {
    // Keep default Vietnam time zone when settings are unavailable
  }
  return {
    isAuthenticated: isSignedIn,
    sameOriginCheck: sameOrigin,
    clips: () => listShadowingClips(),
    historyPath: shadowingHistoryPath(),
    recordingsDir: shadowingRecordingsDir(),
    timeZone,
  };
}

export async function GET(request: Request): Promise<Response> {
  return handleShadowingHistoryGet(request, await makeDeps());
}

export async function POST(request: Request): Promise<Response> {
  return handleShadowingHistoryPost(request, await makeDeps());
}

export async function DELETE(request: Request): Promise<Response> {
  return handleShadowingHistoryDelete(request, await makeDeps());
}
