/* ── STATE & INIT ── */
let apiKey = '';
let dateCount = parseInt(localStorage.getItem('doodle_date_count')) || 1;

const UI = {
  apiScreen: document.getElementById('screen-api'),
  studioScreen: document.getElementById('screen-studio'),
  canvasYou: document.getElementById('canvasYou'),
  canvasAi: document.getElementById('canvasAi'),
  btnLetAiDraw: document.getElementById('btnLetAiDraw'),
  aiWaiting: document.getElementById('aiWaitingState'),
  aiProcessing: document.getElementById('aiProcessingState'),
  dateReceipt: document.getElementById('dateReceipt'),
  galleryGrid: document.getElementById('galleryGrid')
};

const ctxYou = UI.canvasYou.getContext('2d', { willReadFrequently: true });
const ctxAi = UI.canvasAi.getContext('2d');

let isDrawing = false;
let currentBrush = { color: '#1e293b', size: 5, isEraser: false };
let undoStack = [];
let audioCtx = null;
let audioEnabled = false;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('dateCounter').textContent = dateCount;
  const savedKey = localStorage.getItem('claude_api_key_vision');
  if (savedKey) document.getElementById('apiKeyInput').value = savedKey;
  
  // Fill canvases with white initially
  ctxYou.fillStyle = '#ffffff'; ctxYou.fillRect(0,0,400,500);
  ctxAi.fillStyle = '#ffffff'; ctxAi.fillRect(0,0,400,500);
  
  saveState();
  loadGallery();
});

function initApp() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key) { alert('API key required for the AI Vision analysis.'); return; }
  apiKey = key;
  localStorage.setItem('claude_api_key_vision', key);
  
  UI.apiScreen.classList.remove('active');
  UI.studioScreen.classList.add('active');
  initAudio();
}

/* ── AUDIO ENGINE ── */
function toggleAudio() {
  if (!audioCtx) initAudio();
  if (audioEnabled) {
    audioCtx.suspend();
    document.getElementById('audioToggle').style.opacity = '0.5';
  } else {
    audioCtx.resume();
    document.getElementById('audioToggle').style.opacity = '1';
  }
  audioEnabled = !audioEnabled;
}

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  // Lo-fi Loop
  const bass = audioCtx.createOscillator();
  const bassGain = audioCtx.createGain();
  bass.type = 'sine';
  bass.frequency.value = 65.41; // C2
  bassGain.gain.value = 0.05;
  bass.connect(bassGain).connect(audioCtx.destination);
  bass.start();
  
  // Arpeggio C5, E5, G5
  const notes = [523.25, 659.25, 783.99];
  let noteIdx = 0;
  setInterval(() => {
    if (!audioEnabled || audioCtx.state !== 'running') return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = notes[noteIdx];
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.02, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 1);
    noteIdx = (noteIdx + 1) % notes.length;
  }, 750); // 80bpm roughly (60000/80 = 750ms)
}

function playBrushSound() {
  if (!audioEnabled || !audioCtx) return;
  const t = audioCtx.currentTime;
  const bufSize = audioCtx.sampleRate * 0.1; // 100ms
  const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const output = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) output[i] = Math.random() * 2 - 1;
  
  const whiteNoise = audioCtx.createBufferSource();
  whiteNoise.buffer = buf;
  
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1000;
  
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  
  whiteNoise.connect(filter).connect(gain).connect(audioCtx.destination);
  whiteNoise.start(t);
}

function playHeartbeat() {
  if (!audioEnabled || !audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(50, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.1);
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 0.2);
}

/* ── CANVAS DRAWING ENGINE ── */
function getPos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);
  // Scale to account for CSS sizing vs actual canvas pixel size
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function startDraw(e) {
  e.preventDefault();
  if (UI.btnLetAiDraw.disabled) return; // Block drawing if AI processing
  isDrawing = true;
  const {x, y} = getPos(e, UI.canvasYou);
  ctxYou.beginPath();
  ctxYou.moveTo(x, y);
}

function draw(e) {
  e.preventDefault();
  if (!isDrawing) return;
  const {x, y} = getPos(e, UI.canvasYou);
  ctxYou.lineTo(x, y);
  ctxYou.lineCap = 'round';
  ctxYou.lineJoin = 'round';
  ctxYou.lineWidth = currentBrush.size;
  ctxYou.strokeStyle = currentBrush.isEraser ? '#ffffff' : currentBrush.color;
  ctxYou.stroke();
  
  if (Math.random() < 0.1) playBrushSound();
}

function endDraw(e) {
  e.preventDefault();
  if (!isDrawing) return;
  isDrawing = false;
  ctxYou.closePath();
  saveState();
}

// Events
UI.canvasYou.addEventListener('mousedown', startDraw);
UI.canvasYou.addEventListener('mousemove', draw);
UI.canvasYou.addEventListener('mouseup', endDraw);
UI.canvasYou.addEventListener('mouseout', endDraw);

UI.canvasYou.addEventListener('touchstart', startDraw, {passive: false});
UI.canvasYou.addEventListener('touchmove', draw, {passive: false});
UI.canvasYou.addEventListener('touchend', endDraw, {passive: false});

/* ── TOOLBAR LOGIC ── */
function setColor(color, btnEl) {
  currentBrush.color = color;
  currentBrush.isEraser = false;
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  if(btnEl) btnEl.classList.add('active');
}
function setEraser(btnEl) {
  currentBrush.isEraser = true;
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
}
function setBrushSize(size, btnEl) {
  currentBrush.size = size;
  document.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
}
function clearCanvas() {
  ctxYou.fillStyle = '#ffffff';
  ctxYou.fillRect(0,0,400,500);
  saveState();
}
function saveState() {
  if (undoStack.length > 10) undoStack.shift();
  undoStack.push(ctxYou.getImageData(0,0,400,500));
}
function undo() {
  if (undoStack.length > 1) {
    undoStack.pop(); // pop current
    ctxYou.putImageData(undoStack[undoStack.length - 1], 0, 0);
  } else if (undoStack.length === 1) {
    ctxYou.putImageData(undoStack[0], 0, 0); // back to blank
  }
}

/* ── CLAUDE VISION API INTEGRATION ── */
async function letAiDraw() {
  // Lock UI
  UI.btnLetAiDraw.disabled = true;
  UI.btnLetAiDraw.textContent = "AI is looking...";
  UI.aiWaiting.style.display = 'none';
  UI.aiProcessing.style.display = 'flex';
  
  const hbInterval = setInterval(playHeartbeat, 1000);
  
  // Get Canvas Data (JPEG to save size)
  const base64Image = UI.canvasYou.toDataURL("image/jpeg", 0.7).split(',')[1];
  
  const prompt = `Analyze this drawing done by a user on the left half of a collaborative canvas.
Describe what they drew and the general mood. Then, conceptually complete the picture for the right half of the canvas. 
Describe what shapes and elements I should draw procedurally using HTML5 Canvas to complement their drawing.
Respond ONLY with a raw JSON object (no markdown, no quotes outside JSON). Use this exact structure:
{
  "mood": "Playful / Melancholy / Abstract / etc",
  "style": "geometric" | "abstract" | "curves" | "scattered",
  "palette": ["#hex1", "#hex2", "#hex3"],
  "title": "A creative title combining both halves",
  "compatibility": 85,
  "elements": [
    {"type": "circle" | "curve" | "star", "density": 5, "size": "small" | "large"}
  ]
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } },
              { type: "text", text: prompt }
            ]
          }
        ]
      })
    });
    
    clearInterval(hbInterval);
    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    
    let respText = data.content[0].text.trim();
    if (respText.startsWith('```json')) respText = respText.substring(7);
    if (respText.endsWith('```')) respText = respText.substring(0, respText.length - 3);
    
    const parsed = JSON.parse(respText);
    
    UI.aiProcessing.style.display = 'none';
    UI.btnLetAiDraw.textContent = "AI IS DRAWING...";
    
    // Draw procedural art
    await animateAiDrawing(parsed);
    
    // Show Results
    UI.btnLetAiDraw.style.display = 'none';
    triggerFireworks();
    showReceipt(parsed);
    saveCombinedArtwork();

  } catch (e) {
    clearInterval(hbInterval);
    console.error(e);
    alert('Failed to connect to Claude. Check API key.');
    UI.aiProcessing.style.display = 'none';
    UI.aiWaiting.style.display = 'flex';
    UI.btnLetAiDraw.disabled = false;
    UI.btnLetAiDraw.textContent = "LET AI DRAW ❤️";
  }
}

/* ── PROCEDURAL AI DRAWING ── */
function animateAiDrawing(aiData) {
  return new Promise(resolve => {
    ctxAi.fillStyle = '#ffffff';
    ctxAi.fillRect(0,0,400,500);
    
    const elements = [];
    const colors = aiData.palette || ['#ec4899', '#3b82f6', '#f59e0b'];
    
    // Generate commands based on JSON
    aiData.elements.forEach(el => {
      let count = el.density || 5;
      if (count > 20) count = 20; // safety
      
      for(let i=0; i<count; i++) {
        const sizeBase = el.size === 'large' ? 50 : 15;
        elements.push({
          type: el.type || 'curve',
          color: colors[Math.floor(Math.random() * colors.length)],
          x: Math.random() * 400,
          y: Math.random() * 500,
          size: Math.random() * sizeBase + 10,
          progress: 0,
          speed: Math.random() * 0.05 + 0.02
        });
      }
    });
    
    // If abstract/curves overall style, add some sweeping lines
    if (aiData.style === 'abstract' || aiData.style === 'curves') {
      for(let i=0; i<3; i++) {
        elements.push({
          type: 'bezier',
          color: colors[i%colors.length],
          progress: 0, speed: 0.01,
          pts: [
            Math.random()*400, Math.random()*500,
            Math.random()*400, Math.random()*500,
            Math.random()*400, Math.random()*500,
            Math.random()*400, Math.random()*500
          ]
        });
      }
    }

    // Animation Loop
    let frames = 0;
    function drawFrame() {
      let allDone = true;
      
      elements.forEach(el => {
        if (el.progress >= 1) return;
        allDone = false;
        el.progress += el.speed;
        if (el.progress > 1) el.progress = 1;
        
        ctxAi.strokeStyle = el.color;
        ctxAi.fillStyle = el.color;
        ctxAi.lineWidth = el.size / 5;
        ctxAi.lineCap = 'round';
        
        if (el.type === 'circle') {
          ctxAi.beginPath();
          ctxAi.arc(el.x, el.y, el.size * el.progress, 0, Math.PI*2);
          ctxAi.fill();
        } else if (el.type === 'star') {
          // simplified cross for star
          ctxAi.beginPath();
          const s = el.size * el.progress;
          ctxAi.moveTo(el.x - s, el.y); ctxAi.lineTo(el.x + s, el.y);
          ctxAi.moveTo(el.x, el.y - s); ctxAi.lineTo(el.x, el.y + s);
          ctxAi.stroke();
        } else if (el.type === 'bezier') {
          // draw partial bezier (approximated via lines)
          ctxAi.beginPath();
          ctxAi.moveTo(el.pts[0], el.pts[1]);
          for(let t=0; t<=el.progress; t+=0.05) {
            const bx = bezierPoint(el.pts[0], el.pts[2], el.pts[4], el.pts[6], t);
            const by = bezierPoint(el.pts[1], el.pts[3], el.pts[5], el.pts[7], t);
            ctxAi.lineTo(bx, by);
          }
          ctxAi.stroke();
        } else {
          // curve/line
          ctxAi.beginPath();
          ctxAi.moveTo(el.x, el.y);
          ctxAi.lineTo(el.x + el.size*el.progress, el.y + el.size*el.progress);
          ctxAi.stroke();
        }
        
        if (Math.random() < 0.05) playBrushSound();
      });
      
      frames++;
      if (!allDone && frames < 300) {
        requestAnimationFrame(drawFrame);
      } else {
        resolve();
      }
    }
    
    drawFrame();
  });
}

function bezierPoint(p0, p1, p2, p3, t) {
  const cX = 3 * (p1 - p0);
  const bX = 3 * (p2 - p1) - cX;
  const aX = p3 - p0 - cX - bX;
  return (aX * Math.pow(t, 3)) + (bX * Math.pow(t, 2)) + (cX * t) + p0;
}

/* ── RESULTS & RECEIPT ── */
function triggerFireworks() {
  const anchor = document.getElementById('fireworksAnchor');
  const hearts = ['❤️', '💖', '✨', '🎨'];
  for (let i = 0; i < 15; i++) {
    const el = document.createElement('div');
    el.className = 'spark';
    el.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 150 + 50;
    el.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
    el.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
    anchor.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
}

function showReceipt(aiData) {
  document.getElementById('receiptTitle').textContent = aiData.title || 'Untitled Masterpiece';
  document.getElementById('receiptMood').textContent = aiData.mood || 'Abstract';
  document.getElementById('receiptScore').textContent = aiData.compatibility || Math.floor(Math.random()*20 + 80);
  UI.dateReceipt.style.display = 'block';
  
  dateCount++;
  localStorage.setItem('doodle_date_count', dateCount);
}

function resetDate() {
  ctxYou.fillStyle = '#ffffff'; ctxYou.fillRect(0,0,400,500);
  ctxAi.fillStyle = '#ffffff'; ctxAi.fillRect(0,0,400,500);
  undoStack = []; saveState();
  
  UI.dateReceipt.style.display = 'none';
  UI.btnLetAiDraw.style.display = 'inline-block';
  UI.btnLetAiDraw.disabled = false;
  UI.btnLetAiDraw.textContent = "LET AI DRAW ❤️";
  UI.aiWaiting.style.display = 'flex';
  
  document.getElementById('dateCounter').textContent = dateCount;
}

/* ── GALLERY EXPORT ── */
function shareArtwork() {
  const combined = document.createElement('canvas');
  combined.width = 800; combined.height = 500;
  const ctxC = combined.getContext('2d');
  
  ctxC.drawImage(UI.canvasYou, 0, 0);
  ctxC.drawImage(UI.canvasAi, 400, 0);
  
  // Draw divider
  ctxC.beginPath();
  ctxC.setLineDash([5, 15]);
  ctxC.moveTo(400, 0);
  ctxC.lineTo(400, 500);
  ctxC.strokeStyle = '#cbd5e1';
  ctxC.lineWidth = 2;
  ctxC.stroke();
  
  const link = document.createElement('a');
  link.download = `DoodleDate_${Date.now()}.png`;
  link.href = combined.toDataURL('image/png');
  link.click();
}

function saveCombinedArtwork() {
  const combined = document.createElement('canvas');
  combined.width = 800; combined.height = 500;
  const ctxC = combined.getContext('2d');
  ctxC.drawImage(UI.canvasYou, 0, 0);
  ctxC.drawImage(UI.canvasAi, 400, 0);
  
  const dataUrl = combined.toDataURL('image/jpeg', 0.5); // compress
  const dateStr = new Date().toLocaleDateString();
  
  let history = JSON.parse(localStorage.getItem('doodle_gallery')) || [];
  history.unshift({ img: dataUrl, date: dateStr });
  if (history.length > 5) history.pop();
  
  localStorage.setItem('doodle_gallery', JSON.stringify(history));
  loadGallery();
}

function loadGallery() {
  let history = JSON.parse(localStorage.getItem('doodle_gallery')) || [];
  UI.galleryGrid.innerHTML = '';
  if (history.length === 0) {
    UI.galleryGrid.innerHTML = '<p class="empty-gallery">No dates yet. Grab a brush!</p>';
    return;
  }
  
  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.innerHTML = `<img src="${item.img}" alt="Combined Artwork">
                     <div class="gallery-date">${item.date}</div>`;
    UI.galleryGrid.appendChild(div);
  });
}
