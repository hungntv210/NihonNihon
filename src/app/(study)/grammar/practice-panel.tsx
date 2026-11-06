'use client';
import { useState } from 'react';
import type { ChoiceQuestion, OrderingQuestion } from './practice.ts';
import { correctOrder } from './practice.ts';
import styles from './grammar.module.css';
export function PracticePanel({
  choices,
  ordering,
}: {
  choices: ChoiceQuestion[];
  ordering: OrderingQuestion[];
}) {
  const [mode, setMode] = useState<'choice' | 'order'>('choice'),
    [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(''),
    [order, setOrder] = useState<number[]>([]),
    [checked, setChecked] = useState(false);
  const list = mode === 'choice' ? choices : ordering,
    question = list[index],
    done = index >= list.length;
  function reset(nextMode = mode, nextIndex = 0) {
    setMode(nextMode);
    setIndex(nextIndex);
    setAnswer('');
    setOrder([]);
    setChecked(false);
  }
  const selected = mode === 'choice' ? choices[index] : null,
    ordered = mode === 'order' ? ordering[index] : null;
  const correct = selected
    ? answer === selected.answer
    : ordered
      ? correctOrder(ordered, order)
      : false;
  return (
    <section className={styles.practice} aria-labelledby="practice-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">HỌC XONG, THỬ NGAY</p>
          <h2 id="practice-title">Luyện với câu gốc</h2>
        </div>
      </div>
      <p className={styles.help}>
        Bài luyện được tách từ ví dụ đang học. Đáp án khớp câu gốc, không khẳng định các cách diễn
        đạt khác đều sai.
      </p>
      <div className={styles.tabs} role="group" aria-label="Dạng bài">
        <button
          className="button button-small"
          aria-pressed={mode === 'choice'}
          onClick={() => reset('choice')}
        >
          Chọn mẫu câu ({choices.length})
        </button>
        <button
          className="button button-small"
          aria-pressed={mode === 'order'}
          onClick={() => reset('order')}
        >
          Sắp xếp ★ ({ordering.length})
        </button>
      </div>
      {!list.length ? (
        <p className={styles.notice}>
          Chưa đủ ngữ liệu để sinh dạng bài này. Bạn vẫn có thể đọc và nghe các ví dụ ở trên.
        </p>
      ) : done ? (
        <div className={styles.feedback} role="status">
          <h3>Đã đi hết lượt luyện.</h3>
          <p>Bạn có thể làm lại để gặp câu thêm một lần.</p>
          <button className="button" onClick={() => reset()}>
            Luyện lại
          </button>
        </div>
      ) : (
        <div key={question.id}>
          <p className={styles.help}>
            Câu {index + 1}/{list.length} ·{' '}
            {mode === 'choice'
              ? 'Chọn mẫu được dùng trong câu gốc.'
              : 'Ghép đủ bốn mảnh để khôi phục câu gốc; ô ★ là vị trí thứ hai.'}
          </p>
          {selected && (
            <>
              <p className={styles.question} lang="ja">
                {selected.sentence}
              </p>
              <div className={styles.options} role="group" aria-label="Đáp án">
                {selected.choices.map((value) => (
                  <button
                    key={value}
                    className="button"
                    lang="ja"
                    aria-pressed={answer === value}
                    disabled={checked}
                    onClick={() => setAnswer(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </>
          )}
          {ordered && (
            <>
              <div className={styles.slots} aria-label="Câu đang ghép">
                {[0, 1, 2, 3].map((slot) => {
                  const id = order[slot],
                    piece = ordered.pieces.find((p) => p.id === id);
                  return (
                    <button
                      className={styles.slot}
                      key={slot}
                      aria-label={`Vị trí ${slot + 1}${slot === ordered.star ? ', sao' : ''}${piece ? ', bỏ ' + piece.text : ''}`}
                      disabled={checked}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (checked) return;
                        const raw = event.dataTransfer.getData('text/plain');
                        if (!/^\d$/.test(raw)) return;
                        const value = Number(raw);
                        if (ordered.pieces.some((p) => p.id === value) && !order.includes(value))
                          setOrder([...order, value]);
                      }}
                      onClick={() => setOrder(order.filter((v) => v !== id))}
                    >
                      <span className={styles.slotNumber}>
                        {slot === ordered.star ? '★' : slot + 1}
                      </span>
                      <span lang="ja">{piece?.text || '—'}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.options} role="group" aria-label="Mảnh câu">
                {ordered.pieces.map((piece) => (
                  <button
                    key={piece.id}
                    className="button"
                    lang="ja"
                    draggable={!checked && !order.includes(piece.id)}
                    onDragStart={(event) =>
                      event.dataTransfer.setData('text/plain', String(piece.id))
                    }
                    disabled={checked || order.includes(piece.id)}
                    onClick={() => setOrder([...order, piece.id])}
                  >
                    {piece.text}
                  </button>
                ))}
              </div>
              <p className={styles.help}>
                Chạm mảnh câu để thêm; chạm ô đã ghép để bỏ. Có thể kéo mảnh vào vùng câu trên máy
                tính.
              </p>
            </>
          )}
          {checked ? (
            <div className={`${styles.feedback} ${correct ? '' : styles.incorrect}`} role="status">
              <strong>
                {correct ? 'Đúng với câu gốc.' : 'Chưa khớp câu gốc. Cùng xem lại nhé.'}
              </strong>
              <p lang="ja" className={styles.answer}>
                {selected?.original ?? ordered?.sentence}
              </p>
              {question.english && <p lang="en">{question.english}</p>}
              <div className={styles.options}>
                <button className="button" onClick={() => reset(mode, index)}>
                  Thử lại câu này
                </button>
                <button className="button button-primary" onClick={() => reset(mode, index + 1)}>
                  Câu tiếp theo →
                </button>
              </div>
            </div>
          ) : (
            <button
              className="button button-primary"
              disabled={selected ? !answer : order.length !== 4}
              onClick={() => setChecked(true)}
            >
              Kiểm tra
            </button>
          )}
        </div>
      )}
    </section>
  );
}
