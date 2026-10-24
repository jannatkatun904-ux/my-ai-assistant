// voice.js - সুন্দর মেয়েলি কণ্ঠ (Gemini TTS), ব্যর্থ হলে ব্রাউজারের ভয়েস
const BOSS_TTS_MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-3.1-flash-tts-preview'];
const bossAudio = new Audio();
let bossToken = 0;
let bossUnlocked = false;

// মোবাইলে অটো-প্লে চালু রাখতে প্রথম ট্যাপে অডিও "আনলক" করা হয়
document.addEventListener('pointerdown', function () {
  if (bossUnlocked) return;
  bossUnlocked = true;
  bossAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  bossAudio.play().catch(function () {});
}, { once: true });

function bossVoiceName() {
  return localStorage.getItem('boss_voice') || 'Leda';
}

function pcmToWavBlob(b64) {
  const bin = atob(b64), n = bin.length;
  const buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 24000, true); v.setUint32(28, 48000, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n, true);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < n; i++) u8[44 + i] = bin.charCodeAt(i);
  return new Blob([buf], { type: 'audio/wav' });
}

async function geminiTTS(text, voiceName) {
  const key = (localStorage.getItem('boss_gkey2') || '').replace(/[^\x21-\x7E]/g, '');
  if (!key) throw new Error('API key নেই');
  let lastErr = new Error('TTS ব্যর্থ');
  for (const model of BOSS_TTS_MODELS) {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'মিষ্টি, নরম ও বন্ধুত্বপূর্ণ কণ্ঠে বলো: ' + text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } }
          }
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error((j.error && j.error.message) || ('ত্রুটি ' + r.status));
      const part = j.candidates[0].content.parts.find(p => p.inlineData);
      return pcmToWavBlob(part.inlineData.data);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function browserSpeak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const voices = speechSynthesis.getVoices();
  const bn = voices.filter(v => v.lang.toLowerCase().startsWith('bn'));
  const v = bn.find(x => /female|google/i.test(x.name)) || bn[0] || null;
  const u = new SpeechSynthesisUtterance(text);
  if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'bn-BD'; }
  u.pitch = 1.25;
  speechSynthesis.speak(u);
}

async function bossSpeak(text, voiceName) {
  const my = ++bossToken;
  bossAudio.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  text = (text || '').slice(0, 800);
  try {
    const blob = await geminiTTS(text, voiceName || bossVoiceName());
    if (my !== bossToken) return;
    bossAudio.src = URL.createObjectURL(blob);
    await bossAudio.play();
  } catch (e) {
    if (my === bossToken) browserSpeak(text);
  }
}
