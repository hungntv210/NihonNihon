# Today / roadmap

The route reads active OpenJLPT records from the existing content database. The 87-week plan shows the available catalog, not invented coverage. Missing frequency data uses stable source identifiers.

Progress is owner-only JSON in `private/today-roadmap.json` beside the selected database (`data/private/today-roadmap.json` with the demo default). Settings similarly default to `settings.json` beside that database. `NIHON_ROADMAP_PATH` and `NIHON_SETTINGS_PATH` override these defaults. Shadowing completion is explicitly manual: regular sessions require 15 minutes; makeup requires 25 minutes and two distinct clip references. This does not assess audio recordings or pronunciation. Missing previous-week sessions lock new lessons, while SRS remains available. Foundation owns enforcement outside this route.

The dashboard supports daytime quick recognition review, evening/20-minute plans, Sunday review, persisted resume, manual activity streaks, third-session freeze credits, recovery warnings and missed-week timeline estimates. Manual activity may differ from actual learning activity. Freeze credits are shown as accumulated credits; automatic freeze consumption is not implemented.

JLPT exercises/weekly tests, audio capture and background notification delivery depend on later modules. Their unavailable status is shown in the UI. Reminders currently appear only while this page is open. Planned leave of up to two weeks per six months is not implemented in this route.

Verification: `npm run check`, then `node --import tsx "src/app/(study)/today-roadmap/browser-check.ts"`. The latter uses synthetic credentials and an isolated demo database, checks desktop/mobile layout and persistence, and writes ignored artifacts under `data/reports/today-roadmap/`.


Wasoku GĐ2: ba nhóm Làm ngay / Tuần này / Hành trình; các bộ đếm lấy từ getToday và kế hoạch hiện có. Lịch, khóa bài, xác nhận và 87 chi tiết tuần giữ nguyên. Trang gốc dùng cùng dữ liệu thật, không có XP hoặc tên người từ mockup.

Wasoku GĐ3: bản đồ đường uốn 4 vùng với 87 chặng mở đúng chi tiết tuần hiện có. Rùa đứng ở tuần kế hoạch hiện tại; trạng thái ghi rõ đã qua theo lịch / hiện tại / sắp tới, không khẳng định đã học xong và không khóa quyền xem. Ba cổng giữ mốc thi dự kiến. Nút giữ vị trí khi nhấn để không xung đột transform của layout chung.
