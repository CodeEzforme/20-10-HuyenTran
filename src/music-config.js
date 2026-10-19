export const defaults = {
  opening: { src: 'assets/anh-nang-cua-anh.mp3', start: 0, end: null, volume: 0.8, loop: true },
  letter: { src: 'assets/letter-confession.mp3', start: 0, end: null, volume: 0.62, loop: true },
};

export function validateConfig(value) {
  const result = {};
  for (const key of ['opening', 'letter']) {
    const v = value?.[key];
    if (!v || typeof v.src !== 'string' || !v.src.trim()) throw new Error('Hãy chọn bài nhạc cho cả hai phần.');
    if (!/^assets\/[a-zA-Z0-9._/-]+$/.test(v.src) || v.src.includes('..')) throw new Error('Đường dẫn nhạc không hợp lệ.');
    if (!Number.isFinite(v.start) || v.start < 0 || (v.end !== null && (!Number.isFinite(v.end) || v.end <= v.start))) throw new Error('Điểm kết thúc phải lớn hơn điểm bắt đầu.');
    if (!Number.isFinite(v.volume) || v.volume < 0 || v.volume > 1 || typeof v.loop !== 'boolean') throw new Error('Âm lượng hoặc tùy chọn lặp không hợp lệ.');
    result[key] = { src: v.src, start: v.start, end: v.end, volume: v.volume, loop: v.loop };
  }
  return result;
}

export function bindSegment(track, config, onFinished) {
  track.loop = false;
  const finish = () => {
    if (config.loop) {
      track.currentTime = config.start;
      track.play()?.catch(() => {});
    } else {
      track.pause();
      onFinished?.();
    }
  };
  const time = () => { if (config.end !== null && track.currentTime >= config.end) finish(); };
  track.addEventListener('timeupdate', time);
  track.addEventListener('ended', finish);
  return () => {
    track.removeEventListener('timeupdate', time);
    track.removeEventListener('ended', finish);
  };
}
