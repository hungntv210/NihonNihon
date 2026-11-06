'use client';
import { useEffect, useState } from 'react';
import styles from './kanji.module.css';
export function PersonalMemo({ itemId }: { itemId: string }) {
  const key = 'nihon:kanji:memo:' + itemId,
    [text, setText] = useState(''),
    [status, setStatus] = useState('');
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      setText((saved ?? '').slice(0, 500));
      setStatus('');
    } catch {
      setText('');
      setStatus('Trình duyệt không cho phép lưu trên thiết bị.');
    }
  }, [key]);
  function save() {
    try {
      const value = text.normalize('NFC').trim();
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
      setText(value);
      setStatus(value ? 'Đã lưu trên thiết bị này.' : 'Đã xoá mẹo nhớ trên thiết bị này.');
    } catch {
      setStatus('Chưa lưu được. Kiểm tra dung lượng hoặc quyền lưu trữ trình duyệt.');
    }
  }
  return (
    <div className={styles.memo}>
      <label htmlFor="kanji-memo">Mẹo nhớ của riêng bạn</label>
      <textarea
        id="kanji-memo"
        maxLength={500}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setStatus('');
        }}
        placeholder="Một liên tưởng ngắn giúp bạn nhớ chữ…"
      />
      <div className={styles.memoFooter}>
        <span>Chỉ lưu trên thiết bị này · {text.length}/500 ký tự</span>
        <button className="button button-small" type="button" onClick={save}>
          Lưu mẹo nhớ
        </button>
      </div>
      <p className={styles.reportStatus} role="status">
        {status}
      </p>
    </div>
  );
}
