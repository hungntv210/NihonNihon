# Gộp package.json giữa G0 và G1

Đây là cách giải quyết khi merge code G0 vào nền G1; không merge nhánh G0 hoặc
đổi nghĩa các lệnh hiện tại chỉ để viết hướng dẫn này. Worker dịch tiếp tục ở
worktree riêng. Không chép `.env`, database hoặc dữ liệu raw sang PR.

## Tên và dependency

- Dùng tên gói duy nhất **`nihon-nihon`** như G1, bỏ tên `nihonnihon-data-tools`
  của package G0. Giữ `private: true`, `type: module`, `version: 0.1.0` và
  `engines.node: >=24.0.0`.
- Giữ Next/React/server-only và toàn bộ devDependencies của G1.
- Hợp các dependencies G0 vào dependencies đó: `@google/genai: 2.32.0`,
  `ajv: 8.20.0`, `csv-parse: 7.0.3`, `fast-xml-parser: 5.12.0`. Đây là các phiên
  bản đang pin trong `g0/data-import`; đối chiếu lại manifest thực tế khi merge.
- Không chọn nguyên package.json/lockfile của một phía vì sẽ làm mất test hoặc
  dependency của phía còn lại.

## Gộp scripts mà không làm mất bộ kiểm thử

| Trước khi merge | Sau khi merge |
| --- | --- |
| G0 `test` (schema/importer/Gemini mock) | `test:data` |
| G1 `test` (prototype + unit/component/route tests) | `test:app` |
| G1 `test:app` (HTTP/Chrome trên build production) | `test:browser` |
| `test` gốc | Gọi lần lượt `test:data` và `test:app` |
| `check` gốc | typecheck → test → build → test:browser |

Khối scripts cụ thể sau khi code và test G0 đã được merge đầy đủ:

```json
{
  "dev": "next dev --webpack --hostname 127.0.0.1",
  "build": "next build --webpack",
  "start": "next start --hostname 127.0.0.1",
  "typecheck": "next typegen && tsc --noEmit",
  "test:data": "node --test tests/data/*.test.cjs tests/import/*.test.mjs",
  "test:app": "node --test prototype/tests/*.test.js && node tools/test.mjs",
  "test:browser": "tsx tools/test-app.ts",
  "test": "npm run test:data && npm run test:app",
  "check": "npm run typecheck && npm test && npm run build && npm run test:browser",
  "data:prepare": "node tools/data/prepare.mjs",
  "data:import": "node tools/data/import.mjs",
  "data:preview": "node tools/data/preview.mjs",
  "data:demo": "tsx tools/seed-demo.ts",
  "auth:password": "tsx tools/hash-password.ts"
}
```

Không kích hoạt `test:data` trước khi có `tests/data/` và `tests/import/` từ G0;
không dùng lệnh bỏ qua lỗi/thiếu file để tạo kết quả pass giả. Giữ
`prototype/package.json` với `type: commonjs` và để `tools/test.mjs` chỉ phát hiện
test TypeScript của G1; test CJS/MJS của G0 chạy riêng qua `test:data`.
Cập nhật tên cổng cuối trong README, AGENTS và hợp đồng kiểm thử khi áp dụng
việc đổi tên; `npm run check` vẫn phải chạy đủ cả unit và HTTP/trình duyệt.

## Lockfile và xác minh

Sau khi giải quyết xong package.json, tạo lại lockfile từ manifest đã hợp:

```sh
npm install --package-lock-only --ignore-scripts
npm ci
npm run check
```

Kiểm tra `name` ở đầu `package-lock.json` và `packages[""].name` đều là
`nihon-nihon`. Không ghép thủ công các dòng lockfile hoặc lấy lockfile của G0
đè lên G1. Ghi SHA commit thực sự kiểm tra, thời gian, số test dữ liệu/test ứng
dụng và kết quả HTTP/Chrome vào `docs/foundation-verification.md` trước khi push.

`tsconfig.json` phải tiếp tục exclude `data`: mã nguồn upstream tải xuống có
tsconfig/dependency riêng. Exclude không chặn đọc JSON fixture bằng seed script.
Giữ khối `.gitignore` dữ liệu riêng của G0, đồng thời giữ `data/fixtures/` và
`.env.example` được theo dõi. Không thay schema trong bước gộp package.
