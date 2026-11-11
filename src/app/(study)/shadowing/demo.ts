export const demo = {
  title: 'Nhịp thử · 3 đoạn',
  duration: 9,
  segments: [
    { start: 0, end: 3, ja: 'おはようございます。', vi: 'Chào buổi sáng.' },
    { start: 3, end: 6, ja: '今日はいい天気ですね。', vi: 'Hôm nay trời đẹp nhỉ.' },
    { start: 6, end: 9, ja: '一緒に練習しましょう。', vi: 'Cùng luyện tập nhé.' },
  ],
} as const;

export function segmentAtIn(time: number,segments:readonly {start:number;end:number}[]) {
  return segments.findIndex((segment) => time >= segment.start && time < segment.end);
}
export const segmentAt=(time:number)=>segmentAtIn(time,demo.segments);

export function shouldRepeat(completed: number, limit: number) {
  return limit === 0 || completed < limit;
}

export function mediaRange(header: string | null, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new Error('Invalid range');
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) throw new Error('Invalid range');
  return { start, end };
}
