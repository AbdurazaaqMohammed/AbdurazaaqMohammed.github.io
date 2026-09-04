const KEY_ALGO = { name: 'PBKDF2' };
const AES_ALGO = { name: 'AES-GCM', length: 256 };
const PBKDF2_PARAMS = { name: 'PBKDF2', salt: null, iterations: 250000, hash: 'SHA-256' };
const ENC = new TextEncoder();
const DEC = new TextDecoder();

function bufferToBase64(buffer) {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

function base64ToBuffer(base64) {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function deriveKey(passphrase, salt) {
	const keyMaterial = await crypto.subtle.importKey('raw', ENC.encode(passphrase), KEY_ALGO, false, ['deriveKey']);
	return crypto.subtle.deriveKey({ ...PBKDF2_PARAMS, salt }, keyMaterial, AES_ALGO, false, ['encrypt', 'decrypt']);
}

export async function encryptKeys(passphrase, keys) {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await deriveKey(passphrase, salt);
	const data = {};
	for (const [name, value] of Object.entries(keys)) {
		if (!value) { data[name] = ''; continue; }
f		const iv = crypto.getRandomValues(new Uint8Array(12));
		const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, ENC.encode(value));
		data[name] = { iv: bufferToBase64(iv), ct: bufferToBase64(ct) };
	}
	return {
		v: 2,
		salt: bufferToBase64(salt),
		data
	};
}

export async function decryptKeys(passphrase, store) {
	if (!store || !store.salt || !store.data) throw new Error('Corrupted key store.');
	const salt = base64ToBuffer(store.salt);
	const key = await deriveKey(passphrase, salt);
	const keys = {};
	const legacyIv = store.iv ? base64ToBuffer(store.iv) : null;
	for (const [name, entry] of Object.entries(store.data)) {
		if (!entry) { keys[name] = ''; continue; }
		let ivBuf, ctBuf;
		if (typeof entry === 'string') {
			if (!legacyIv) throw new Error('Corrupted key store.');
			ivBuf = legacyIv;
			ctBuf = base64ToBuffer(entry);
		} else if (entry && typeof entry === 'object' && entry.iv && entry.ct) {
			ivBuf = base64ToBuffer(entry.iv);
			ctBuf = base64ToBuffer(entry.ct);
		} else {
			throw new Error('Corrupted key store.');
		}
		const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, key, ctBuf);
		keys[name] = DEC.decode(pt);
	}
	return keys;
}

export function hasKeystore() {
	return !!localStorage.getItem('scribe_keystore');
}

export function loadKeystore() {
	try { return JSON.parse(localStorage.getItem('scribe_keystore')); } catch { return null; }
}

export function saveKeystore(store) {
	localStorage.setItem('scribe_keystore', JSON.stringify(store));
}

export function clearKeystore() {
	localStorage.removeItem('scribe_keystore');
}
