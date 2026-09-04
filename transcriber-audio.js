import {
	Input, Output, BlobSource, BufferTarget, ALL_FORMATS,
	EncodedAudioPacketSource, EncodedPacketSink,
	WavOutputFormat, Mp3OutputFormat, OggOutputFormat, FlacOutputFormat,
	Mp4OutputFormat, MovOutputFormat, AdtsOutputFormat,
	MkvOutputFormat, WebMOutputFormat, Conversion
} from 'mediabunny';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function detectOutputFormat(file) {
	const t = file.type || '';
	const n = file.name.toLowerCase();
	if (t === 'audio/wav' || n.endsWith('.wav')) return WavOutputFormat;
	if (t === 'audio/mpeg' || t === 'audio/mp3' || n.endsWith('.mp3')) return Mp3OutputFormat;
	if (t === 'audio/ogg' || t === 'audio/opus' || t === 'audio/vorbis' || n.endsWith('.ogg') || n.endsWith('.oga')) return OggOutputFormat;
	if (t === 'audio/flac' || n.endsWith('.flac')) return FlacOutputFormat;
	if (t === 'audio/mp4' || t === 'audio/m4a' || n.endsWith('.m4a') || n.endsWith('.mp4')) return Mp4OutputFormat;
	if (t === 'audio/aac' || n.endsWith('.aac')) return AdtsOutputFormat;
	if (t === 'audio/webm' || n.endsWith('.webm')) return WebMOutputFormat;
	if (t === 'audio/x-matroska' || n.endsWith('.mkv')) return MkvOutputFormat;
	return WavOutputFormat;
}

function mimeForFormat(formatClass) {
	if (formatClass === WavOutputFormat) return 'audio/wav';
	if (formatClass === Mp3OutputFormat) return 'audio/mpeg';
	if (formatClass === OggOutputFormat) return 'audio/ogg';
	if (formatClass === FlacOutputFormat) return 'audio/flac';
	if (formatClass === Mp4OutputFormat || formatClass === MovOutputFormat) return 'audio/mp4';
	if (formatClass === AdtsOutputFormat) return 'audio/aac';
	if (formatClass === WebMOutputFormat) return 'audio/webm';
	if (formatClass === MkvOutputFormat) return 'audio/x-matroska';
	return 'audio/wav';
}

export async function readAudioInfo(file) {
	const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
	const duration = await input.computeDuration();
	const audioTrack = await input.getPrimaryAudioTrack();
	if (!audioTrack) {
		await input.cancel?.().catch(()=>{});
		throw new Error('No audio track found in this file.');
	}
	const codec = await audioTrack.getCodec();
	const sampleRate = await audioTrack.getSampleRate();
	const numberOfChannels = await audioTrack.getNumberOfChannels();
	const decoderConfig = await audioTrack.getDecoderConfig();
	const formatClass = detectOutputFormat(file);
	return {
		input, audioTrack, duration, codec, sampleRate,
		numberOfChannels, decoderConfig, formatClass
	};
}

async function streamCopyChunk(
	input,
	audioTrack,
	codec,
	decoderConfig,
	FormatClass,
	start,
	end
) {
	const target = new BufferTarget();

	const output = new Output({
		format: new FormatClass(),
		target
	});

	const source = new EncodedAudioPacketSource(codec);
	output.addAudioTrack(source, {});

	await output.start();

	const sink = new EncodedPacketSink(audioTrack);
	let addedPacket = false;

	for await (const packet of sink.packets()) {
		const packetStart = packet.timestamp;
		const packetEnd = packet.timestamp + packet.duration;

		if (packetStart >= end) break;

		// keep the first overlapping packet so decoding starts cleanly
		if (packetEnd <= start) continue;

		if (!(packet.data instanceof Uint8Array) || packet.data.byteLength === 0) {
			continue;
		}

		const shifted = packet.clone({
			timestamp: Math.max(0, packet.timestamp - start)
		});

		if (!addedPacket) {
			await source.add(shifted, {
				decoderConfig
			});
			addedPacket = true;
		} else {
			await source.add(shifted);
		}
	}

	source.close();
	await output.finalize();

	if (!addedPacket) {
		throw new Error(`No audio packets found in range ${start}–${end}.`);
	}

	return target.buffer;
}


async function transcodeChunk(file, start, end) {
	const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
	const output = new Output({ format: new WavOutputFormat(), target: new BufferTarget() });
	const conversion = await Conversion.init({
		input, output,
		trim: { start, end },
		audio: {}
	});
	if (!conversion.isValid) {
		throw new Error('This audio format cannot be trimmed in this browser. Try WAV or MP3.');
	}
	await conversion.execute();
	return output.target.buffer;
}

export function computeChunks(duration, chunkDuration, overlap) {
	const chunks = [];
	let start = 0;
	let num = 1;
	while (start < duration) {
		const end = Math.min(start + chunkDuration, duration);
		chunks.push({ num, start, end });
		start = end - overlap;
		if (end >= duration) break;
		num++;
	}
	return chunks;
}

export async function makeChunkBlobs(file, chunkDuration, overlap, onProgress) {
	const info = await readAudioInfo(file);
	const chunks = computeChunks(info.duration, chunkDuration, overlap);
	const blobs = [];
	for (let i = 0; i < chunks.length; i++) {
		const { start, end, num } = chunks[i];
		let buffer;
		let mode = 'copy';
		try {
			buffer = await streamCopyChunk(info.input, info.audioTrack, info.codec, info.decoderConfig, info.formatClass, start, end);
		} catch (e) {
			mode = 'transcode';
			console.warn('Stream copy failed for chunk', num, e);
			buffer = await transcodeChunk(file, start, end);
		}
		blobs.push({ num, start, end, blob: new Blob([buffer], { type: mimeForFormat(info.formatClass) }), mode });
		if (onProgress) onProgress(i + 1, chunks.length, `created chunk ${num}/${chunks.length}`);
		await sleep(0);
	}
	await info.input.cancel?.().catch(()=>{});
	return { chunks, blobs, duration: info.duration };
}

export function normalizeModelName(model) {
	return model.replace(/^models\//, '');
}
