import { SCENES, DEFAULT_SCENE_ID, getScene, sceneText } from './scenes.mjs';

const params = new URLSearchParams(location.search);
const cleanView = params.get('clean') === '1';
const initialSceneId = params.get('scene') || DEFAULT_SCENE_ID;
const initialLang = params.get('lang') === 'fr' ? 'fr' : 'en';
const initialWidth = clampInt(params.get('w'), 300, 2560, 1280);
const initialHeight = clampInt(params.get('h'), 480, 2560, 720);
const initialAnim = params.get('anim') !== '0';

const GLOW_DEFAULTS = { rb: 6, ra: .35, hb: 14, ha: .5, go: .65 };
const glow = {
  rb: clampFloat(params.get('rb'), 0, 20, GLOW_DEFAULTS.rb),
  ra: clampFloat(params.get('ra'), 0, 1, GLOW_DEFAULTS.ra),
  hb: clampFloat(params.get('hb'), 0, 40, GLOW_DEFAULTS.hb),
  ha: clampFloat(params.get('ha'), 0, 1, GLOW_DEFAULTS.ha),
  go: clampFloat(params.get('go'), 0, 1, GLOW_DEFAULTS.go),
};

const $ = selector => document.querySelector(selector);
const viewport = $('#shotViewport');
const measure = $('#stageMeasure');
const stageArea = $('#studioStageArea');
const sceneList = $('#sceneList');

let sceneId = getScene(initialSceneId).id;
let lang = initialLang;
let width = initialWidth;
let height = initialHeight;
let animations = initialAnim;
let zoom = 1;

if (cleanView) document.body.classList.add('clean-view');

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function clampFloat(value, min, max, fallback) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function applyGlowVars() {
  const root = document.documentElement.style;
  root.setProperty('--glow-rim-blur', `${glow.rb}px`);
  root.setProperty('--glow-rim-alpha', glow.ra);
  root.setProperty('--glow-halo-blur', `${glow.hb}px`);
  root.setProperty('--glow-halo-alpha', glow.ha);
  root.setProperty('--glow-opacity', glow.go);
}

function groupScenes(query = '') {
  const needle = query.trim().toLocaleLowerCase();
  const filtered = needle
    ? SCENES.filter(scene => [scene.id, scene.category, scene.title.fr, scene.title.en, scene.short.fr, scene.short.en]
      .join(' ').toLocaleLowerCase().includes(needle))
    : SCENES;
  const groups = new Map();
  for (const scene of filtered) {
    if (!groups.has(scene.category)) groups.set(scene.category, []);
    groups.get(scene.category).push(scene);
  }
  return groups;
}

function renderSceneList(query = '') {
  sceneList.innerHTML = [...groupScenes(query)].map(([category, scenes]) => `
    <div class="studio-scene-group">
      <div class="studio-scene-group-title">${category.toUpperCase()}</div>
      ${scenes.map(scene => `<button class="studio-scene-btn${scene.id === sceneId ? ' active' : ''}" data-scene="${scene.id}">
        <span class="studio-scene-icon">${scene.icon}</span>
        <span><strong>${sceneText(scene,'title',lang)}</strong><small>${sceneText(scene,'short',lang)}</small></span>
      </button>`).join('')}
    </div>`).join('') || `<div style="padding:18px;color:#6f798a;font-size:10px">Aucune scène.</div>`;

  sceneList.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click', () => {
    sceneId = button.dataset.scene;
    renderAll();
  }));
}

function renderShot({ replay = false } = {}) {
  const scene = getScene(sceneId);
  viewport.style.width = `${width}px`;
  viewport.style.height = `${height}px`;
  viewport.classList.toggle('no-animations', !animations);
  viewport.innerHTML = scene.render({ lang, replay, width, height });
  viewport.dataset.scene = scene.id;
  bindSceneInteractions();
}

function bindSceneInteractions() {
  viewport.querySelectorAll('.pg-switch').forEach(toggle => toggle.addEventListener('click', () => toggle.classList.toggle('on')));
  viewport.querySelectorAll('.pg-action-btn').forEach(button => button.addEventListener('click', () => {
    button.animate?.([{transform:'scale(1)'},{transform:'scale(.97)'},{transform:'scale(1)'}], {duration:160});
  }));
}

function updateMeta() {
  const scene = getScene(sceneId);
  $('#sceneCategory').textContent = scene.category.toUpperCase();
  $('#sceneTitle').textContent = sceneText(scene,'title',lang);
  $('#sceneDescription').textContent = sceneText(scene,'description',lang);
  $('#sceneCounter').textContent = `${SCENES.findIndex(s => s.id === sceneId) + 1} / ${SCENES.length}`;
  $('#resolutionLabel').textContent = `${width} × ${height}px`;
  $('#zoomLabel').textContent = `${Math.round(zoom * 100)}%`;
  document.title = `PokéGang Screenshot Studio — ${sceneText(scene,'title',lang)}`;
}

function fitStage() {
  if (cleanView || !stageArea) { zoom = 1; measure.style.transform = 'none'; return; }
  const rect = stageArea.getBoundingClientRect();
  const pad = 28;
  zoom = Math.min(1, (rect.width - pad * 2) / width, (rect.height - pad * 2) / height);
  zoom = Math.max(.1, zoom);
  measure.style.width = `${width}px`;
  measure.style.height = `${height}px`;
  measure.style.transform = `scale(${zoom})`;
}

function syncInputs() {
  $('#languageSelect').value = lang;
  $('#widthInput').value = String(width);
  $('#heightInput').value = String(height);
  const exact = [...$('#sizePreset').options].find(option => option.value === `${width}x${height}`);
  if (exact) $('#sizePreset').value = exact.value;
  $('#animBtn').classList.toggle('active', animations);
  $('#animBtn').setAttribute('aria-pressed', String(animations));
  syncGlowInputs();
}

function syncGlowInputs() {
  $('#glowRimBlur').value = String(glow.rb);
  $('#glowRimBlurVal').textContent = `${glow.rb}px`;
  $('#glowRimAlpha').value = String(glow.ra);
  $('#glowRimAlphaVal').textContent = glow.ra.toFixed(2);
  $('#glowHaloBlur').value = String(glow.hb);
  $('#glowHaloBlurVal').textContent = `${glow.hb}px`;
  $('#glowHaloAlpha').value = String(glow.ha);
  $('#glowHaloAlphaVal').textContent = glow.ha.toFixed(2);
  $('#glowOpacity').value = String(glow.go);
  $('#glowOpacityVal').textContent = glow.go.toFixed(2);
}

function setGlowParams(url) {
  url.searchParams.set('rb', glow.rb);
  url.searchParams.set('ra', glow.ra);
  url.searchParams.set('hb', glow.hb);
  url.searchParams.set('ha', glow.ha);
  url.searchParams.set('go', glow.go);
}

function persistUrl() {
  if (cleanView) return;
  const next = new URL(location.href);
  next.searchParams.set('scene', sceneId);
  next.searchParams.set('lang', lang);
  next.searchParams.set('w', width);
  next.searchParams.set('h', height);
  next.searchParams.set('anim', animations ? '1' : '0');
  setGlowParams(next);
  next.searchParams.delete('clean');
  history.replaceState(null, '', next);
}

function renderAll({ replay = false } = {}) {
  renderSceneList($('#sceneSearch')?.value || '');
  renderShot({ replay });
  syncInputs();
  fitStage();
  updateMeta();
  persistUrl();
}

function openCleanView() {
  const url = new URL(location.href);
  url.searchParams.set('clean','1');
  url.searchParams.set('scene',sceneId);
  url.searchParams.set('lang',lang);
  url.searchParams.set('w',width);
  url.searchParams.set('h',height);
  url.searchParams.set('anim',animations?'1':'0');
  setGlowParams(url);
  window.open(url, '_blank', 'noopener');
}

async function copyDirectLink() {
  const url = new URL(location.href);
  url.searchParams.set('scene',sceneId);
  url.searchParams.set('lang',lang);
  url.searchParams.set('w',width);
  url.searchParams.set('h',height);
  url.searchParams.set('anim',animations?'1':'0');
  setGlowParams(url);
  url.searchParams.delete('clean');
  try {
    await navigator.clipboard.writeText(url.toString());
    const btn = $('#copyLinkBtn');
    const old = btn.textContent;
    btn.textContent = 'Copié ✓';
    setTimeout(() => { btn.textContent = old; }, 1200);
  } catch {
    prompt('Lien de la scène', url.toString());
  }
}

function moveScene(delta) {
  const current = SCENES.findIndex(scene => scene.id === sceneId);
  sceneId = SCENES[(current + delta + SCENES.length) % SCENES.length].id;
  renderAll();
}

function bindUi() {
  $('#sceneSearch').addEventListener('input', event => renderSceneList(event.target.value));
  $('#languageSelect').addEventListener('change', event => { lang = event.target.value === 'fr' ? 'fr' : 'en'; renderAll(); });
  $('#sizePreset').addEventListener('change', event => {
    const [w,h] = event.target.value.split('x').map(Number);
    width = w; height = h; renderAll();
  });
  $('#widthInput').addEventListener('change', event => { width = clampInt(event.target.value,300,2560,width); renderAll(); });
  $('#heightInput').addEventListener('change', event => { height = clampInt(event.target.value,480,2560,height); renderAll(); });
  $('#fitBtn').addEventListener('click', fitStage);
  $('#animBtn').addEventListener('click', () => { animations = !animations; renderAll(); });
  $('#reloadBtn').addEventListener('click', () => renderAll({ replay:true }));
  $('#cleanBtn').addEventListener('click', openCleanView);
  $('#copyLinkBtn').addEventListener('click', copyDirectLink);
  $('#glowRimBlur').addEventListener('input', event => { glow.rb = clampFloat(event.target.value,0,20,glow.rb); applyGlowVars(); syncGlowInputs(); persistUrl(); });
  $('#glowRimAlpha').addEventListener('input', event => { glow.ra = clampFloat(event.target.value,0,1,glow.ra); applyGlowVars(); syncGlowInputs(); persistUrl(); });
  $('#glowHaloBlur').addEventListener('input', event => { glow.hb = clampFloat(event.target.value,0,40,glow.hb); applyGlowVars(); syncGlowInputs(); persistUrl(); });
  $('#glowHaloAlpha').addEventListener('input', event => { glow.ha = clampFloat(event.target.value,0,1,glow.ha); applyGlowVars(); syncGlowInputs(); persistUrl(); });
  $('#glowOpacity').addEventListener('input', event => { glow.go = clampFloat(event.target.value,0,1,glow.go); applyGlowVars(); syncGlowInputs(); persistUrl(); });
  $('#glowResetBtn').addEventListener('click', () => { Object.assign(glow, GLOW_DEFAULTS); applyGlowVars(); syncGlowInputs(); persistUrl(); });
  window.addEventListener('resize', fitStage);
  window.addEventListener('keydown', event => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); moveScene(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); moveScene(1); }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); renderAll({ replay:true }); }
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); openCleanView(); }
  });
}

applyGlowVars();
if (!cleanView) bindUi();
renderAll();
