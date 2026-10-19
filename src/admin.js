import './admin.css';
import { defaults, validateConfig, bindSegment } from './music-config.js';

const root = new URL('../', location.href);
const apiRoot = 'https://api.github.com/repos/CodeEzforme/20-10-HuyenTran/contents/';
const status = document.getElementById('status');
const form = document.getElementById('music-form');
const library = new Map([
  ['assets/anh-nang-cua-anh.mp3', 'Ánh Nắng Của Anh — Đức Phúc'],
  ['assets/letter-confession.mp3', 'Nhạc mở thư hiện tại'],
  ['assets/october-opening.wav', 'Giai điệu không lời 20/10'],
]);
const states = {};
let loadedSha;
let unbindPreview;
let activePreview;
function message(text, error = false) { status.textContent = text; status.className = error ? 'error' : 'good'; }
function stopPreview() { unbindPreview?.(); activePreview?.pause(); }

function addOption(select, value, label) {
  if ([...select.options].some(o => o.value === value)) return;
  const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option);
}

for (const [key, title] of [['opening', '01 · Mở đầu & lời chúc'], ['letter', '02 · Mở thư & lời nhắn']]) {
  const section = document.createElement('section');
  section.innerHTML = `<h2>${title}</h2>
    <label>Bài nhạc<select name="${key}-src"></select></label>
    <label>Hoặc tải bài mới từ máy<input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" name="${key}-file" /></label>
    <p class="hint">Tối đa 25 MB. File sẽ được tải lên website khi xuất bản.</p>
    <div class="times"><label>Bắt đầu (giây)<input type="number" min="0" step="0.1" name="${key}-start" required /></label><label>Kết thúc (giây)<input type="number" min="0" step="0.1" name="${key}-end" placeholder="Hết bài" /></label></div>
    <label>Âm lượng (%)<input type="number" min="0" max="100" step="1" name="${key}-volume" required /></label>
    <label><input type="checkbox" name="${key}-loop" /> Lặp lại đoạn đã chọn</label>
    <button class="secondary" type="button">Nghe thử đoạn này</button>
    <audio controls preload="metadata"></audio><p class="hint duration">Đang đọc thời lượng…</p>`;
  document.getElementById('sections').append(section);
  const field = name => form.elements[`${key}-${name}`];
  const player = section.querySelector('audio');
  const select = field('src');
  for (const [src, label] of library) addOption(select, src, label);
  const state = states[key] = { field, player, file: null, objectUrl: null };
  const refresh = () => {
    stopPreview();
    player.src = state.objectUrl || new URL(select.value, root).href;
  };
  player.addEventListener('loadedmetadata', () => { section.querySelector('.duration').textContent = `Thời lượng: ${player.duration.toFixed(1)} giây. Có thể tua bằng thanh nghe thử.`; });
  player.addEventListener('error', () => { section.querySelector('.duration').textContent = 'Không đọc được file nhạc. Hãy chọn file khác.'; });
  select.addEventListener('change', () => {
    state.file = null; field('file').value = ''; if (state.objectUrl) URL.revokeObjectURL(state.objectUrl); state.objectUrl = null; refresh();
  });
  field('file').addEventListener('change', () => {
    const file = field('file').files[0]; if (!file) return;
    if (file.size > 25 * 1024 * 1024 || !/\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i.test(file.name)) {
      field('file').value = ''; message('Hãy chọn file âm thanh hợp lệ, tối đa 25 MB.', true); return;
    }
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.file = file; state.objectUrl = URL.createObjectURL(file); field('start').value = '0'; field('end').value = ''; refresh();
  });
  section.querySelector('button').addEventListener('click', async () => {
    try {
      const config = readConfig()[key]; stopPreview();
      if (!Number.isFinite(player.duration)) throw new Error('Chờ tải nhạc xong rồi nghe thử nhé.');
      if (config.start >= player.duration || (config.end !== null && config.end > player.duration)) throw new Error('Đoạn nhạc vượt quá thời lượng bài.');
      player.currentTime = config.start; player.volume = config.volume;
      unbindPreview = bindSegment(player, config); activePreview = player; await player.play();
      message('Đang nghe thử đoạn đã chọn.');
    } catch (error) { message(error.message, true); }
  });
  state.apply = config => {
    addOption(select, config.src, library.get(config.src) || config.src.split('/').pop()); select.value = config.src;
    field('start').value = config.start; field('end').value = config.end ?? ''; field('volume').value = Math.round(config.volume * 100); field('loop').checked = config.loop; refresh();
  };
}

function readConfig() {
  const config = {};
  for (const [key, { field, player, file }] of Object.entries(states)) {
    if (file && !Number.isFinite(player.duration)) throw new Error('File mới chưa đọc được thời lượng. Chờ tải xong hoặc chọn file âm thanh khác.');
    config[key] = { src: field('src').value, start: Number(field('start').value), end: field('end').value === '' ? null : Number(field('end').value), volume: Number(field('volume').value) / 100, loop: field('loop').checked };
    if (Number.isFinite(player.duration) && (config[key].start >= player.duration || (config[key].end !== null && config[key].end > player.duration))) throw new Error('Đoạn nhạc vượt quá thời lượng bài.');
  }
  return validateConfig(config);
}
async function api(path, token, options = {}) {
  const response = await fetch(apiRoot + path, { ...options, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  if (!response.ok) {
    const messages = { 401: 'Token không hợp lệ hoặc đã hết hạn.', 403: 'Token chưa có quyền Contents: Read and write.', 404: 'Không tìm thấy repository hoặc token chưa được cấp quyền truy cập.', 409: 'Cấu hình đã thay đổi ở phiên khác. Tải lại trang rồi thử lại.', 422: 'GitHub không nhận được dữ liệu hợp lệ. Hãy tải lại trang và thử lại.' };
    throw new Error(messages[response.status] || `GitHub gặp lỗi (${response.status}). Hãy thử lại.`);
  }
  return response.json();
}
const encode = text => { const bytes = new TextEncoder().encode(text); let binary = ''; for (const b of bytes) binary += String.fromCharCode(b); return btoa(binary); };
const fileBase64 = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('Không đọc được file.')); reader.readAsDataURL(file); });

try {
  const latest = await fetch(apiRoot + 'public/music-config.json?ref=main', { headers: { Accept: 'application/vnd.github+json' } });
  let config;
  if (latest.ok) {
    const data = await latest.json(); loadedSha = data.sha;
    config = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data.content.replace(/\s/g, '')), c => c.charCodeAt(0))));
  } else {
    const response = await fetch(new URL('music-config.json', root), { cache: 'no-store' });
    if (!response.ok) throw new Error('Không tải được cấu hình.'); config = await response.json();
  }
  config = validateConfig(config);
  for (const key of Object.keys(states)) states[key].apply(config[key]);
  message('Đã tải cấu hình. Chọn nhạc và nghe thử trước khi xuất bản.');
} catch {
  for (const key of Object.keys(states)) states[key].apply(defaults[key]);
  message('Chưa tải được cấu hình mới nhất. Đang hiển thị mặc định; tải lại trang trước khi xuất bản.', true);
}

form.addEventListener('submit', async event => {
  event.preventDefault(); const button = document.getElementById('publish');
  try {
    const config = readConfig(); const token = document.getElementById('token').value.trim();
    if (!token) throw new Error('Nhập token GitHub để xuất bản.');
    button.disabled = true; stopPreview();
    message('Đang kiểm tra quyền và cấu hình…');
    const current = await api('public/music-config.json?ref=main', token);
    if (!loadedSha) throw new Error('Chưa tải được bản mới nhất. Hãy tải lại trang trước khi xuất bản.');
    if (loadedSha !== current.sha) throw new Error('Cấu hình đã thay đổi ở phiên khác. Tải lại trang rồi thử lại.');
    for (const [key, state] of Object.entries(states)) {
      if (!state.file) continue;
      message(`Đang tải bài nhạc cho phần ${key === 'opening' ? 'mở đầu' : 'mở thư'}…`);
      const path = `assets/music-${crypto.randomUUID()}.${state.file.name.split('.').pop().toLowerCase()}`;
      await api('public/' + path, token, { method: 'PUT', body: JSON.stringify({ message: 'Upload music from admin', branch: 'main', content: await fileBase64(state.file) }) });
      config[key].src = path;
      state.file = null; state.field('file').value = ''; addOption(state.field('src'), path, path.split('/').pop()); state.field('src').value = path;
    }
    const result = await api('public/music-config.json', token, { method: 'PUT', body: JSON.stringify({ message: 'Update music settings from admin', branch: 'main', sha: loadedSha, content: encode(JSON.stringify(config, null, 2) + '\n') }) });
    loadedSha = result.content.sha; document.getElementById('token').value = '';
    message('Đã lưu lên GitHub! Website đang cập nhật, thường mất 1–2 phút. Mở lại thiệp sau khi cập nhật hoàn tất.');
  } catch (error) { message(error.message, true); }
  finally { button.disabled = false; }
});
