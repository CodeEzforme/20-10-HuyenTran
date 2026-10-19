import './style.css';

const scenes = [...document.querySelectorAll('.scene')];
const wishes = {
  happy: 'Chúc Huyền Trân ngày 20/10 <strong>ngập tràn hạnh phúc</strong>. Mong em luôn có thật nhiều lý do để mỉm cười, được làm những điều mình thích và được yêu thương theo cách em xứng đáng.',
  healthy: 'Chúc em luôn <strong>khỏe mạnh và đầy năng lượng</strong>. Nhớ ăn đúng bữa, ngủ đủ giấc và chăm sóc bản thân nhé. Với anh, em vui và khỏe là điều quý giá nhất.',
  peaceful: 'Chúc em có thật nhiều <strong>bình yên trong lòng</strong>. Những ngày mệt mỏi, em cứ nghỉ một chút, chẳng cần lúc nào cũng phải mạnh mẽ. Anh luôn sẵn lòng lắng nghe em.',
  cute: 'Chúc cô gái của anh luôn <strong>rạng rỡ theo cách riêng của em</strong>, tự tin với những điều mình chọn và giữ mãi nụ cười anh thương. Cảm ơn em vì đã có mặt trong cuộc đời anh. ♡',
};

let currentScene = 'scene-welcome';
let transitionTimer = null;
let wordsTimer = null;
let confessionTimer = null;
let holdFrame = null;
let holdStartedAt = 0;
let audioContext = null;
const sceneExitTimers = new Map();
const audioFadeFrames = new WeakMap();
const audioPlayVersions = new WeakMap();
const openingMusic = new Audio();
const letterMusic = new Audio();
const ENVELOPE_HOLD_TIME = 10000;
const CONTINUATION_START_TIME = 0;
const OPENING_VOLUME = 0.8;
const CONTINUATION_VOLUME = 0.65;
const LETTER_VOLUME = 0.62;
const assetUrl = (fileName) => `${import.meta.env.BASE_URL}assets/${fileName}`;
const openingTrackSource = assetUrl('october-opening.wav');
const continuationTrackSource = openingTrackSource;
let openingPlaylistPhase = 'opening';

openingMusic.preload = 'auto';
letterMusic.preload = 'metadata';
openingMusic.src = openingTrackSource;
letterMusic.src = assetUrl('letter-confession.mp3');

[openingMusic, letterMusic].forEach((track) => {
  track.loop = false;
  track.volume = 0;
});
letterMusic.loop = true;

function showScene(id) {
  if (currentScene === id) return;
  const next = document.getElementById(id);
  const active = document.getElementById(currentScene);

  const pendingNextExit = sceneExitTimers.get(next);
  if (pendingNextExit) {
    window.clearTimeout(pendingNextExit);
    sceneExitTimers.delete(next);
  }

  next.classList.remove('scene--leaving');
  active?.classList.add('scene--leaving');
  next.classList.add('scene--active');

  if (active) {
    const pendingActiveExit = sceneExitTimers.get(active);
    if (pendingActiveExit) window.clearTimeout(pendingActiveExit);
    const exitTimer = window.setTimeout(() => {
      active.classList.remove('scene--active', 'scene--leaving');
      sceneExitTimers.delete(active);
    }, 900);
    sceneExitTimers.set(active, exitTimer);
  }
  currentScene = id;
}

function clearTimers() {
  window.clearTimeout(transitionTimer);
  window.clearTimeout(wordsTimer);
  window.clearTimeout(confessionTimer);
  if (holdFrame) cancelAnimationFrame(holdFrame);
}

function fadeAudio(track, targetVolume, duration = 1000, onComplete) {
  const previousFrame = audioFadeFrames.get(track);
  if (previousFrame) cancelAnimationFrame(previousFrame);

  const startVolume = track.volume;
  const startedAt = performance.now();
  const update = (now) => {
    const progress = Math.max(0, Math.min((now - startedAt) / duration, 1));
    track.volume = startVolume + (targetVolume - startVolume) * progress;
    if (progress < 1) {
      audioFadeFrames.set(track, requestAnimationFrame(update));
    } else {
      audioFadeFrames.delete(track);
      onComplete?.();
    }
  };
  audioFadeFrames.set(track, requestAnimationFrame(update));
}

function startMusic(track, volume, startAt = 0, fadeDuration = 1200) {
  const playVersion = (audioPlayVersions.get(track) || 0) + 1;
  audioPlayVersions.set(track, playVersion);

  const beginPlayback = () => {
    if (audioPlayVersions.get(track) !== playVersion) return;
    if (track.readyState >= HTMLMediaElement.HAVE_METADATA) {
      track.currentTime = startAt;
    }
    track.volume = 0;
    const playback = track.play();
    playback?.then(() => fadeAudio(track, volume, fadeDuration)).catch(() => {
      document.getElementById('sound-indicator').classList.remove('sound-toggle--active');
    });
  };

  if (startAt > 0 && track.readyState < HTMLMediaElement.HAVE_METADATA) {
    track.addEventListener('loadedmetadata', beginPlayback, { once: true });
  } else {
    beginPlayback();
  }
}

function ensureOpeningPlaylist() {
  const targetVolume = openingPlaylistPhase === 'opening' ? OPENING_VOLUME : CONTINUATION_VOLUME;
  if (!openingMusic.paused) {
    fadeAudio(openingMusic, targetVolume, 500);
  } else {
    const startAt = openingPlaylistPhase === 'opening' ? 0 : CONTINUATION_START_TIME;
    startMusic(openingMusic, targetVolume, startAt);
  }
}

function switchMusic(fromTracks, toTrack) {
  fromTracks.forEach((fromTrack) => {
    audioPlayVersions.set(fromTrack, (audioPlayVersions.get(fromTrack) || 0) + 1);
    fadeAudio(fromTrack, 0, 900, () => {
      fromTrack.pause();
      fromTrack.currentTime = 0;
    });
  });
  startMusic(toTrack, LETTER_VOLUME);
}

function stopMusic(track) {
  audioPlayVersions.set(track, (audioPlayVersions.get(track) || 0) + 1);
  const fadeFrame = audioFadeFrames.get(track);
  if (fadeFrame) cancelAnimationFrame(fadeFrame);
  audioFadeFrames.delete(track);
  track.pause();
  track.currentTime = 0;
  track.volume = 0;
}

function startContinuationMusic() {
  openingPlaylistPhase = 'continuation';
  const playVersion = (audioPlayVersions.get(openingMusic) || 0) + 1;
  audioPlayVersions.set(openingMusic, playVersion);
  openingMusic.src = continuationTrackSource;
  openingMusic.preload = 'auto';
  openingMusic.volume = 0;

  const seekToContinuation = () => {
    if (audioPlayVersions.get(openingMusic) === playVersion) {
      openingMusic.currentTime = CONTINUATION_START_TIME;
    }
  };

  if (openingMusic.readyState >= HTMLMediaElement.HAVE_METADATA) {
    seekToContinuation();
  } else {
    openingMusic.addEventListener('loadedmetadata', seekToContinuation, { once: true });
  }

  const playback = openingMusic.play();
  playback?.then(() => fadeAudio(openingMusic, CONTINUATION_VOLUME, 600)).catch(() => {
    document.getElementById('sound-indicator').classList.remove('sound-toggle--active');
  });
}

function resetOpeningPlaylist() {
  openingPlaylistPhase = 'opening';
  openingMusic.src = openingTrackSource;
  openingMusic.preload = 'auto';
  openingMusic.volume = 0;
  openingMusic.load();
}

openingMusic.addEventListener('ended', () => {
  startContinuationMusic();
});

function createAmbient() {
  const stars = document.getElementById('stars');
  const hearts = document.getElementById('floating-hearts');
  for (let i = 0; i < 52; i += 1) {
    const star = document.createElement('i');
    star.style.cssText = `--x:${Math.random() * 100}%;--y:${Math.random() * 100}%;--s:${1 + Math.random() * 2.5}px;--d:${2.5 + Math.random() * 5}s;--delay:${-Math.random() * 5}s`;
    stars.appendChild(star);
  }
  for (let i = 0; i < 10; i += 1) {
    const heart = document.createElement('i');
    heart.textContent = '♥';
    heart.style.cssText = `--x:${Math.random() * 100}%;--size:${8 + Math.random() * 12}px;--d:${12 + Math.random() * 12}s;--delay:${-Math.random() * 18}s;--drift:${-35 + Math.random() * 70}px`;
    hearts.appendChild(heart);
  }
}

function createDateReel() {
  const reel = document.getElementById('number-reel');
  const numbers = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  reel.innerHTML = numbers.map((number) => `<span>${number}</span>`).join('');
}

function playChime() {
  try {
    const BrowserAudioContext = window.AudioContext || window.webkitAudioContext;
    if (!BrowserAudioContext) return;
    audioContext ||= new BrowserAudioContext();
    const now = audioContext.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * 0.12);
      gain.gain.linearRampToValueAtTime(0.07, now + index * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2 + index * 0.12);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + index * 0.12);
      oscillator.stop(now + 1.3 + index * 0.12);
    });
  } catch {
    // The experience still works when browser audio is unavailable.
  }
}

document.getElementById('start-button').addEventListener('click', () => {
  ensureOpeningPlaylist();
  playChime();
  document.getElementById('sound-indicator').classList.add('sound-toggle--active');
  showScene('scene-date');
  const dateScene = document.getElementById('scene-date');
  dateScene.classList.remove('date-animated');
  requestAnimationFrame(() => dateScene.classList.add('date-animated'));
  transitionTimer = window.setTimeout(() => showScene('scene-cake'), 9100);
});

const cakeScene = document.getElementById('scene-cake');
const holdButton = document.getElementById('blow-button');
const cakeWrap = document.getElementById('cake-wrap');
const holdHint = document.getElementById('hold-hint');

function updateHold(now) {
  const elapsed = now - holdStartedAt;
  const progress = Math.min(elapsed / 5000, 1);
  cakeWrap.style.setProperty('--hold-progress', `${progress * 360}deg`);
  holdHint.textContent = progress < 1 ? `Còn ${(5 - elapsed / 1000).toFixed(1)} giây` : 'Điều ước đã được gửi đi';
  if (progress >= 1) {
    completeHold();
    return;
  }
  holdFrame = requestAnimationFrame(updateHold);
}

function startHold(event) {
  event.preventDefault();
  if (cakeScene.classList.contains('cake-complete')) return;
  holdButton.setPointerCapture?.(event.pointerId);
  holdStartedAt = performance.now();
  cakeScene.classList.add('is-holding');
  holdFrame = requestAnimationFrame(updateHold);
}

function cancelHold() {
  if (!cakeScene.classList.contains('is-holding') || cakeScene.classList.contains('cake-complete')) return;
  cakeScene.classList.remove('is-holding');
  cancelAnimationFrame(holdFrame);
  cakeWrap.style.setProperty('--hold-progress', '0deg');
  holdHint.textContent = 'Giữ trong 5 giây';
}

function completeHold() {
  cakeScene.classList.remove('is-holding');
  cakeScene.classList.add('cake-complete');
  if (navigator.vibrate) navigator.vibrate([80, 60, 120]);
  transitionTimer = window.setTimeout(startWords, 3500);
}

holdButton.addEventListener('pointerdown', startHold);
holdButton.addEventListener('pointerup', cancelHold);
holdButton.addEventListener('pointercancel', cancelHold);
holdButton.addEventListener('lostpointercapture', cancelHold);
holdButton.addEventListener('contextmenu', (event) => event.preventDefault());

const wordLines = [
  'Điều ước nhỏ đã được gửi đi.',
  'Mong em được yêu thương, hôm nay và mọi ngày.',
  'Cứ là chính em nhé. Anh thương em như thế.',
];

function startWords() {
  showScene('scene-words');
  let index = 0;
  const line = document.getElementById('words-line');
  const count = document.getElementById('words-count');

  const advance = () => {
    line.classList.remove('words-stage__line--visible');
    wordsTimer = window.setTimeout(() => {
      line.textContent = wordLines[index];
      count.textContent = `0${index + 1} / 03`;
      line.classList.add('words-stage__line--visible');
      index += 1;
      if (index < wordLines.length) {
        wordsTimer = window.setTimeout(advance, 2700);
      } else {
        wordsTimer = window.setTimeout(() => showScene('scene-wishes'), 3000);
      }
    }, index === 0 ? 120 : 600);
  };
  advance();
}

document.querySelectorAll('.ticket').forEach((ticket) => {
  ticket.addEventListener('click', () => {
    const key = ticket.dataset.wish;
    document.getElementById('wish-copy').innerHTML = wishes[key];
    playChime();
    showScene('scene-wish-result');
  });
});

document.getElementById('choose-again').addEventListener('click', () => showScene('scene-wishes'));
document.getElementById('letter-link').addEventListener('click', () => showScene('scene-envelope'));

const envelopeButton = document.getElementById('envelope-button');
envelopeButton.addEventListener('click', () => {
  if (envelopeButton.classList.contains('envelope-button--open')) return;
  envelopeButton.classList.add('envelope-button--open');
  switchMusic([openingMusic], letterMusic);
  playChime();
  transitionTimer = window.setTimeout(startConfession, ENVELOPE_HOLD_TIME);
});

const confessions = [
  'Huyền Trân à, chúc em 20/10 thật dịu dàng.',
  'Mong em luôn tự tin, rạng rỡ và bình yên.',
  'Cảm ơn em đã mang bao điều đẹp đẽ đến bên anh.',
  'Hôm nay và mỗi ngày, anh luôn thương em.',
];

function createMatrixRain() {
  const rain = document.getElementById('matrix-rain');
  rain.innerHTML = '';
  const glyphs = 'ANHYÊUEM♡2010';
  for (let i = 0; i < 34; i += 1) {
    const column = document.createElement('span');
    column.textContent = Array.from({ length: 18 }, () => glyphs[Math.floor(Math.random() * glyphs.length)]).join('\n');
    column.style.cssText = `--x:${i * 3 + Math.random() * 2}%;--d:${7 + Math.random() * 8}s;--delay:${-Math.random() * 14}s;--opacity:${0.1 + Math.random() * 0.22}`;
    rain.appendChild(column);
  }
}

function startConfession() {
  createMatrixRain();
  showScene('scene-confession');
  const line = document.getElementById('confession-line');
  const dots = [...document.querySelectorAll('#confession-progress span')];
  let index = 0;

  const advance = () => {
    line.classList.remove('confession-line--visible');
    dots.forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === index));
    confessionTimer = window.setTimeout(() => {
      line.textContent = confessions[index];
      line.classList.add('confession-line--visible');
      index += 1;
      if (index < confessions.length) {
        confessionTimer = window.setTimeout(advance, 3400);
      } else {
        confessionTimer = window.setTimeout(() => {
          showScene('scene-final');
          playChime();
        }, 4000);
      }
    }, 600);
  };
  advance();
}

document.getElementById('replay-button').addEventListener('click', () => {
  clearTimers();
  stopMusic(openingMusic);
  stopMusic(letterMusic);
  resetOpeningPlaylist();
  startMusic(openingMusic, OPENING_VOLUME);
  document.getElementById('sound-indicator').classList.add('sound-toggle--active');
  cakeScene.classList.remove('is-holding', 'cake-complete');
  cakeWrap.style.setProperty('--hold-progress', '0deg');
  holdHint.textContent = 'Giữ trong 5 giây';
  envelopeButton.classList.remove('envelope-button--open');
  document.getElementById('number-reel').style.animation = 'none';
  showScene('scene-welcome');
  window.setTimeout(() => {
    document.getElementById('number-reel').style.animation = '';
  }, 100);
});

createAmbient();
createDateReel();
