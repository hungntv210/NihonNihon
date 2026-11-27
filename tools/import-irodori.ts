import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_IRODORI_DIR,
  formatIrodoriReport,
  importIrodoriDirectory,
  mapIrodoriLevel,
  type IrodoriCefrLevel,
} from '../src/app/(study)/shadowing/irodori-importer.ts';

export type IrodoriCliArgs = {
  dir?: string;
  dryRun: boolean;
  levels?: IrodoriCefrLevel[];
  autoMeta: boolean;
  dbFile?: string;
  storePath?: string;
  mediaDir?: string;
  json: boolean;
  help: boolean;
};

export function usageText(): string {
  return [
    'Công cụ nhập cục bộ tài liệu Japan Foundation IRODORI cho kho Shadowing (100% offline).',
    '',
    'Cách dùng:',
    '  node --import tsx tools/import-irodori.ts [tùy chọn]',
    '',
    'Tùy chọn:',
    `  --dir <thư_mục>        Thư mục IRODORI đã tải sẵn trên máy (hoặc đặt biến NIHON_IRODORI_DIR; mặc định: ${DEFAULT_IRODORI_DIR})`,
    '  --dry-run, -n          Chạy thử không ghi tệp; in số lượng clip theo từng cấp (A1/A2/B1)',
    '  --level <cấp>          Chỉ nhập các cấp chỉ định: A1, A2, B1 (phân tách dấu phẩy hoặc lặp cờ)',
    '  --db <tệp_sqlite>      Đường dẫn SQLite cục bộ (dùng để suy ra vị trí lưu clip và gợi ý tag/lộ trình)',
    '  --store <tệp_json>     Đường dẫn tệp lưu danh sách clip tùy chỉnh',
    '  --media-dir <thư_mục>  Thư mục riêng tư lưu tệp audio đã nhập',
    '  --no-auto-meta         Tắt tự thêm furigana / gợi ý tag / tuần lộ trình',
    '  --json                 In báo cáo dạng JSON',
    '  --help, -h             Hiện hướng dẫn này',
    '',
    'Lưu ý: Công cụ không tải dữ liệu từ Internet và không ghi tệp vào thư mục public/ hay git.',
  ].join('\n');
}

function readNextValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`Thiếu giá trị cho tùy chọn ${flag}.`);
  }
  return value;
}

export function parseIrodoriCliArgs(argv: readonly string[]): IrodoriCliArgs {
  const parsed: IrodoriCliArgs = {
    dryRun: false,
    autoMeta: true,
    json: false,
    help: false,
  };
  const levels = new Set<IrodoriCefrLevel>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--dry-run' || arg === '-n') {
      parsed.dryRun = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--no-auto-meta') {
      parsed.autoMeta = false;
    } else if (arg === '--dir') {
      parsed.dir = readNextValue(argv, i, '--dir');
      i++;
    } else if (arg.startsWith('--dir=')) {
      parsed.dir = arg.slice('--dir='.length);
    } else if (arg === '--db') {
      parsed.dbFile = readNextValue(argv, i, '--db');
      i++;
    } else if (arg.startsWith('--db=')) {
      parsed.dbFile = arg.slice('--db='.length);
    } else if (arg === '--store') {
      parsed.storePath = readNextValue(argv, i, '--store');
      i++;
    } else if (arg.startsWith('--store=')) {
      parsed.storePath = arg.slice('--store='.length);
    } else if (arg === '--media-dir') {
      parsed.mediaDir = readNextValue(argv, i, '--media-dir');
      i++;
    } else if (arg.startsWith('--media-dir=')) {
      parsed.mediaDir = arg.slice('--media-dir='.length);
    } else if (arg === '--level') {
      const raw = readNextValue(argv, i, '--level');
      i++;
      for (const token of raw.split(',')) {
        const spec = mapIrodoriLevel(token);
        if (!spec) {
          throw new Error(`Cấp IRODORI không hợp lệ: "${token.trim()}". Chỉ hỗ trợ A1, A2, A2-1, A2-2, B1.`);
        }
        levels.add(spec.cefr);
      }
    } else if (arg.startsWith('--level=')) {
      const raw = arg.slice('--level='.length);
      for (const token of raw.split(',')) {
        const spec = mapIrodoriLevel(token);
        if (!spec) {
          throw new Error(`Cấp IRODORI không hợp lệ: "${token.trim()}". Chỉ hỗ trợ A1, A2, A2-1, A2-2, B1.`);
        }
        levels.add(spec.cefr);
      }
    } else {
      throw new Error(`Tùy chọn không hỗ trợ: ${arg}. Dùng --help để xem hướng dẫn.`);
    }
  }

  if (levels.size > 0) {
    parsed.levels = [...levels];
  }
  return parsed;
}

export async function runIrodoriCli(argv: readonly string[]): Promise<number> {
  let args: IrodoriCliArgs;
  try {
    args = parseIrodoriCliArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (args.help) {
    console.log(usageText());
    return 0;
  }

  const report = await importIrodoriDirectory({
    dir: args.dir,
    dryRun: args.dryRun,
    levels: args.levels,
    autoMeta: args.autoMeta,
    dbFile: args.dbFile,
    storePath: args.storePath,
    mediaDir: args.mediaDir,
  });

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatIrodoriReport(report));
  }

  return report.totals.errors > 0 ? 1 : 0;
}

const isEntrypoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  runIrodoriCli(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    },
  );
}
