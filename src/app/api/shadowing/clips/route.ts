import { isSignedIn } from '../../../../server/auth.ts';
import { sameOrigin } from '../../../../server/http.ts';
import { databasePath } from '../../../../core/config.ts';
import { tokenizeClipSegments } from '../../../(study)/common-tools/tokenize.ts';
import { buildClipMetaMap } from '../../../(study)/shadowing/clip-meta-server.ts';
import {
  detectLocalWhisper,
  shadowingCustomClipsPath,
  shadowingMediaDir,
} from '../../../(study)/shadowing/clip-maker-store.ts';
import {
  handleShadowingClipsDelete,
  handleShadowingClipsGet,
  handleShadowingClipsPost,
  type ShadowingClipsHandlerDeps,
} from './handler.ts';

function makeDeps(): ShadowingClipsHandlerDeps {
  const dbFile = databasePath();
  return {
    isAuthenticated: isSignedIn,
    sameOriginCheck: sameOrigin,
    dbFile,
    storePath: shadowingCustomClipsPath(dbFile),
    mediaDir: shadowingMediaDir(dbFile),
    whisperAvailable: detectLocalWhisper(),
    enrichClip: async (clip) => {
      const tokenized = {
        ...clip,
        segments: await tokenizeClipSegments(clip.segments),
      };
      const meta = buildClipMetaMap([tokenized], dbFile)[tokenized.id];
      return { clip: tokenized, meta };
    },
  };
}

export async function GET(request: Request): Promise<Response> {
  return handleShadowingClipsGet(request, makeDeps());
}

export async function POST(request: Request): Promise<Response> {
  return handleShadowingClipsPost(request, makeDeps());
}

export async function DELETE(request: Request): Promise<Response> {
  return handleShadowingClipsDelete(request, makeDeps());
}
