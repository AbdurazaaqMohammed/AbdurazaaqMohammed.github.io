import { makeChunkBlobs, computeChunks } from './transcriber-audio.js';
import { geminiUploadChunk, geminiWaitActive, geminiGenerate, openRouterChat, groqTranscribe, hfTranscribe } from './transcriber-api.js';
import { searchWikimediaImages, renderQuoteCard, renderDeck, exportPng, exportDeckPdf, downloadHtmlDeck } from './transcriber-visuals.js';
import { encryptKeys, decryptKeys, hasKeystore, loadKeystore, saveKeystore, clearKeystore } from './transcriber-crypto.js';

const DB_NAME = 'scribe_db';
const DB_VERSION = 1;

const PROVIDER_LABELS = { gemini: 'Gemini', openrouter: 'OpenRouter', groq: 'Groq Whisper', huggingface: 'HF Whisper' };

const TRANSCRIBE_PROVIDERS = ['gemini', 'groq', 'huggingface'];
const TEXT_PROVIDERS = ['gemini', 'openrouter'];

const CURATED_GEMINI_MODELS = [
	{ id: 'gemini-3.5-flash-lite', note: 'Fast + cheap (default)' },
	{ id: 'gemini-3.5-flash', note: 'Balanced quality' },
	{ id: 'gemini-3.6-flash', note: 'Newer flash' },
	{ id: 'gemini-3.7-flash', note: 'Newer flash' },
	{ id: 'gemini-3.8-flash', note: 'Newer flash' },
	{ id: 'gemini-flash-latest', note: 'Latest Flash version' },
	{ id: 'gemini-flash-lite-latest', note: 'Latest Flash Lite version' }
];

const RETIRED_MODEL_PATTERNS = [/2\.0-flash/i, /2\.5-flash-lite-preview/i, /2\.5-flash-preview/i, /preview-0[45]/i, /image-preview/i, /embedding/i, /tts/i, /aqa/i];

const DEFAULT_FALLBACKS = [
	{ provider: 'gemini', model: 'gemini-3.5-flash-lite' },
	{ provider: 'groq', model: 'whisper-large-v3-turbo' },
	{ provider: 'gemini', model: 'gemini-3.5-flash' }
];

const WHISPER_MERGE_PROMPT = `The transcript below was assembled from overlapping audio chunks by an automatic speech recognition model. Clean it up:
1. Remove duplicated text at chunk boundaries.
2. Restore proper punctuation and paragraphing.
3. Where Arabic phrases appear romanized or in Latin letters, convert them back into Arabic script with full tashkeel.
4. Do not add content that is not in the transcript.

---

{transcript}

---

Output the cleaned, continuous transcript.`;

const DEFAULT_PROFILES = [
	{
		id: 'p_islamic_lecture',
		name: 'Islamic lecture (English + Arabic)',
		type: 'transcribe',
		provider: 'gemini',
		model: 'gemini-3.5-flash-lite',
		chunkDuration: 1200,
		overlap: 10,
		temperature: 0.2,
		language: '',
		keepDialect: true,
		dialectName: 'Trinidadian English',
		prompt: `Transcribe this audio exactly as spoken. The lecture is in English, but the speaker also quotes the Qur'an and Islamic texts in Arabic. Follow these rules:
1. Write all Arabic quotations and Arabic phrases in Arabic script, with full and correct tashkeel (vowel marks). Never romanize them.
2. Keep an Arabic word in English spelling only when it is used as a common English word in the sentence (for example "Allah tells us in the Quran").
3. The audio may contain digital artifacts from the export process. Do not stop early; keep transcribing until the audio is truly finished.
4. Use only what is in the audio. Do not add anything from other sources. No markup, no graphics.`,
		speakers: '',
		header: '',
		mergePrompt: `The transcript below was assembled from overlapping audio chunks. Clean it up:
1. Remove duplicated text at chunk boundaries.
2. Fix broken sentences and obvious transcription errors using context.
3. Any Arabic that appears romanized or in Latin letters (for example "bismillah" or "subhanallah") must be converted back into Arabic script with full correct tashkeel.
4. Keep common Arabic words that were used as English words (Allah, Quran, salaam) in their English spelling.
5. Keep the wording and dialect exactly as spoken. Do not add anything that is not in the transcript. No markup, no graphics.

---

{transcript}

---

Output the cleaned, continuous transcript.`
	},
	{
		id: 'p_whisper_hf',
		name: 'Whisper Large v3 (Hugging Face) — free fallback',
		type: 'transcribe',
		provider: 'huggingface',
		model: 'openai/whisper-large-v3',
		chunkDuration: 1200,
		overlap: 10,
		temperature: 0.1,
		language: '',
		keepDialect: false,
		dialectName: '',
		prompt: `Transcribe the audio word-for-word. Do not add content that is not in the audio. No markup, no graphics.`,
		speakers: '',
		header: '',
		mergePrompt: WHISPER_MERGE_PROMPT,
	},
	{
		id: 'p_interview',
		name: 'General interview',
		type: 'transcribe',
		provider: 'groq',
		model: 'whisper-large-v3-turbo',
		chunkDuration: 1200,
		overlap: 10,
		temperature: 0.1,
		language: '',
		keepDialect: false,
		dialectName: '',
		prompt: `Transcribe this interview or conversation segment accurately. Use clear paragraphing. Remove filler words such as "um", "uh", "like", "you know" only when used as fillers. Preserve the speaker's meaning and wording otherwise.

Do not insert graphics or markup text. Use only the audio content.`,
		speakers: '',
		header: '',
		mergePrompt: `Below is a transcript assembled from multiple audio chunks. Please clean up duplicate text at chunk boundaries, ensure consistent formatting, and fix obvious errors.

---

{transcript}

---

Output the cleaned transcript.`,
	},
	{
		id: 'p_conversation',
		name: 'Multi-speaker conversation',
		type: 'transcribe',
		provider: 'groq',
		model: 'whisper-large-v3-turbo',
		chunkDuration: 1200,
		overlap: 10,
		temperature: 0.1,
		language: '',
		keepDialect: false,
		dialectName: '',
		prompt: `Transcribe this audio conversation. Use bold speaker labels (e.g. **Speaker 1:**, **Speaker 2:**). Clean up filler words and false starts only when they hurt readability. Preserve the substance of what each person says.

Do not insert graphics or markup text.`,
		speakers: 'Speaker 1, Speaker 2',
		header: '',
		mergePrompt: `Below is a transcript assembled from multiple audio chunks. Please clean up duplicate text at chunk boundaries, ensure consistent speaker labels, and fix obvious errors.

---

{transcript}

---

Output the cleaned transcript with speaker labels.`,
	},
	{
		id: 'p_verbatim',
		name: 'Simple verbatim',
		type: 'transcribe',
		provider: 'groq',
		model: 'whisper-large-v3-turbo',
		chunkDuration: 1200,
		overlap: 10,
		temperature: 0.1,
		language: '',
		keepDialect: false,
		dialectName: '',
		prompt: `Transcribe the audio word-for-word.

Do not add graphics, markup, or anything that is not in the audio.`,
		speakers: '',
		header: '',
		mergePrompt: `Assemble the following chunk transcripts into one continuous transcript. Remove only exact duplicated overlap text.

---

{transcript}

---

Output the full transcript.`,
	},
	{
		id: 'p_lecture_summary',
		name: 'Lecture summary',
		type: 'summarize',
		provider: 'gemini',
		model: 'gemini-3.5-flash-lite',
		chunkDuration: 1200,
		overlap: 10,
		temperature: 0.3,
		language: '',
		keepDialect: false,
		dialectName: '',
		prompt: `Summarize the following text in clear paragraphs. Preserve important Arabic phrases and names if present. Capture the main arguments and conclusions without unnecessary detail.`,
		speakers: '',
		header: '',
		mergePrompt: '',
	},
	{
		id: 'p_text_format',
		name: 'Slide & card formatting',
		type: 'format',
		provider: 'gemini',
		model: 'gemini-3.5-flash-lite',
		chunkDuration: 1200,
		overlap: 10,
		temperature: 0.3,
		language: '',
		keepDialect: false,
		dialectName: '',
		prompt: '',
		speakers: '',
		header: '',
		mergePrompt: '',
	}
];

let state = {
	keys: {},
	unlocked: false,
	cachedPassphrase: null,
	lockTimer: null,
	profiles: [],
	currentProfileId: null,
	settings: {},
	currentFile: null,
	audioInfo: null,
	visualSelectedBg: null,
	visualMode: 'card',
	currentVisualEl: null
};
const AUTOLOCK_MS = 15 * 60 * 1000;
function resetLockTimer() {
	if (!state.unlocked) return;
	clearTimeout(state.lockTimer);
	state.lockTimer = setTimeout(() => {
		doLock();
		toast('Locked automatically after 15 min idle');
	}, AUTOLOCK_MS);
}
for (const evt of ['click', 'keydown', 'pointerdown']) {
	document.addEventListener(evt, () => { if (state.unlocked) resetLockTimer(); }, { passive: true });
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function sha256Hex(input) {
	const data = new TextEncoder().encode(input);
	const hash = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function fmtTime(s) {
	if (!isFinite(s) || s < 0) return '--:--';
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = Math.floor(s % 60);
	return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}` : `${m}:${sec.toString().padStart(2,'0')}`;
}
function toast(msg, dur = 2000) {
	const t = document.getElementById('toast');
	t.textContent = msg; t.classList.add('show');
	clearTimeout(t._to); t._to = setTimeout(() => t.classList.remove('show'), dur);
}
function escapeHtml(str) {
	return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function showError(title, err) {
	try {
		const card = document.getElementById('card-errors');
		const log = document.getElementById('error-log');
		const count = document.getElementById('error-count');
		if (!card || !log) { toast(title + (err?.message ? ': ' + err.message : ''), 5000); return; }
		card.style.display = 'block';
		const item = document.createElement('div');
		item.className = 'tr-error-item';
		const time = new Date().toLocaleTimeString();
		const message = err?.message || (typeof err === 'string' ? err : '');
		const details = err?.stack || (typeof err === 'object' ? JSON.stringify(err, null, 2) : '');
		item.innerHTML = `<div class="tr-error-head"><span class="tr-error-title">${escapeHtml(title)}</span><span class="tr-error-time">${escapeHtml(time)}</span></div>` +
			(message ? `<p class="tr-error-msg">${escapeHtml(message)}</p>` : '') +
			(details && details !== message ? `<pre class="tr-error-details">${escapeHtml(details.slice(0, 4000))}</pre>` : '') +
			`<div class="tr-error-actions"><button type="button" class="tr-btn tr-error-copy">Copy details</button><button type="button" class="tr-btn tr-error-dismiss">Dismiss</button></div>`;
		item.querySelector('.tr-error-dismiss').addEventListener('click', () => {
			item.remove();
			updateErrorCount();
			if (!log.children.length) card.style.display = 'none';
		});
		item.querySelector('.tr-error-copy').addEventListener('click', async () => {
			try { await navigator.clipboard.writeText(`${title}\n${message}\n${details}`); toast('Error details copied'); }
			catch { toast('Copy failed'); }
		});
		log.prepend(item);
		updateErrorCount();
		try { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
	} catch (e) { console.error('showError failed', e); }
}
function updateErrorCount() {
	const log = document.getElementById('error-log');
	const count = document.getElementById('error-count');
	if (log && count) count.textContent = log.children.length ? `(${log.children.length})` : '';
}
function failProgress(id, message) {
	const el = document.getElementById(id);
	if (!el) return;
	el.classList.add('active');
	el.classList.remove('indeterminate');
	const fill = el.querySelector('.tr-progress-fill');
	if (fill) fill.style.width = '0%';
	const text = el.querySelector('.tr-progress-text');
	if (text) text.textContent = message;
}
function $(id) { return document.getElementById(id); }
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return root.querySelectorAll(sel); }

function downloadText(filename, text) {
	const blob = new Blob([text], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url; a.download = filename; a.click();
	URL.revokeObjectURL(url);
}

function setTheme(name) {
	document.body.className = name + '-mode';
	document.getElementById('canvas').style.display = (name === 'stars') ? 'block' : 'none';
	for (const b of qsa('.tr-theme-btn')) {
		b.classList.toggle('active', b.dataset.theme === name);
	}
	state.settings.theme = name;
	saveSettings();
}

function loadSettings() {
	try { state.settings = JSON.parse(localStorage.getItem('scribe_settings')) || {}; } catch { state.settings = {}; }
	if (!Array.isArray(state.settings.fallbackModels)) state.settings.fallbackModels = JSON.parse(JSON.stringify(DEFAULT_FALLBACKS));
	setTheme(state.settings.theme || 'stars');
	if (state.settings.activeTab) switchTab(state.settings.activeTab);
}
function saveSettings() { localStorage.setItem('scribe_settings', JSON.stringify(state.settings)); }

function getFallbackModels() {
	return (state.settings.fallbackModels || []).filter(f => f && f.provider && f.model);
}
function sameSpec(a, b) { return a && b && a.provider === b.provider && a.model === b.model; }
function buildChain(primarySpec, allowedProviders, autoFallback) {
	const chain = [primarySpec];
	if (autoFallback) {
		for (const f of getFallbackModels()) {
			if (!allowedProviders.includes(f.provider)) continue;
			if (chain.some(s => sameSpec(s, f))) continue;
			chain.push({ provider: f.provider, model: f.model });
		}
	}
	return chain;
}

function inferProfileType(p) {
	if (p.type) return p.type;
	if (p.provider === 'groq' || p.provider === 'huggingface') return 'transcribe';
	if (/\bsummar/i.test(p.name || '') || /summar/i.test(p.prompt || '')) return 'summarize';
	return 'transcribe';
}

function normalizeProfiles(list) {
	return list.map(p => {
		p.type = inferProfileType(p);
		if (typeof p.language !== 'string') p.language = '';
		return p;
	});
}

function loadProfiles() {
	let profiles;
	try { profiles = JSON.parse(localStorage.getItem('scribe_profiles')); } catch { profiles = null; }
	if (!profiles || !profiles.length) {
		profiles = JSON.parse(JSON.stringify(DEFAULT_PROFILES));
	}
	state.profiles = normalizeProfiles(profiles);
	saveProfiles();
}
function saveProfiles() { localStorage.setItem('scribe_profiles', JSON.stringify(state.profiles)); }

function profileById(id) { return state.profiles.find(p => p.id === id); }
const PROFILE_TYPE_LABELS = { transcribe: 'Transcribe', summarize: 'Summarize', format: 'Visualize' };
const SELECT_TYPES = {
	'transcribe-profile': 'transcribe',
	'summarize-profile': 'summarize',
	'visual-format-profile': 'format'
};

function populateProfileSelects() {
	for (const sel of [$('transcribe-profile'), $('summarize-profile'), $('visual-format-profile')]) {
		const prev = sel.value;
		sel.innerHTML = '';
		for (const p of state.profiles.filter(p => p.type === SELECT_TYPES[sel.id])) {
			const opt = document.createElement('option');
			opt.value = p.id;
			opt.textContent = p.name;
			sel.appendChild(opt);
		}
		if (prev && profileById(prev) && Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
	}
}

function renderProfileList() {
	const list = $('profile-list');
	list.innerHTML = '';
	for (const type of ['transcribe', 'summarize', 'format']) {
		const head = document.createElement('li');
		head.className = 'tr-profile-group';
		head.textContent = PROFILE_TYPE_LABELS[type];
		list.appendChild(head);
		const group = state.profiles.filter(p => p.type === type);
		if (!group.length) {
			const empty = document.createElement('li');
			empty.className = 'tr-profile-empty';
			empty.textContent = 'No profiles yet';
			list.appendChild(empty);
			continue;
		}
		for (const p of group) {
			const li = document.createElement('li');
			li.className = 'tr-profile-item' + (p.id === state.currentProfileId ? ' active' : '');
			li.dataset.id = p.id;
			const icon = type === 'transcribe' ? '🎙' : type === 'summarize' ? '📝' : '🎨';
			li.innerHTML = `<span class="tr-profile-icon">${icon}</span><span class="tr-profile-name">${escapeHtml(p.name)}</span><span class="tr-profile-provider">${PROVIDER_LABELS[p.provider]}</span>`;
			li.addEventListener('click', () => loadProfileEditor(p.id));
			list.appendChild(li);
		}
	}
}

function applyProfileTypeUI(type) {
	const providers = type === 'transcribe' ? ['gemini', 'groq', 'huggingface'] : ['gemini', 'openrouter'];
	const sel = $('profile-provider');
	const cur = sel.value;
	sel.innerHTML = '';
	for (const prov of providers) {
		const opt = document.createElement('option');
		opt.value = prov;
		opt.textContent = PROVIDER_LABELS[prov];
		sel.appendChild(opt);
	}
	if (providers.includes(cur)) sel.value = cur;
	const isTranscribe = type === 'transcribe';
	$('profile-transcribe-only').style.display = isTranscribe ? 'grid' : 'none';
	$('profile-dialect-row').style.display = isTranscribe ? 'flex' : 'none';
	$('profile-speakers-row').style.display = isTranscribe ? 'block' : 'none';
	$('profile-header-row').style.display = isTranscribe ? 'block' : 'none';
}

function loadProfileEditor(id) {
	state.currentProfileId = id;
	renderProfileList();
	const p = profileById(id);
	if (!p) return;
	$('profile-type').value = p.type || 'transcribe';
	applyProfileTypeUI(p.type || 'transcribe');
	const provSel = $('profile-provider');
	if (Array.from(provSel.options).some(o => o.value === (p.provider || 'gemini'))) provSel.value = p.provider;
	$('profile-name').value = p.name || '';
	$('profile-model').value = p.model || '';
	$('profile-chunk-duration').value = p.chunkDuration ?? 1200;
	$('profile-overlap').value = p.overlap ?? 10;
	$('profile-language').value = p.language || '';
	$('profile-temperature').value = p.temperature ?? 0.2;
	$('profile-keep-dialect').checked = !!p.keepDialect;
	$('profile-dialect-name').value = p.dialectName || '';
	$('profile-prompt').value = p.prompt || '';
	$('profile-speakers').value = p.speakers || '';
	$('profile-header').value = p.header || '';
}

function createNewProfile(type = 'transcribe') {
	const p = {
		id: uid(),
		name: 'New profile',
		type,
		provider: type === 'transcribe' ? 'groq' : 'gemini',
		model: type === 'transcribe' ? 'whisper-large-v3-turbo' : 'gemini-3.5-flash-lite',
		chunkDuration: 1200,
		overlap: 10,
		temperature: type === 'transcribe' ? 0.1 : 0.3,
		language: '',
		keepDialect: false,
		dialectName: '',
		prompt: type === 'transcribe'
			? 'Transcribe this audio exactly as spoken. Do not add content that is not in the audio. No markup, no graphics.'
			: type === 'summarize'
				? 'Summarize the following text. Capture the main points without unnecessary detail.'
				: '',
		speakers: '',
		header: '',
		mergePrompt: type === 'transcribe' ? WHISPER_MERGE_PROMPT : ''
	};
	state.profiles.push(p);
	saveProfiles();
	renderProfileList();
	loadProfileEditor(p.id);
	populateProfileSelects();
}

function saveCurrentProfile() {
	if (!state.currentProfileId) return;
	const p = profileById(state.currentProfileId);
	p.name = $('profile-name').value.trim() || 'Untitled';
	p.type = $('profile-type').value;
	p.provider = $('profile-provider').value;
	p.model = $('profile-model').value.trim();
	p.chunkDuration = parseInt($('profile-chunk-duration').value, 10) || 1200;
	p.overlap = parseInt($('profile-overlap').value, 10) || 10;
	p.language = $('profile-language').value.trim().toLowerCase();
	p.temperature = parseFloat($('profile-temperature').value) ?? 0.2;
	p.keepDialect = $('profile-keep-dialect').checked;
	p.dialectName = $('profile-dialect-name').value.trim();
	p.prompt = $('profile-prompt').value.trim();
	p.speakers = $('profile-speakers').value.trim();
	p.header = $('profile-header').value.trim();
	saveProfiles();
	renderProfileList();
	populateProfileSelects();
	toast('Profile saved');
}

function deleteCurrentProfile() {
	if (!state.currentProfileId) return;
	if (!confirm('Delete this profile?')) return;
	state.profiles = state.profiles.filter(p => p.id !== state.currentProfileId);
	state.currentProfileId = state.profiles[0]?.id || null;
	saveProfiles();
	renderProfileList();
	if (state.currentProfileId) loadProfileEditor(state.currentProfileId);
	populateProfileSelects();
}

function exportProfiles() {
	const data = { profiles: state.profiles, exportedAt: new Date().toISOString() };
	downloadText('transcriber-profiles.json', JSON.stringify(data, null, 2));
}

function importProfiles(file) {
	const reader = new FileReader();
	reader.onload = () => {
		try {
			const data = JSON.parse(reader.result);
			if (Array.isArray(data)) state.profiles = normalizeProfiles(data);
			else if (Array.isArray(data.profiles)) state.profiles = normalizeProfiles(data.profiles);
			else throw new Error('No profiles array found');
			saveProfiles();
			renderProfileList();
			populateProfileSelects();
			loadProfileEditor(state.profiles[0].id);
			toast('Profiles imported');
		} catch (e) { showError('Profile import failed', e); toast('Import failed — see Errors panel for details', 5000); }
	};
	reader.readAsText(file);
}

async function doUnlock() {
	const pass = $('passphrase').value || state.cachedPassphrase;
	if (!pass) { toast('Enter a passphrase'); return; }
	const store = loadKeystore();
	if (store) {
		try {
			state.keys = await decryptKeys(pass, store);
			state.cachedPassphrase = pass;
			state.unlocked = true;
			$('passphrase').value = '';
			renderKeyUI();
			resetLockTimer();
			if (!store.v || store.v < 2) {
				saveKeystore(await encryptKeys(pass, state.keys));
				toast('Keys unlocked (store upgraded to fixed encryption)');
			} else {
				toast('Keys unlocked');
			}
			return;
		} catch { toast('Wrong passphrase or corrupted store'); }
	} else {
		state.keys = {};
		state.cachedPassphrase = pass;
		state.unlocked = true;
		saveKeystore(await encryptKeys(pass, state.keys));
		$('passphrase').value = '';
		renderKeyUI();
		resetLockTimer();
		toast('Passphrase set');
	}
}

function doLock() {
	state.unlocked = false;
	state.keys = {};
	state.cachedPassphrase = null;
	clearTimeout(state.lockTimer);
	state.lockTimer = null;
	$('passphrase').value = '';
	for (const input of qsa('.key-input')) { input.value = ''; }
	renderKeyUI();
	toast('Locked');
}

async function saveKeys() {
	if (!state.unlocked) { toast('Unlock first'); return; }
	const pass = $('passphrase').value || state.cachedPassphrase;
	if (!pass) { toast('Passphrase required to encrypt'); return; }
	const keys = {};
	for (const input of qsa('.key-input')) {
		keys[input.dataset.key] = input.value.trim();
	}
	state.keys = keys;
	state.cachedPassphrase = pass;
	saveKeystore(await encryptKeys(pass, keys));
	$('passphrase').value = '';
	resetLockTimer();
	toast('Encrypted keys saved');
}

function renderKeyUI() {
	const badge = $('lock-badge');
	const inputs = $('keys-inputs');
	const passphraseRow = $('passphrase-row');
	if (state.unlocked) {
		badge.textContent = 'Unlocked';
		badge.classList.add('ready');
		inputs.style.display = 'grid';
		for (const input of qsa('.key-input')) {
			input.value = state.keys[input.dataset.key] || '';
		}
	} else {
		badge.textContent = 'Locked';
		badge.classList.remove('ready');
		inputs.style.display = 'none';
	}
	if (!hasKeystore()) {
		badge.textContent = 'No keys stored yet';
	}
}

function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks', { keyPath: 'id' });
			if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
async function dbPut(store, obj) { const db = await openDb(); return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).put(obj); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); }
async function dbGet(store, id) { const db = await openDb(); return new Promise((res,rej)=>{ const tx=db.transaction(store); const req=tx.objectStore(store).get(id); req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error); }); }
async function dbDelete(store, id) { const db = await openDb(); return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).delete(id); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); }

function getApiKey(provider) {
	return state.keys[provider];
}

function renderFallbacks() {
	const host = $('fallback-list');
	if (!host) return;
	host.innerHTML = '';
	const list = state.settings.fallbackModels || [];
	if (!list.length) {
		const empty = document.createElement('p');
		empty.className = 'tr-hint';
		empty.textContent = 'No fallback models configured.';
		host.appendChild(empty);
		return;
	}
	for (let i = 0; i < list.length; i++) {
		const f = list[i];
		const row = document.createElement('div');
		row.className = 'tr-fallback-row';
		const sel = document.createElement('select');
		sel.className = 'tr-select tr-fallback-prov';
		for (const prov of Object.keys(PROVIDER_LABELS)) {
			const opt = document.createElement('option');
			opt.value = prov;
			opt.textContent = PROVIDER_LABELS[prov];
			sel.appendChild(opt);
		}
		sel.value = f.provider;
		sel.addEventListener('change', () => { state.settings.fallbackModels[i].provider = sel.value; saveSettings(); });
		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'tr-input';
		input.placeholder = 'model id (e.g. gemini-3.5-flash-lite)';
		input.value = f.model;
		input.addEventListener('change', () => { state.settings.fallbackModels[i].model = input.value.trim(); saveSettings(); });
		const del = document.createElement('button');
		del.className = 'tr-btn tr-fallback-del';
		del.textContent = '✕';
		del.title = 'Remove';
		del.addEventListener('click', () => { state.settings.fallbackModels.splice(i, 1); saveSettings(); renderFallbacks(); });
		row.appendChild(sel);
		row.appendChild(input);
		row.appendChild(del);
		host.appendChild(row);
	}
}

function buildChunkPrompt(profile, chunkNum, totalChunks) {
	let prompt = profile.prompt || '';
	if (profile.keepDialect && profile.dialectName) {
		prompt += `\n\nIf the speaker uses ${profile.dialectName} expressions, preserve them exactly as spoken, without any modification or standardization.`;
	}
	if (profile.speakers) {
		const names = profile.speakers.split(',').map(s=>s.trim()).filter(Boolean);
		if (names.length) {
			const labels = names.map(n => `**${n}:**`).join(', ');
			prompt += `\n\nUse speaker labels: ${labels}.`;
		}
	}
	prompt += `\n\n[Chunk ${chunkNum}/${totalChunks}]`;
	return prompt;
}

async function generateWithSpec(spec, promptOrParts, { maxTokens = 30000, isAudio = false, temperature } = {}) {
	const key = getApiKey(spec.provider);
	if (!key) throw new Error(`No API key for ${spec.provider}`);
	if (spec.provider === 'gemini') {
		const parts = isAudio ? promptOrParts : [{ text: promptOrParts }];
		return geminiGenerate({ apiKey: key, model: spec.model, parts, temperature: temperature ?? 0.2, maxTokens });
	}
	if (spec.provider === 'openrouter') {
		return openRouterChat({ apiKey: key, model: spec.model, prompt: promptOrParts, temperature: temperature ?? 0.3, maxTokens });
	}
	throw new Error('Unknown provider');
}

function setupDropZone() {
	const drop = $('audio-drop');
	const input = $('audio-file');
	input.addEventListener('change', () => { if (input.files[0]) selectAudio(input.files[0]); });
	drop.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
	drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
	drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
	drop.addEventListener('drop', e => {
		e.preventDefault();
		drop.classList.remove('dragover');
		const f = e.dataTransfer.files[0];
		if (f) selectAudio(f);
	});
}
async function selectAudio(file) {
	state.currentFile = file;
	$('audio-info').textContent = `${escapeHtml(file.name)} — ${(file.size/1024/1024).toFixed(2)} MB`;
	try {
		const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');
		const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
		const duration = await input.computeDuration();
		await input.cancel?.().catch(()=>{});
		$('audio-info').textContent += ` — duration ${fmtTime(duration)}`;
	} catch(e) {
		console.error(e);
		$('audio-info').textContent += ' — could not read duration';
	}
}

function setProgress(id, percent, text) {
	const el = $(id);
	el.classList.add('active');
	qs('.tr-progress-fill', el).style.width = percent + '%';
	qs('.tr-progress-text', el).textContent = text || `${Math.round(percent)}%`;
}
function hideProgress(id) { $(id).classList.remove('active'); }

function startIndeterminateProgress(id, label) {
	const el = $(id);
	el.classList.add('active', 'indeterminate');
	const fill = qs('.tr-progress-fill', el);
	fill.style.width = '';
	const text = qs('.tr-progress-text', el);
	text.textContent = label;
	const t0 = Date.now();
	clearInterval(el._iv);
	el._iv = setInterval(() => {
		text.textContent = `${label} ${Math.floor((Date.now() - t0) / 1000)}s`;
	}, 1000);
}
function stopProgress(id) {
	const el = $(id);
	clearInterval(el._iv);
	el._iv = null;
	el.classList.remove('active', 'indeterminate');
	qs('.tr-progress-fill', el).style.width = '';
}

let transcribeController = null;
let pauseResolve = null;
let transcribeBusy = false;

async function beginTranscription() {
	if (transcribeBusy) { toast('Transcription already in progress'); return; }
	const file = state.currentFile;
	if (!file) { toast('Select an audio file first'); return; }
	if (!state.unlocked) { toast('Unlock your passphrase first'); return; }

	const profileId = $('transcribe-profile').value;
	const primary = profileById(profileId);
	if (!primary) { toast('Select a profile'); return; }
	if (!TRANSCRIBE_PROVIDERS.includes(primary.provider)) { toast('Transcription supports Gemini, Groq or Hugging Face. OpenRouter is text-only.'); return; }

	const chunkDuration = parseInt($('chunk-duration').value, 10) || 1200;
	const overlap = parseInt($('chunk-overlap').value, 10) || 10;
	const autoFallback = $('auto-fallback').checked;

	transcribeBusy = true;
	$('btn-transcribe').disabled = true;
	$('transcript-out').value = '';
	transcribeController = new AbortController();
	setProgress('transcribe-progress', 0, 'Reading audio file...');

	try {
		const fileHash = await sha256Hex(`${file.name}:${file.size}:${file.lastModified}`);
		const { chunks, blobs } = await makeChunkBlobs(file, chunkDuration, overlap, (done, total, msg) => {
			setProgress('transcribe-progress', 5 + (done / total) * 25, msg);
		});
		const total = chunks.length;
		const transcripts = new Array(total);
		const chain = buildChain({ provider: primary.provider, model: primary.model }, TRANSCRIBE_PROVIDERS, autoFallback);
		let working = chain[0];

		for (let i = 0; i < total; i++) {
			if (transcribeController.signal.aborted) throw new Error('Aborted');
			if (pauseResolve) { setProgress('transcribe-progress', 5 + (i / total) * 90, 'Paused'); await pauseResolve; pauseResolve = null; }
			const chunk = chunks[i];
			const dbKey = `${fileHash}_${chunk.num}`;
			const cached = await dbGet('chunks', dbKey);
			if (cached?.text) {
				transcripts[i] = cached.text;
				setProgress('transcribe-progress', 5 + ((i + 1) / total) * 90, `Chunk ${chunk.num}/${total} loaded from cache`);
				continue;
			}

			const ordered = [working, ...chain.filter(s => !sameSpec(s, working))];
			let lastError = null;
			let text = '';
			for (const spec of ordered) {
				try {
					const key = getApiKey(spec.provider);
					if (!key) { lastError = new Error(`${spec.provider} key missing`); continue; }
					if (spec.provider === 'gemini') {
						setProgress('transcribe-progress', 5 + (i / total) * 90, `Chunk ${chunk.num}/${total} uploading with ${spec.model}...`);
						const { uri, name } = await geminiUploadChunk(blobs[i].blob, key);
						await geminiWaitActive(name, key);
						const prompt = buildChunkPrompt(primary, chunk.num, total);
						setProgress('transcribe-progress', 5 + (i / total) * 90, `Chunk ${chunk.num}/${total} transcribing with ${spec.model}...`);
						text = await geminiGenerate({ apiKey: key, model: spec.model, parts: [{ file_data: { mime_type: blobs[i].blob.type || 'audio/wav', file_uri: uri } }, { text: prompt }], temperature: primary.temperature, maxTokens: 30000 });
					} else if (spec.provider === 'groq') {
						setProgress('transcribe-progress', 5 + (i / total) * 90, `Chunk ${chunk.num}/${total} transcribing with Groq ${spec.model}...`);
						text = await groqTranscribe({ apiKey: key, model: spec.model, blob: blobs[i].blob, language: primary.language, temperature: primary.temperature });
					} else if (spec.provider === 'huggingface') {
						setProgress('transcribe-progress', 5 + (i / total) * 90, `Chunk ${chunk.num}/${total} transcribing with HF ${spec.model}...`);
						text = await hfTranscribe({ apiKey: key, model: spec.model, blob: blobs[i].blob, language: primary.language, temperature: primary.temperature });
					}
					if (!text) throw new Error(`${spec.provider} returned no text`);
					working = spec;
					lastError = null;
					break;
				} catch (e) {
					lastError = e;
					console.warn('Chunk candidate failed', spec.model, e.message);
				}
			}
			if (lastError) throw lastError;
			transcripts[i] = text;
			await dbPut('chunks', { id: dbKey, text, fileHash, num: chunk.num, model: working.model });
			setProgress('transcribe-progress', 5 + ((i + 1) / total) * 90, `Chunk ${chunk.num}/${total} done`);
		}

		setProgress('transcribe-progress', 95, 'Merging chunks...');
		const combined = transcripts.map((t, i) => `[Chunk ${i + 1}]\n\n${t}`).join('\n\n---\n\n');
		const mergeChain = buildChain({ provider: primary.provider, model: primary.model }, TEXT_PROVIDERS, true)
			.filter(s => TEXT_PROVIDERS.includes(s.provider));
		const mergePrompt = (primary.mergePrompt || WHISPER_MERGE_PROMPT).replace('{transcript}', combined);
		let final = combined;
		for (const spec of mergeChain) {
			if (!getApiKey(spec.provider)) continue;
			try {
				final = await generateWithSpec(spec, mergePrompt, { maxTokens: 100000, temperature: primary.temperature });
				break;
			} catch (e) {
				console.warn('Merge failed with', spec.model, e.message);
			}
		}

		let output = '';
		if (primary.header) output += primary.header + '\n\n---\n\n';
		output += final;
		$('transcript-out').value = output;
		await dbPut('tasks', { id: fileHash, status: 'done', finishedAt: Date.now() });
		setProgress('transcribe-progress', 100, 'Done');
		toast('Transcription complete');
	} catch (e) {
		if (e.name === 'AbortError' || e.message === 'Aborted') {
			toast('Transcription paused/aborted');
			hideProgress('transcribe-progress');
		} else {
			console.error(e);
			showError('Transcription failed', e);
			toast('Transcription failed — see Errors panel for details', 5000);
			failProgress('transcribe-progress', 'Failed: ' + (e.message || e));
		}
	} finally {
		transcribeBusy = false;
		$('btn-transcribe').disabled = false;
	}
}

function pauseTranscription() {
	if (!pauseResolve) {
		let r;
		const p = new Promise(res => r = res);
		pauseResolve = p;
		$('btn-pause-transcribe').style.display = 'none';
		$('btn-resume-transcribe').style.display = 'inline-flex';
		window._resumeTranscribe = r;
	}
}
function resumeTranscription() {
	if (window._resumeTranscribe) { window._resumeTranscribe(); window._resumeTranscribe = null; }
	$('btn-pause-transcribe').style.display = 'inline-flex';
	$('btn-resume-transcribe').style.display = 'none';
}
function abortTranscription() {
	transcribeController?.abort();
}

let summaryBusy = false;

async function beginSummarize() {
	if (summaryBusy) { toast('Summary already in progress'); return; }
	const text = $('summary-input').value.trim();
	if (!text) { toast('Paste text to summarize'); return; }
	const profileId = $('summarize-profile').value;
	const primary = profileById(profileId);
	if (!primary) { toast('Select a profile'); return; }
	if (!state.unlocked) { toast('Unlock your passphrase first'); return; }

	const format = $('summary-format').value;
	const targetType = $('summary-target-type').value;
	const targetVal = parseInt($('summary-target-value').value, 10) || 25;
	const preserveArabic = $('summary-arabic').checked;
	const autoFallback = $('auto-fallback-summary').checked;

	let detail = '';
	if (targetType === 'words') detail = `Limit the summary to approximately ${targetVal} words.`;
	else detail = `Limit the summary to approximately ${targetVal}% of the input length.`;

	let formatNote = '';
	if (format === 'paragraphs') formatNote = 'Write the summary in plain paragraphs.';
	if (format === 'bullets') formatNote = 'Write the summary as bullet points.';
	if (format === 'numbered') formatNote = 'Write the summary as numbered points.';
	if (format === 'overview-bullets') formatNote = 'Provide a one-paragraph overview followed by bullet points for details.';

	const prompt = `${primary.prompt}\n\n${formatNote}\n${detail}${preserveArabic ? ' Preserve any Arabic phrases and names as they appear.' : ''}\n\nText to summarize:\n\n---\n\n${text}`;

	summaryBusy = true;
	$('btn-summarize').disabled = true;
	startIndeterminateProgress('summarize-progress', 'Summarizing…');
	let summaryOk = false;
	try {
		const chain = buildChain({ provider: primary.provider, model: primary.model }, TEXT_PROVIDERS, autoFallback);
		let result = '';
		let lastError = null;
		for (const spec of chain) {
			try {
				result = await generateWithSpec(spec, prompt, { maxTokens: 30000, temperature: primary.temperature });
				if (!result) throw new Error('model returned no text');
				lastError = null;
				break;
			} catch (e) {
				lastError = e;
				console.warn('Summary candidate failed', spec.model, e.message);
			}
		}
		if (lastError) throw lastError;
		$('summary-out').value = result;
		summaryOk = true;
		toast('Summary complete');
	} catch (e) {
		console.error(e);
		showError('Summary failed', e);
		toast('Summary failed — see Errors panel for details', 5000);
		failProgress('summarize-progress', 'Failed: ' + (e.message || e));
	} finally {
		summaryBusy = false;
		$('btn-summarize').disabled = false;
		if (summaryOk) stopProgress('summarize-progress');
	}
}

const FORMAT_PROMPT_PREFIX = `Restructure the following text so it works as a slide deck AND as a shareable card. Apply these rules strictly:
- Start with "# Main title" on its own line (this becomes the cover slide).
- Then split the rest into slides. Put each slide's content in order, separated by a line containing exactly: ---SLIDE---
- Start every slide (after the first) with a "## Short slide heading" line, followed by 1-3 short paragraphs (blank line between paragraphs) and, where it fits, "- " bullet points (each bullet on its own line, max ~12 words).
- Keep slides self-contained: roughly 40-70 words per slide. Never leave a slide empty.
- Keep any Arabic text exactly as it is, unchanged. Never romanize Arabic.
- Do not invent facts and do not add content that is not present in the text.
- Output ONLY the restructured markdown (headings, paragraphs, bullets, ---SLIDE--- markers), with no code fences and no extra commentary.
- Example shape:
# Talk title
---SLIDE---
## First point
Short paragraph here.
- bullet one
- bullet two
---SLIDE---
## Second point
Short paragraph here.

Text to format:
---
`;

let formatBusy = false;

async function formatTextWithAI() {
	if (formatBusy) { toast('Formatting already in progress'); return; }
	const text = $('visual-text').value.trim();
	if (!text) { toast('Enter some text to format'); return; }
	if (!state.unlocked) { toast('Unlock your passphrase first'); return; }
	const profileId = $('visual-format-profile').value || $('summarize-profile').value;
	const primary = profileById(profileId);
	if (!primary) { toast('Select a formatting model'); return; }
	if (primary.provider !== 'gemini' && primary.provider !== 'openrouter') { toast('Formatting needs a Gemini or OpenRouter text model'); return; }

	const autoFallback = $('auto-fallback-summary').checked;
	const chain = buildChain({ provider: primary.provider, model: primary.model }, TEXT_PROVIDERS, autoFallback);
	const basePrompt = (primary.prompt ? primary.prompt + '\n\n' : '') + FORMAT_PROMPT_PREFIX;

	formatBusy = true;
	$('btn-format-text').disabled = true;
	startIndeterminateProgress('format-progress', 'Formatting text…');
	let formatOk = false;
	let result = '';
	let lastError = null;
	try {
		for (const spec of chain) {
			try {
				result = await generateWithSpec(spec, basePrompt + text, { maxTokens: 12000, temperature: primary.temperature });
				if (!result) throw new Error('model returned no text');
				lastError = null;
				break;
			} catch (e) { lastError = e; console.warn('Format candidate failed', spec.model, e.message); }
		}
		if (lastError) throw lastError;
		$('visual-text').value = result.trim();
		formatOk = true;
		toast('Text formatted with AI');
	} catch (e) {
		console.error(e);
		showError('AI formatting failed', e);
		toast('Formatting failed — see Errors panel for details', 5000);
		failProgress('format-progress', 'Failed: ' + (e.message || e));
	} finally {
		formatBusy = false;
		$('btn-format-text').disabled = false;
		if (formatOk) stopProgress('format-progress');
	}
}

function setupVisuals() {
	for (const btn of qsa('.tr-seg')) {
		btn.addEventListener('click', () => {
			for (const b of qsa('.tr-seg')) b.classList.remove('active');
			btn.classList.add('active');
			state.visualMode = btn.dataset.visual;
			$('btn-download-visual').style.display = state.visualMode === 'card' ? 'inline-flex' : 'none';
			$('btn-print-pdf').style.display = state.visualMode === 'slides' ? 'inline-flex' : 'none';
			$('btn-download-html').style.display = state.visualMode === 'slides' ? 'inline-flex' : 'none';
			$('visual-image-row').style.display = 'block';
			$('visual-slide-options').style.display = state.visualMode === 'slides' ? 'block' : 'none';
		});
	}

	$('visual-bg-type').addEventListener('change', () => {
		const type = $('visual-bg-type').value;
		$('visual-bg-file').style.display = type === 'upload' ? 'block' : 'none';
		$('visual-bg-query').style.display = type === 'commons' ? 'block' : 'none';
		$('visual-image-results').style.display = type === 'commons' ? 'grid' : 'none';
	});

	$('visual-bg-query').addEventListener('keydown', e => { if (e.key === 'Enter') searchImages(); });
	$('visual-bg-file').addEventListener('change', () => {
		const f = $('visual-bg-file').files[0];
		if (f) {
			state.visualSelectedBg = URL.createObjectURL(f);
			toast('Background image selected');
		}
	});

	$('slide-split').addEventListener('change', () => {
		$('slide-chars').style.display = $('slide-split').value === 'chars' ? 'block' : 'none';
	});
}

async function searchImages() {
	const q = $('visual-bg-query').value.trim();
	if (!q) return;
	const host = $('visual-image-results');
	host.innerHTML = '<div class="tr-hint">Searching...</div>';
	try {
		const imgs = await searchWikimediaImages(q, 15);
		host.innerHTML = '';
		if (!imgs.length) { host.innerHTML = '<div class="tr-hint">No results</div>'; return; }
		for (const img of imgs) {
			const el = document.createElement('img');
			el.src = img.thumb;
			el.title = img.title;
			el.addEventListener('click', () => {
				state.visualSelectedBg = img.url;
				for (const i of qsa('#visual-image-results img')) i.classList.remove('selected');
				el.classList.add('selected');
			});
			host.appendChild(el);
		}
	} catch (e) {
		host.innerHTML = '<div class="tr-hint">Search failed: ' + escapeHtml(e.message || e) + '</div>';
		console.error(e);
		showError('Image search failed', e);
	}
}

function getSelectedBg() {
	return state.visualSelectedBg || null;
}

let visualBusy = false;

async function generateVisual() {
	if (visualBusy) { toast('Already generating'); return; }
	let text = $('visual-text').value.trim();
	if (!text) { toast('Enter some text first'); return; }
	visualBusy = true;
	$('btn-generate-visual').disabled = true;
	try {
		if ($('visual-auto-format').checked) {
			const before = text;
			await formatTextWithAI();
			text = $('visual-text').value.trim();
			if (text === before || !text) { toast('Auto-format skipped'); return; }
		}
		const design = $('visual-design').value;
		const bg = getSelectedBg();
		const host = $('visual-preview-host');
		host.innerHTML = '';

		if (state.visualMode === 'card') {
			const card = renderQuoteCard(text, design, bg, '');
			state.currentVisualEl = card;
			const scale = document.createElement('div');
			scale.className = 'tr-scale';
			scale.appendChild(card);
			host.appendChild(scale);
		} else {
			const splitMode = $('slide-split').value;
			const chars = parseInt($('slide-chars').value, 10) || 400;
			const deck = renderDeck(text, design, splitMode, chars, bg);
			state.currentVisualEl = deck;
			const scale = document.createElement('div');
			scale.className = 'tr-scale';
			scale.appendChild(deck);
			host.appendChild(scale);
		}
		fitPreview();
	} finally {
		visualBusy = false;
		$('btn-generate-visual').disabled = false;
	}
}

function fitPreview() {
	const host = $('visual-preview-host');
	const scaleEl = host.querySelector('.tr-scale');
	if (!scaleEl || !scaleEl.firstElementChild) return;
	const child = scaleEl.firstElementChild;
	const isPost = child.classList.contains('tr-post');
	const baseW = isPost ? 1080 : 1280;
	const baseH = isPost ? 1080 : child.querySelectorAll('.tr-slide').length * 720;
	const s = Math.min(host.clientWidth / baseW, 1);
	scaleEl.style.width = baseW + 'px';
	scaleEl.style.height = baseH + 'px';
	scaleEl.style.transform = 'scale(' + s + ')';
	host.style.height = Math.ceil(baseH * s) + 'px';
}

async function downloadVisualPng() {
	if (!state.currentVisualEl || state.visualMode !== 'card') { toast('Generate a single image first'); return; }
	try {
		const dataUrl = await exportPng(state.currentVisualEl);
		const a = document.createElement('a');
		a.href = dataUrl;
		a.download = 'quote-card.png';
		a.click();
	} catch (e) {
		console.error(e);
		showError('PNG export failed', e);
		toast('PNG export failed — see Errors panel for details', 5000);
	}
}

async function printPdf() {
	if (!state.currentVisualEl || state.visualMode !== 'slides') { toast('Generate slides first'); return; }
	try {
		toast('Building PDF from slide images...', 4000);
		await exportDeckPdf(state.currentVisualEl, 'presentation.pdf');
		toast('PDF downloaded');
	} catch (e) {
		console.error(e);
		showError('PDF export failed', e);
		toast('PDF export failed — see Errors panel for details', 5000);
	}
}

function downloadHtmlDeckFile() {
	if (!state.currentVisualEl || state.visualMode !== 'slides') { toast('Generate slides first'); return; }
	downloadHtmlDeck(state.currentVisualEl, 'presentation.html');
}

function switchTab(name) {
	for (const t of qsa('.tr-tab')) t.classList.toggle('active', t.dataset.tab === name);
	for (const p of qsa('.tr-tab-panel')) p.classList.toggle('active', p.dataset.panel === name);
	state.settings.activeTab = name;
	saveSettings();
}

function bindEvents() {
	window.addEventListener('error', (ev) => {
		if (ev?.error || ev?.message) showError('Unexpected error', ev.error || new Error(ev.message));
	});
	window.addEventListener('unhandledrejection', (ev) => {
		showError('Unexpected error (promise)', ev.reason instanceof Error ? ev.reason : new Error(String(ev.reason)));
	});
	$('btn-clear-errors')?.addEventListener('click', () => {
		$('error-log').innerHTML = '';
		updateErrorCount();
		$('card-errors').style.display = 'none';
	});
	$('btn-copy-errors')?.addEventListener('click', async () => {
		try {
			const text = Array.from(document.querySelectorAll('#error-log .tr-error-item')).map(el => el.innerText).join('\n\n---\n\n');
			await navigator.clipboard.writeText(text || 'No errors');
			toast('Errors copied');
		} catch { toast('Copy failed'); }
	});
	for (const btn of qsa('.tr-theme-btn')) btn.addEventListener('click', () => setTheme(btn.dataset.theme));
	$('btn-unlock').addEventListener('click', doUnlock);
	$('btn-lock').addEventListener('click', doLock);
	$('btn-save-keys').addEventListener('click', saveKeys);

	for (const tab of qsa('.tr-tab')) tab.addEventListener('click', () => switchTab(tab.dataset.tab));
	setupDropZone();

	$('btn-transcribe').addEventListener('click', beginTranscription);
	$('btn-pause-transcribe').addEventListener('click', pauseTranscription);
	$('btn-resume-transcribe').addEventListener('click', resumeTranscription);
	$('btn-copy-transcript').addEventListener('click', () => { navigator.clipboard.writeText($('transcript-out').value); toast('Copied'); });
	$('btn-download-transcript').addEventListener('click', () => downloadText('transcript.md', $('transcript-out').value));
	$('btn-send-to-summary').addEventListener('click', () => { $('summary-input').value = $('transcript-out').value; switchTab('summarize'); toast('Loaded into Summarize'); });

	$('btn-summarize').addEventListener('click', beginSummarize);
	$('btn-copy-summary').addEventListener('click', () => { navigator.clipboard.writeText($('summary-out').value); toast('Copied'); });
	$('btn-download-summary').addEventListener('click', () => downloadText('summary.md', $('summary-out').value));
	$('btn-send-summary-to-visual').addEventListener('click', () => { $('visual-text').value = $('summary-out').value; switchTab('visualize'); toast('Loaded into Visualize'); });

	setupVisuals();
	$('btn-format-text').addEventListener('click', formatTextWithAI);
	$('btn-generate-visual').addEventListener('click', generateVisual);
	$('btn-download-visual').addEventListener('click', downloadVisualPng);
	$('btn-print-pdf').addEventListener('click', printPdf);
	$('btn-download-html').addEventListener('click', downloadHtmlDeckFile);

	$('btn-new-profile').addEventListener('click', () => createNewProfile());
	$('btn-save-profile').addEventListener('click', saveCurrentProfile);
	$('btn-delete-profile').addEventListener('click', deleteCurrentProfile);
	$('btn-export-profiles').addEventListener('click', exportProfiles);
	$('btn-import-profiles').addEventListener('click', () => $('profile-import-file').click());
	$('profile-import-file').addEventListener('change', () => {
		const f = $('profile-import-file').files[0];
		if (f) importProfiles(f);
	});
	$('profile-type').addEventListener('change', () => {
		applyProfileTypeUI($('profile-type').value);
	});
	$('btn-fetch-gemini-models').addEventListener('click', fetchGeminiModels);
	$('btn-add-fallback').addEventListener('click', () => {
		state.settings.fallbackModels.push({ provider: 'gemini', model: '' });
		saveSettings();
		renderFallbacks();
	});
	$('btn-keys-help').addEventListener('click', () => {
		$('keys-help').classList.toggle('show');
	});

	for (const btn of qsa('.tr-toggle')) {
		btn.addEventListener('click', () => {
			const target = document.getElementById(btn.dataset.target);
			const expanded = btn.getAttribute('aria-expanded') !== 'false';
			btn.setAttribute('aria-expanded', String(!expanded));
			target.style.display = expanded ? 'none' : 'block';
		});
	}

	$('btn-clear-data').addEventListener('click', () => {
		if (!confirm('Clear all encrypted keys, profiles and tasks from this browser?')) return;
		localStorage.removeItem('scribe_keystore');
		localStorage.removeItem('scribe_settings');
		localStorage.removeItem('scribe_profiles');
		indexedDB.deleteDatabase(DB_NAME);
		state.keys = {}; state.unlocked = false;
		state.settings = { fallbackModels: JSON.parse(JSON.stringify(DEFAULT_FALLBACKS)) };
		loadProfiles(); state.currentProfileId = state.profiles[0]?.id;
		renderProfileList(); loadProfileEditor(state.currentProfileId); populateProfileSelects(); renderKeyUI(); renderFallbacks();
		toast('All stored data cleared');
	});

	$('btn-reset-profiles').addEventListener('click', () => {
		if (!confirm('Reset profiles to defaults?')) return;
		state.profiles = JSON.parse(JSON.stringify(DEFAULT_PROFILES));
		saveProfiles();
		state.currentProfileId = state.profiles[0].id;
		renderProfileList(); loadProfileEditor(state.currentProfileId); populateProfileSelects();
		toast('Profiles reset');
	});
}

function fillModelList(ids) {
	const list = document.getElementById('model-list');
	list.innerHTML = '';
	for (const id of ids) {
		const opt = document.createElement('option');
		opt.value = id;
		list.appendChild(opt);
	}
}
async function fetchGeminiModels() {
	fillModelList(CURATED_GEMINI_MODELS.map(m => m.id));
	if (!state.unlocked || !state.keys.gemini) {
		toast(`Showing ${CURATED_GEMINI_MODELS.length} known-good models (unlock + save key to also check live list)`, 4000);
		return;
	}
	try {
		const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${state.keys.gemini}&pageSize=100`);
		const data = await resp.json();
		if (!resp.ok) throw new Error(data.error?.message || 'Failed');
		const live = (data.models || [])
			.map(m => String(m.name || '').replace(/^models\//, ''))
			.filter(name => name.startsWith('gemini'))
			.filter(name => (data.models.find(m => String(m.name || '').endsWith(name))?.supportedGenerationMethods || ['generateContent']).includes('generateContent'))
			.filter(name => !RETIRED_MODEL_PATTERNS.some(re => re.test(name)))
			.filter(name => !/2\.5-flash(-lite)?$/.test(name));
		const merged = [...CURATED_GEMINI_MODELS.map(m => m.id)];
		for (const name of live) if (!merged.includes(name)) merged.push(name);
		fillModelList(merged);
		const dropped = (data.models || []).length - live.length;
		toast(`Showing ${merged.length} models (${CURATED_GEMINI_MODELS.length} curated${dropped > 0 ? `, ${dropped} retired hidden` : ''})`, 4000);
	} catch (e) {
		showError('Could not refresh live model list — showing curated models', e);
		toast('Live list failed — curated models shown (see Errors panel)', 5000);
	}
}

function init() {
	loadSettings();
	fillModelList(CURATED_GEMINI_MODELS.map(m => m.id));
	loadProfiles();
	state.currentProfileId = state.profiles[0]?.id;
	bindEvents();
	populateProfileSelects();
	renderProfileList();
	loadProfileEditor(state.currentProfileId);
	renderKeyUI();
	renderFallbacks();
	searchImages();
}

init();
