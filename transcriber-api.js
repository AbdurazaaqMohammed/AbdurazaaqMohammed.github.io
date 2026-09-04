const GEMINI_UPLOAD = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const GEMINI_FILES = 'https://generativelanguage.googleapis.com/v1beta/files';
const GEMINI_GENERATE = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const HF_URL = 'https://api-inference.huggingface.co/models/{model}';

function normalize(model) { return model.replace(/^models\//, ''); }

export async function geminiUploadChunk(blob, apiKey, onProgress) {
	const size = blob.size;
	const initResp = await fetch(`${GEMINI_UPLOAD}?key=${apiKey}`, {
		method: 'POST',
		headers: {
			'X-Goog-Upload-Protocol': 'resumable',
			'X-Goog-Upload-Command': 'start',
			'X-Goog-Upload-Header-Content-Length': String(size),
			'X-Goog-Upload-Header-Content-Type': blob.type || 'audio/wav',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ file: { display_name: 'transcriber_chunk' } })
	});
	if (!initResp.ok) {
		const err = await initResp.text();
		throw new Error(`Gemini upload init failed: ${initResp.status} ${err}`);
	}
	const uploadUrl = initResp.headers.get('X-Goog-Upload-URL');
	if (!uploadUrl) throw new Error('No upload URL returned from Gemini.');
	const uploadResp = await fetch(uploadUrl, {
		method: 'POST',
		headers: {
			'X-Goog-Upload-Command': 'upload,finalize',
			'X-Goog-Upload-Offset': '0',
			'Content-Length': String(size)
		},
		body: blob
	});
	if (!uploadResp.ok) {
		const err = await uploadResp.text();
		throw new Error(`Gemini upload failed: ${uploadResp.status} ${err}`);
	}
	const data = await uploadResp.json();
	return { uri: data.file.uri, name: data.file.name };
}

export async function geminiWaitActive(fileName, apiKey) {
	const id = fileName.replace(/^files\//, '');
	const start = performance.now();
	while (true) {
		const resp = await fetch(`${GEMINI_FILES}/${id}?key=${apiKey}`);
		if (!resp.ok) {
			const err = await resp.text();
			throw new Error(`Gemini file status failed: ${resp.status} ${err}`);
		}
		const data = await resp.json();
		if (data.state === 'ACTIVE') break;
		if (data.state === 'FAILED') throw new Error('Gemini file processing failed.');
		await new Promise(r => setTimeout(r, 3000));
	}
}

export async function geminiGenerate({ apiKey, model, parts, temperature = 0.2, maxTokens = 30000, timeout = 600000 }) {
	const url = GEMINI_GENERATE.replace('{model}', normalize(model)) + `?key=${apiKey}`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);
	try {
		const resp = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{ parts }],
				generationConfig: { temperature, maxOutputTokens: maxTokens }
			}),
			signal: controller.signal
		});
		const data = await resp.json();
		if (!resp.ok) throw new Error(data.error?.message || JSON.stringify(data));
		return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
	} finally {
		clearTimeout(timer);
	}
}

export async function openRouterChat({ apiKey, model, prompt, temperature = 0.3, maxTokens = 30000, timeout = 600000 }) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);
	try {
		const resp = await fetch(OPENROUTER_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
				'HTTP-Referer': 'https://abdurazaaqmohammed.github.io/transcriber.html',
				'X-OpenRouter-Title': 'Transcriber'
			},
			body: JSON.stringify({
				model,
				messages: [{ role: 'user', content: prompt }],
				temperature,
				max_tokens: maxTokens
			}),
			signal: controller.signal
		});
		const data = await resp.json();
		if (!resp.ok) throw new Error(data.error?.message || JSON.stringify(data));
		return data.choices?.[0]?.message?.content ?? '';
	} finally {
		clearTimeout(timer);
	}
}

function audioFileName(blob) {
	const t = blob.type || '';
	if (t.includes('mpeg') || t.includes('mp3')) return 'chunk.mp3';
	if (t.includes('wav')) return 'chunk.wav';
	if (t.includes('ogg')) return 'chunk.ogg';
	if (t.includes('flac')) return 'chunk.flac';
	if (t.includes('aac')) return 'chunk.aac';
	if (t.includes('mp4')) return 'chunk.m4a';
	return 'chunk.audio';
}

export async function groqTranscribe({ apiKey, model, blob, language = '', temperature = 0, timeout = 600000 }) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);
	try {
		const form = new FormData();
		form.append('file', blob, audioFileName(blob));
		form.append('model', model);
		form.append('response_format', 'json');
		if (language) form.append('language', language);
		form.append('temperature', String(temperature));
		const resp = await fetch(GROQ_URL, {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${apiKey}` },
			body: form,
			signal: controller.signal
		});
		const data = await resp.json();
		if (!resp.ok) throw new Error(data.error?.message || JSON.stringify(data));
		return data.text ?? '';
	} finally {
		clearTimeout(timer);
	}
}

export async function hfTranscribe({ apiKey, model, blob, language = '', temperature = 0, timeout = 600000 }) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);
	try {
		const form = new FormData();
		form.append('data', blob, audioFileName(blob));
		const params = { temperature };
		if (language) params.language = language;
		form.append('parameters', JSON.stringify(params));
		const resp = await fetch(HF_URL.replace('{model}', model), {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${apiKey}` },
			body: form,
			signal: controller.signal
		});
		const data = await resp.json();
		if (!resp.ok) throw new Error(data.error || JSON.stringify(data));
		if (data.error) throw new Error(data.error);
		return data.text ?? '';
	} finally {
		clearTimeout(timer);
	}
}
