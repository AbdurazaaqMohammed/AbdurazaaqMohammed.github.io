import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

export async function searchWikimediaImages(query, limit = 12) {
	const searchUrl = `${COMMONS_API}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=${limit}&format=json&origin=*`;
	const searchResp = await fetch(searchUrl);
	const searchData = await searchResp.json();
	const results = searchData.query?.search || [];
	if (results.length === 0) return [];

	const titles = results.map(r => r.title).join('|');
	const infoUrl = `${COMMONS_API}?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|size|mime|thumburl&iiurlwidth=300&format=json&origin=*`;
	const infoResp = await fetch(infoUrl);
	const infoData = await infoResp.json();
	const pages = infoData.query?.pages || {};
	return Object.values(pages)
		.map(p => {
			const ii = p.imageinfo?.[0];
			if (!ii) return null;
			return {
				title: p.title,
				url: ii.url,
				thumb: ii.thumburl || ii.url,
				width: ii.width,
				height: ii.height
			};
		})
		.filter(Boolean);
}

const cardDesigns = {
	'islamic-gold': {
		islamic: true,
		fg: '#fdf6e7',
		accent: '#ecc987',
		font: "'Cormorant Garamond','Times New Roman',Georgia,serif",
		arFont: "'Amiri','Noto Naskh Arabic',serif",
		bg: 'linear-gradient(160deg,#07281e 0%,#051f17 55%,#04160f 100%)',
		ruleColor: 'rgba(244,215,154,.9)',
		narrationColor: 'rgba(253,244,226,.88)',
		arabicColor: '#fffaf0',
		sourceColor: 'rgba(244,222,182,.85)',
		frameColor: 'rgba(238,199,124,.5)',
		frameAccent: '#f7dfa8'
	},
	'islamic-teal': {
		islamic: true,
		fg: '#f0fdfa',
		accent: '#5eead4',
		font: "'Cormorant Garamond','Times New Roman',Georgia,serif",
		arFont: "'Amiri','Noto Naskh Arabic',serif",
		bg: 'linear-gradient(160deg,#083344 0%,#042f2e 55%,#04241f 100%)',
		ruleColor: 'rgba(153,246,228,.9)',
		narrationColor: 'rgba(240,253,250,.9)',
		arabicColor: '#f0fdfa',
		sourceColor: 'rgba(153,246,228,.9)',
		frameColor: 'rgba(94,234,212,.5)',
		frameAccent: '#99f6e4'
	},
	'minimal-light': {
		islamic: false,
		fg: '#0f172a',
		accent: '#4338ca',
		font: "'Inter',system-ui,-apple-system,'Segoe UI',sans-serif",
		arFont: "'Amiri',serif",
		bg: 'radial-gradient(1200px 800px at 20% -10%, #e0e7ff 0%, transparent 60%), linear-gradient(160deg,#f8fafc 0%,#eef2f7 100%)',
		ruleColor: 'rgba(67,56,202,.45)',
		narrationColor: 'rgba(30,41,59,.85)',
		arabicColor: '#1e293b',
		sourceColor: 'rgba(67,56,202,.85)',
		frameColor: 'rgba(67,56,202,.4)',
		frameAccent: '#4338ca'
	},
	'minimal-dark': {
		islamic: false,
		fg: '#f8fafc',
		accent: '#818cf8',
		font: "'Inter',system-ui,-apple-system,'Segoe UI',sans-serif",
		arFont: "'Amiri',serif",
		bg: 'radial-gradient(1200px 800px at 80% -10%, rgba(129,140,248,.12) 0%, transparent 60%), linear-gradient(160deg,#111827 0%,#0b1120 100%)',
		ruleColor: 'rgba(165,180,252,.7)',
		narrationColor: 'rgba(226,232,240,.9)',
		arabicColor: '#e2e8f0',
		sourceColor: 'rgba(165,180,252,.9)',
		frameColor: 'rgba(129,140,248,.4)',
		frameAccent: '#a5b4fc'
	},
	'gradient-purple': {
		islamic: false,
		fg: '#fff',
		accent: '#c4b5fd',
		font: "'Lexend Deca',system-ui,sans-serif",
		arFont: "'Amiri',serif",
		bg: 'radial-gradient(1000px 700px at 80% -10%, rgba(196,181,253,.25) 0%, transparent 55%), linear-gradient(135deg,#312e81 0%,#4c1d95 60%,#7c3aed 100%)',
		ruleColor: 'rgba(221,214,254,.8)',
		narrationColor: 'rgba(237,233,254,.95)',
		arabicColor: '#f5f3ff',
		sourceColor: 'rgba(221,214,254,.9)',
		frameColor: 'rgba(196,181,253,.5)',
		frameAccent: '#ddd6fe'
	},
	'gradient-sunset': {
		islamic: false,
		fg: '#fff',
		accent: '#fed7aa',
		font: "'Lexend Deca',system-ui,sans-serif",
		arFont: "'Amiri',serif",
		bg: 'radial-gradient(1000px 700px at 20% 0%, rgba(254,215,170,.25) 0%, transparent 55%), linear-gradient(135deg,#7c2d12 0%,#be185d 60%,#f97316 100%)',
		ruleColor: 'rgba(254,215,170,.8)',
		narrationColor: 'rgba(255,237,213,.95)',
		arabicColor: '#fff7ed',
		sourceColor: 'rgba(254,215,170,.95)',
		frameColor: 'rgba(254,215,170,.5)',
		frameAccent: '#fed7aa'
	},
	'paper-ink': {
		islamic: false,
		fg: '#1c1917',
		accent: '#b91c1c',
		font: "Georgia,'Times New Roman',serif",
		arFont: "'Amiri',serif",
		bg: 'linear-gradient(160deg,#faf7f2 0%,#f3eee4 55%,#eae2d4 100%)',
		ruleColor: 'rgba(28,25,23,.4)',
		narrationColor: 'rgba(28,25,23,.82)',
		arabicColor: '#1c1917',
		sourceColor: 'rgba(153,27,27,.9)',
		frameColor: 'rgba(28,25,23,.35)',
		frameAccent: '#1c1917'
	},
	'noir': {
		islamic: false,
		fg: '#f5f5f5',
		accent: '#e5e5e5',
		font: "'Courier New',Courier,monospace",
		arFont: "'Amiri',serif",
		bg: 'radial-gradient(1000px 700px at 80% -10%, rgba(255,255,255,.08) 0%, transparent 55%), linear-gradient(165deg,#161616 0%,#0a0a0a 55%,#000 100%)',
		ruleColor: 'rgba(229,229,229,.5)',
		narrationColor: 'rgba(245,245,245,.85)',
		arabicColor: '#fafafa',
		sourceColor: 'rgba(229,229,229,.7)',
		frameColor: 'rgba(229,229,229,.4)',
		frameAccent: '#ffffff'
	},
	'midnight-ocean': {
		islamic: false,
		fg: '#eaf4ff',
		accent: '#38bdf8',
		font: "'Cormorant Garamond','Times New Roman',Georgia,serif",
		arFont: "'Amiri',serif",
		bg: 'radial-gradient(1000px 700px at 80% -10%, rgba(56,189,248,.16) 0%, transparent 55%), linear-gradient(165deg,#0d1f42 0%,#0a1530 55%,#060e22 100%)',
		ruleColor: 'rgba(125,211,252,.65)',
		narrationColor: 'rgba(226,240,255,.88)',
		arabicColor: '#f0f9ff',
		sourceColor: 'rgba(125,211,252,.85)',
		frameColor: 'rgba(56,189,248,.42)',
		frameAccent: '#7dd3fc'
	},
	'rosewood': {
		islamic: false,
		fg: '#fbeff4',
		accent: '#e8a87c',
		font: "'Cormorant Garamond','Times New Roman',Georgia,serif",
		arFont: "'Amiri',serif",
		bg: 'radial-gradient(1000px 700px at 80% -10%, rgba(232,168,124,.12) 0%, transparent 55%), linear-gradient(165deg,#2b1220 0%,#1e0c16 55%,#140710 100%)',
		ruleColor: 'rgba(232,168,124,.65)',
		narrationColor: 'rgba(251,239,244,.88)',
		arabicColor: '#fff5f8',
		sourceColor: 'rgba(232,168,124,.85)',
		frameColor: 'rgba(232,168,124,.45)',
		frameAccent: '#f3c4a4'
	},
	'emerald-forest': {
		islamic: false,
		fg: '#ecfdf5',
		accent: '#34d399',
		font: "'Cormorant Garamond','Times New Roman',Georgia,serif",
		arFont: "'Amiri',serif",
		bg: 'radial-gradient(1000px 700px at 80% -10%, rgba(52,211,153,.12) 0%, transparent 55%), linear-gradient(165deg,#0b2e24 0%,#072119 55%,#04170f 100%)',
		ruleColor: 'rgba(110,231,183,.6)',
		narrationColor: 'rgba(236,253,245,.88)',
		arabicColor: '#f0fdf9',
		sourceColor: 'rgba(110,231,183,.82)',
		frameColor: 'rgba(52,211,153,.4)',
		frameAccent: '#6ee7b7'
	},
	'crimson-royal': {
		islamic: false,
		fg: '#fdf2f4',
		accent: '#d4a03c',
		font: "'Cormorant Garamond','Times New Roman',Georgia,serif",
		arFont: "'Amiri',serif",
		bg: 'radial-gradient(1000px 700px at 80% -10%, rgba(212,160,60,.14) 0%, transparent 55%), linear-gradient(165deg,#3d0a15 0%,#2c070f 55%,#1e040a 100%)',
		ruleColor: 'rgba(212,160,60,.7)',
		narrationColor: 'rgba(253,242,244,.88)',
		arabicColor: '#fff8ea',
		sourceColor: 'rgba(212,160,60,.85)',
		frameColor: 'rgba(212,160,60,.45)',
		frameAccent: '#e5c07b'
	},
	'pastel-dawn': {
		islamic: false,
		fg: '#3b2f4f',
		accent: '#7c3aed',
		font: "'Cormorant Garamond','Times New Roman',Georgia,serif",
		arFont: "'Amiri',serif",
		bg: 'linear-gradient(160deg,#fdf2f8 0%,#ede9fe 55%,#e0f2fe 100%)',
		ruleColor: 'rgba(124,58,237,.4)',
		narrationColor: 'rgba(59,47,79,.82)',
		arabicColor: '#4c1d95',
		sourceColor: 'rgba(124,58,237,.75)',
		frameColor: 'rgba(124,58,237,.32)',
		frameAccent: '#8b5cf6'
	},
	'sahara': {
		islamic: false,
		fg: '#3f2d20',
		accent: '#c2410c',
		font: "'Cormorant Garamond','Times New Roman',Georgia,serif",
		arFont: "'Amiri',serif",
		bg: 'linear-gradient(160deg,#fdf6ec 0%,#f8ead8 55%,#f2dfc7 100%)',
		ruleColor: 'rgba(194,65,12,.42)',
		narrationColor: 'rgba(63,45,32,.85)',
		arabicColor: '#7c2d12',
		sourceColor: 'rgba(194,65,12,.8)',
		frameColor: 'rgba(120,53,15,.35)',
		frameAccent: '#9a3412'
	},
	'electric-ice': {
		islamic: false,
		fg: '#111827',
		accent: '#2563eb',
		font: "'Cormorant Garamond','Times New Roman',Georgia,serif",
		arFont: "'Amiri',serif",
		bg: 'radial-gradient(1000px 700px at 80% -10%, rgba(37,99,235,.14) 0%, transparent 55%), linear-gradient(165deg,#f7fafc 0%,#e9eef5 55%,#dde5ef 100%)',
		ruleColor: 'rgba(37,99,235,.45)',
		narrationColor: 'rgba(17,24,39,.82)',
		arabicColor: '#1e3a8a',
		sourceColor: 'rgba(37,99,235,.8)',
		frameColor: 'rgba(37,99,235,.35)',
		frameAccent: '#3b82f6'
	},
	'denim-sky': {
		islamic: false,
		fg: '#1e293b',
		accent: '#0284c7',
		font: "'Cormorant Garamond','Times New Roman',Georgia,serif",
		arFont: "'Amiri',serif",
		bg: 'radial-gradient(1000px 700px at 80% -10%, rgba(2,132,199,.12) 0%, transparent 55%), linear-gradient(160deg,#f0f6fb 0%,#e2edf6 55%,#d3e3f0 100%)',
		ruleColor: 'rgba(2,132,199,.42)',
		narrationColor: 'rgba(30,41,59,.84)',
		arabicColor: '#0c4a6e',
		sourceColor: 'rgba(2,132,199,.78)',
		frameColor: 'rgba(2,132,199,.32)',
		frameAccent: '#0ea5e9'
	}
};

const slideDesigns = {
	'islamic-gold': {
		bg: 'radial-gradient(1200px 700px at 80% -10%, rgba(201,162,75,.08) 0%, transparent 60%), radial-gradient(1000px 800px at -10% 110%, rgba(201,162,75,.05) 0%, transparent 55%), linear-gradient(160deg,#07281e 0%,#051f17 55%,#04160f 100%)',
		fg: '#f9f3e4',
		accent: '#c9a24b',
		accentBright: '#d9bf82',
		kicker: '#d9bf82',
		accentMid: '#f0e7cc',
		cardBg: 'linear-gradient(175deg,rgba(18,68,51,.72),rgba(8,42,31,.88) 70%)',
		cardFg: '#cbd5c6',
		border: 'rgba(201,162,75,.38)',
		borderStrong: 'rgba(201,162,75,.4)',
		arColor: '#e2cd9e',
		qboxBg: 'rgba(201,162,75,.10)',
		qboxBorder: 'rgba(201,162,75,.35)',
		teal: '#0e7566',
		crimson: '#a63e2c'
	},
	'islamic-teal': {
		bg: 'radial-gradient(1200px 700px at 80% -10%, rgba(94,234,212,.07) 0%, transparent 60%), radial-gradient(1000px 800px at -10% 110%, rgba(94,234,212,.05) 0%, transparent 55%), linear-gradient(160deg,#083344 0%,#042f2e 55%,#04241f 100%)',
		fg: '#ecfeff',
		accent: '#2dd4bf',
		accentBright: '#5eead4',
		kicker: '#5eead4',
		accentMid: '#ccfbf1',
		cardBg: 'linear-gradient(175deg,rgba(8,51,68,.72),rgba(4,47,46,.88) 70%)',
		cardFg: '#c5e4e1',
		border: 'rgba(45,212,191,.38)',
		borderStrong: 'rgba(45,212,191,.5)',
		arColor: '#99f6e4',
		qboxBg: 'rgba(45,212,191,.10)',
		qboxBorder: 'rgba(45,212,191,.35)',
		teal: '#2dd4bf',
		crimson: '#f87171'
	},
	'minimal-light': {
		bg: 'linear-gradient(160deg,#f8fafc 0%,#eef2f7 100%)',
		fg: '#0f172a',
		accent: '#4f46e5',
		accentBright: '#6366f1',
		kicker: '#4338ca',
		accentMid: '#312e81',
		cardBg: 'linear-gradient(175deg,rgba(255,255,255,.92),rgba(238,242,247,.92) 70%)',
		cardFg: '#334155',
		border: 'rgba(79,70,229,.35)',
		borderStrong: 'rgba(79,70,229,.4)',
		arColor: '#4338ca',
		qboxBg: 'rgba(79,70,229,.06)',
		qboxBorder: 'rgba(79,70,229,.3)',
		teal: '#0e7490',
		crimson: '#b91c1c'
	},
	'minimal-dark': {
		bg: 'linear-gradient(160deg,#111827 0%,#0b1120 100%)',
		fg: '#f8fafc',
		accent: '#818cf8',
		accentBright: '#a5b4fc',
		kicker: '#a5b4fc',
		accentMid: '#e2e8f0',
		cardBg: 'linear-gradient(175deg,rgba(31,41,55,.85),rgba(15,23,42,.9) 70%)',
		cardFg: '#cbd5e1',
		border: 'rgba(129,140,248,.35)',
		borderStrong: 'rgba(129,140,248,.4)',
		arColor: '#a5b4fc',
		qboxBg: 'rgba(129,140,248,.08)',
		qboxBorder: 'rgba(129,140,248,.35)',
		teal: '#22d3ee',
		crimson: '#f87171'
	},
	'gradient-purple': {
		bg: 'linear-gradient(135deg,#312e81 0%,#4c1d95 60%,#7c3aed 100%)',
		fg: '#fff',
		accent: '#c4b5fd',
		accentBright: '#ddd6fe',
		kicker: '#ddd6fe',
		accentMid: '#ede9fe',
		cardBg: 'linear-gradient(175deg,rgba(255,255,255,.10),rgba(255,255,255,.04) 70%)',
		cardFg: '#e9e4ff',
		border: 'rgba(196,181,253,.4)',
		borderStrong: 'rgba(196,181,253,.5)',
		arColor: '#ddd6fe',
		qboxBg: 'rgba(196,181,253,.12)',
		qboxBorder: 'rgba(196,181,253,.4)',
		teal: '#67e8f9',
		crimson: '#fda4af'
	},
	'gradient-sunset': {
		bg: 'linear-gradient(135deg,#7c2d12 0%,#be185d 60%,#f97316 100%)',
		fg: '#fff',
		accent: '#fed7aa',
		accentBright: '#fed7aa',
		kicker: '#fed7aa',
		accentMid: '#ffedd5',
		cardBg: 'linear-gradient(175deg,rgba(255,255,255,.10),rgba(255,255,255,.04) 70%)',
		cardFg: '#ffe8d6',
		border: 'rgba(254,215,170,.4)',
		borderStrong: 'rgba(254,215,170,.5)',
		arColor: '#fed7aa',
		qboxBg: 'rgba(254,215,170,.12)',
		qboxBorder: 'rgba(254,215,170,.4)',
		teal: '#5eead4',
		crimson: '#fecaca'
	},
	'paper-ink': {
		bg: 'radial-gradient(1200px 700px at 85% -10%, rgba(185,28,28,.05) 0%, transparent 55%), linear-gradient(160deg,#faf7f2 0%,#efe8db 100%)',
		fg: '#1c1917',
		accent: '#b91c1c',
		accentBright: '#dc2626',
		kicker: '#991b1b',
		accentMid: '#44403c',
		cardBg: 'linear-gradient(175deg,rgba(255,255,255,.94),rgba(248,244,236,.94) 70%)',
		cardFg: '#292524',
		border: 'rgba(28,25,23,.22)',
		borderStrong: 'rgba(28,25,23,.4)',
		arColor: '#991b1b',
		qboxBg: 'rgba(185,28,28,.05)',
		qboxBorder: 'rgba(185,28,28,.28)',
		teal: '#0f766e',
		crimson: '#b91c1c'
	},
	'noir': {
		bg: 'radial-gradient(1200px 700px at 85% -10%, rgba(255,255,255,.06) 0%, transparent 55%), linear-gradient(165deg,#141414 0%,#050505 100%)',
		fg: '#f5f5f5',
		accent: '#d4d4d4',
		accentBright: '#ffffff',
		kicker: '#a3a3a3',
		accentMid: '#e5e5e5',
		cardBg: 'linear-gradient(175deg,rgba(255,255,255,.07),rgba(255,255,255,.03) 70%)',
		cardFg: '#d4d4d4',
		border: 'rgba(255,255,255,.28)',
		borderStrong: 'rgba(255,255,255,.45)',
		arColor: '#f5f5f5',
		qboxBg: 'rgba(255,255,255,.06)',
		qboxBorder: 'rgba(255,255,255,.3)',
		teal: '#a3a3a3',
		crimson: '#ef4444'
	},
	'midnight-ocean': {
		bg: 'radial-gradient(1200px 700px at 85% -10%, rgba(56,189,248,.1) 0%, transparent 55%), radial-gradient(1000px 800px at -10% 110%, rgba(14,165,233,.06) 0%, transparent 55%), linear-gradient(165deg,#0d1f42 0%,#060e22 100%)',
		fg: '#eaf4ff',
		accent: '#38bdf8',
		accentBright: '#7dd3fc',
		kicker: '#7dd3fc',
		accentMid: '#dbeafe',
		cardBg: 'linear-gradient(175deg,rgba(13,31,66,.78),rgba(6,14,34,.9) 70%)',
		cardFg: '#c3d8f5',
		border: 'rgba(56,189,248,.3)',
		borderStrong: 'rgba(56,189,248,.5)',
		arColor: '#7dd3fc',
		qboxBg: 'rgba(56,189,248,.09)',
		qboxBorder: 'rgba(56,189,248,.35)',
		teal: '#22d3ee',
		crimson: '#fca5a5'
	},
	'rosewood': {
		bg: 'radial-gradient(1200px 700px at 85% -10%, rgba(232,168,124,.09) 0%, transparent 55%), radial-gradient(1000px 800px at -10% 110%, rgba(190,24,93,.06) 0%, transparent 55%), linear-gradient(165deg,#2b1220 0%,#140710 100%)',
		fg: '#fbeff4',
		accent: '#e8a87c',
		accentBright: '#f3c4a4',
		kicker: '#f3c4a4',
		accentMid: '#fde8d8',
		cardBg: 'linear-gradient(175deg,rgba(43,18,32,.78),rgba(20,7,16,.9) 70%)',
		cardFg: '#e6cdd8',
		border: 'rgba(232,168,124,.32)',
		borderStrong: 'rgba(232,168,124,.5)',
		arColor: '#f3c4a4',
		qboxBg: 'rgba(232,168,124,.09)',
		qboxBorder: 'rgba(232,168,124,.35)',
		teal: '#2dd4bf',
		crimson: '#fb7185'
	},
	'emerald-forest': {
		bg: 'radial-gradient(1200px 700px at 85% -10%, rgba(52,211,153,.08) 0%, transparent 55%), radial-gradient(1000px 800px at -10% 110%, rgba(16,185,129,.05) 0%, transparent 55%), linear-gradient(165deg,#0b2e24 0%,#04170f 100%)',
		fg: '#ecfdf5',
		accent: '#34d399',
		accentBright: '#6ee7b7',
		kicker: '#6ee7b7',
		accentMid: '#d1fae5',
		cardBg: 'linear-gradient(175deg,rgba(11,46,36,.78),rgba(4,23,15,.9) 70%)',
		cardFg: '#c0ded2',
		border: 'rgba(52,211,153,.3)',
		borderStrong: 'rgba(52,211,153,.5)',
		arColor: '#6ee7b7',
		qboxBg: 'rgba(52,211,153,.08)',
		qboxBorder: 'rgba(52,211,153,.35)',
		teal: '#2dd4bf',
		crimson: '#f87171'
	},
	'crimson-royal': {
		bg: 'radial-gradient(1200px 700px at 85% -10%, rgba(212,160,60,.1) 0%, transparent 55%), radial-gradient(1000px 800px at -10% 110%, rgba(190,24,60,.07) 0%, transparent 55%), linear-gradient(165deg,#3d0a15 0%,#1e040a 100%)',
		fg: '#fdf2f4',
		accent: '#d4a03c',
		accentBright: '#e5c07b',
		kicker: '#e5c07b',
		accentMid: '#f7e7c3',
		cardBg: 'linear-gradient(175deg,rgba(61,10,21,.78),rgba(30,4,10,.9) 70%)',
		cardFg: '#e3c3c9',
		border: 'rgba(212,160,60,.35)',
		borderStrong: 'rgba(212,160,60,.55)',
		arColor: '#e5c07b',
		qboxBg: 'rgba(212,160,60,.1)',
		qboxBorder: 'rgba(212,160,60,.4)',
		teal: '#2dd4bf',
		crimson: '#fda4af'
	},
	'pastel-dawn': {
		bg: 'radial-gradient(1200px 700px at 85% -10%, rgba(244,114,182,.14) 0%, transparent 55%), linear-gradient(160deg,#fdf2f8 0%,#ede9fe 55%,#e0f2fe 100%)',
		fg: '#3b2f4f',
		accent: '#7c3aed',
		accentBright: '#8b5cf6',
		kicker: '#6d28d9',
		accentMid: '#4c1d95',
		cardBg: 'linear-gradient(175deg,rgba(255,255,255,.94),rgba(245,243,255,.9) 70%)',
		cardFg: '#44365c',
		border: 'rgba(124,58,237,.25)',
		borderStrong: 'rgba(124,58,237,.45)',
		arColor: '#6d28d9',
		qboxBg: 'rgba(124,58,237,.06)',
		qboxBorder: 'rgba(124,58,237,.3)',
		teal: '#0e7490',
		crimson: '#be185d'
	},
	'sahara': {
		bg: 'radial-gradient(1200px 700px at 85% -10%, rgba(194,65,12,.08) 0%, transparent 55%), linear-gradient(160deg,#fdf6ec 0%,#f2dfc7 100%)',
		fg: '#3f2d20',
		accent: '#c2410c',
		accentBright: '#ea580c',
		kicker: '#9a3412',
		accentMid: '#7c2d12',
		cardBg: 'linear-gradient(175deg,rgba(255,251,245,.94),rgba(250,238,221,.92) 70%)',
		cardFg: '#57402e',
		border: 'rgba(194,65,12,.3)',
		borderStrong: 'rgba(194,65,12,.5)',
		arColor: '#9a3412',
		qboxBg: 'rgba(194,65,12,.06)',
		qboxBorder: 'rgba(194,65,12,.3)',
		teal: '#0f766e',
		crimson: '#b91c1c'
	},
	'electric-ice': {
		bg: 'radial-gradient(1200px 700px at 85% -10%, rgba(37,99,235,.1) 0%, transparent 55%), radial-gradient(1000px 800px at -10% 110%, rgba(14,165,233,.06) 0%, transparent 55%), linear-gradient(165deg,#f7fafc 0%,#dde5ef 100%)',
		fg: '#111827',
		accent: '#2563eb',
		accentBright: '#3b82f6',
		kicker: '#1d4ed8',
		accentMid: '#1e3a8a',
		cardBg: 'linear-gradient(175deg,rgba(255,255,255,.95),rgba(241,245,249,.92) 70%)',
		cardFg: '#334155',
		border: 'rgba(37,99,235,.3)',
		borderStrong: 'rgba(37,99,235,.5)',
		arColor: '#1d4ed8',
		qboxBg: 'rgba(37,99,235,.06)',
		qboxBorder: 'rgba(37,99,235,.3)',
		teal: '#0891b2',
		crimson: '#b91c1c'
	},
	'denim-sky': {
		bg: 'radial-gradient(1200px 700px at 85% -10%, rgba(2,132,199,.1) 0%, transparent 55%), linear-gradient(160deg,#f0f6fb 0%,#d3e3f0 100%)',
		fg: '#1e293b',
		accent: '#0284c7',
		accentBright: '#0ea5e9',
		kicker: '#075985',
		accentMid: '#0c4a6e',
		cardBg: 'linear-gradient(175deg,rgba(255,255,255,.94),rgba(240,246,251,.92) 70%)',
		cardFg: '#33455c',
		border: 'rgba(2,132,199,.3)',
		borderStrong: 'rgba(2,132,199,.5)',
		arColor: '#075985',
		qboxBg: 'rgba(2,132,199,.06)',
		qboxBorder: 'rgba(2,132,199,.3)',
		teal: '#0d9488',
		crimson: '#b91c1c'
	}
};

const VISUAL_CSS = `
.tr-post,.tr-deck{font-family:'Inter',system-ui,sans-serif}
.tr-post h1,.tr-post h2,.tr-post h3,.tr-deck h1,.tr-deck h2,.tr-deck h3{font-family:'Cormorant Garamond','Times New Roman',Georgia,serif}

.tr-post{position:relative;width:1080px;height:1080px;flex:none;overflow:hidden;border-radius:6px;box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 1px rgba(255,220,150,.08)}
.tr-sky{position:absolute;inset:0;background:radial-gradient(ellipse 68% 42% at 50% 97%,rgba(255,235,168,.9) 0%,rgba(255,205,118,.52) 34%,rgba(240,175,90,.22) 58%,rgba(240,175,90,0) 76%),linear-gradient(180deg,#0d2b25 0%,#124138 18%,#1e5344 34%,#3f6a45 47%,#6e7a41 57%,#a38a44 67%,#c99f4e 77%,#dfb45e 87%,#eecb79 100%)}
.tr-teal-sky{position:absolute;inset:0;background:radial-gradient(ellipse 68% 42% at 50% 97%,rgba(186,230,253,.9) 0%,rgba(125,211,252,.5) 34%,rgba(56,189,248,.2) 58%,rgba(56,189,248,0) 76%),linear-gradient(180deg,#042f2e 0%,#065f46 20%,#047857 40%,#0f766e 58%,#0891b2 100%)}
.tr-sun{position:absolute;left:50%;top:91%;width:360px;height:360px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fffbe4 0%,#ffedaf 30%,rgba(255,210,120,.7) 52%,rgba(255,185,95,0) 74%);filter:blur(2px)}
.tr-field{position:absolute;left:0;right:0;bottom:0;height:300px;opacity:.5;background:repeating-linear-gradient(94deg,rgba(122,86,32,.16) 0 6px,transparent 6px 26px),repeating-linear-gradient(86deg,rgba(255,222,140,.12) 0 4px,transparent 4px 34px);-webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 55%);mask-image:linear-gradient(180deg,transparent 0%,#000 55%)}
.tr-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55;mix-blend-mode:soft-light;filter:saturate(1.2) brightness(1.05)}
.tr-pattern{position:absolute;inset:0;opacity:.05;mix-blend-mode:screen;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Cg fill='none' stroke='%23f4d79a' stroke-width='1'%3E%3Cpath d='M48 8 L58 38 L88 48 L58 58 L48 88 L38 58 L8 48 L38 38 Z'/%3E%3Ccircle cx='48' cy='48' r='11'/%3E%3C/g%3E%3C/svg%3E");background-size:96px 96px}
.tr-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,26,20,.74) 0%,rgba(13,34,26,.46) 26%,rgba(24,38,22,.32) 50%,rgba(42,42,18,.42) 74%,rgba(22,20,8,.72) 100%),radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 55%,rgba(6,12,8,.38) 100%)}
.tr-scrim-light{position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,47,46,.74) 0%,rgba(6,78,59,.46) 30%,rgba(8,90,76,.35) 55%,rgba(6,78,59,.45) 78%,rgba(4,47,46,.7) 100%),radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 55%,rgba(3,32,28,.4) 100%)}
.tr-scrim-soft{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,0) 40%,rgba(0,0,0,.10) 100%)}
.tr-frame{position:absolute;inset:36px;pointer-events:none;z-index:5;border:1.5px solid var(--tr-frame-color,rgba(238,199,124,.5));box-shadow:inset 0 0 0 1px var(--tr-frame-inner,rgba(238,199,124,.12))}
.tr-frame i{position:absolute;width:30px;height:30px;border-color:var(--tr-frame-accent,#f7dfa8);border-style:solid;border-width:0}
.tr-frame .c1{top:-3px;left:-3px;border-top-width:2.5px;border-left-width:2.5px}
.tr-frame .c2{top:-3px;right:-3px;border-top-width:2.5px;border-right-width:2.5px}
.tr-frame .c3{bottom:-3px;left:-3px;border-bottom-width:2.5px;border-left-width:2.5px}
.tr-frame .c4{bottom:-3px;right:-3px;border-bottom-width:2.5px;border-right-width:2.5px}
.tr-content{position:relative;z-index:4;height:100%;padding:72px 104px 60px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.tr-title{font-weight:600;font-size:47px;line-height:1.22;letter-spacing:.12em;text-transform:uppercase;background:linear-gradient(180deg,#ffeec4 15%,#f2cd8d 60%,#dfa95e 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 14px rgba(0,0,0,.35));max-width:850px;margin:0}
.tr-title.simple{text-transform:none;letter-spacing:.01em;font-size:58px;line-height:1.18;color:inherit;-webkit-background-clip:initial;background-clip:initial;filter:none;font-weight:600}
.tr-rule{display:flex;align-items:center;gap:14px;margin:18px auto 22px;width:min(420px,80%);flex:none}
.tr-rule::before,.tr-rule::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--tr-rule-color,rgba(244,215,154,.9)))}
.tr-rule::after{background:linear-gradient(90deg,var(--tr-rule-color,rgba(244,215,154,.9)),transparent)}
.tr-rule b{width:9px;height:9px;background:var(--tr-accent,#f7dfa8);transform:rotate(45deg);flex:none;box-shadow:0 0 12px rgba(247,223,168,.9)}
.tr-narration{font-style:italic;font-weight:500;font-size:29px;line-height:1.5;color:var(--tr-narration-color,rgba(253,244,226,.88));max-width:820px;margin:0 0 10px}
.tr-arabic{direction:rtl;font-family:'Amiri','Noto Naskh Arabic',serif;font-weight:500;font-size:62px;line-height:2;max-width:900px;color:var(--tr-arabic-color,#fffaf0);text-shadow:0 2px 26px rgba(8,20,14,.55),0 1px 4px rgba(8,20,14,.4);margin:0 0 10px}
.tr-source{margin-top:auto;padding-top:20px;font-weight:600;font-size:23px;letter-spacing:.09em;color:var(--tr-source-color,rgba(244,222,182,.85))}

.tr-deck{width:1280px}
.tr-slide{position:relative;width:1280px;height:720px;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:50px 70px;box-sizing:border-box;page-break-after:always;break-after:page}
.tr-slide .tr-bg{position:absolute;inset:0;z-index:0}
.tr-slide .tr-pattern{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.5;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cg fill='none' stroke='%23c9a24b' stroke-opacity='0.06' stroke-width='1'%3E%3Cpath d='M70 12 L82 46 L116 58 L82 70 L70 104 L58 70 L24 58 L58 46 Z'/%3E%3Ccircle cx='70' cy='58' r='9'/%3E%3C/g%3E%3C/svg%3E")}
.tr-orn{position:absolute;z-index:0;pointer-events:none;color:rgba(201,162,75,.12)}
.tr-orn svg{display:block}
.tr-orn--tr{top:-60px;right:-60px}
.tr-orn--bl{bottom:-70px;left:-70px}
.tr-slide .tr-wrap{position:relative;z-index:1;width:min(1120px,100%)}
.tr-cover{text-align:center}
.tr-cover .tr-star{width:86px;margin:0 auto 26px;color:var(--tr-accent,#c9a24b);opacity:.9}
.tr-cover h1{font-weight:700;line-height:1.12;font-size:clamp(2rem,3.4vw,3.6rem);letter-spacing:.01em;background:linear-gradient(100deg,var(--tr-accent-bright,#d9bf82) 10%,var(--tr-cover-mid,#f0e7cc) 40%,var(--tr-accent,#c9a24b) 70%,var(--tr-accent-bright,#d9bf82));background-size:220% auto;-webkit-background-clip:text;background-clip:text;color:transparent;margin:0}
.tr-cover .tr-divider{display:flex;align-items:center;gap:14px;justify-content:center;margin-top:30px;color:var(--tr-accent,#c9a24b)}
.tr-cover .tr-divider::before,.tr-cover .tr-divider::after{content:"";height:1px;width:min(150px,22vw);background:linear-gradient(90deg,transparent,var(--tr-accent,#c9a24b))}
.tr-cover .tr-divider::after{background:linear-gradient(90deg,var(--tr-accent,#c9a24b),transparent)}
.tr-cover .tr-sub{margin-top:24px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:1.4rem;color:inherit;opacity:.8}
.tr-quote{text-align:center}
.tr-quote .tr-qmark{font-family:'Cormorant Garamond',serif;font-size:5rem;line-height:.6;color:var(--tr-accent,#c9a24b);opacity:.85;display:block;margin-bottom:8px}
.tr-quote h1{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:600;font-size:3rem;line-height:1.3;margin:0;max-width:1060px}
.tr-kicker{display:inline-flex;align-items:center;gap:10px;font-size:.78rem;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--tr-kicker,#d9bf82)}
.tr-kicker::before{content:"";width:26px;height:1px;background:linear-gradient(90deg,transparent,var(--tr-accent,#c9a24b))}
.tr-kicker::after{content:"";width:26px;height:1px;background:linear-gradient(90deg,var(--tr-accent,#c9a24b),transparent)}
.tr-rule-line{height:2px;width:64px;background:linear-gradient(90deg,var(--tr-accent,#c9a24b),transparent);border-radius:2px;margin:14px 0 22px}
.tr-content-slide .tr-kicker{margin-bottom:6px}
.tr-deck-card{background:var(--tr-card-bg,linear-gradient(175deg,rgba(18,68,51,.72),rgba(8,42,31,.88) 70%));border:1px solid var(--tr-border,rgba(201,162,75,.38));border-radius:16px;box-shadow:0 30px 70px -20px rgba(0,0,0,.55);padding:44px 56px;color:var(--tr-card-fg,#cbd5c6);max-height:600px;overflow:hidden}
.tr-pt{padding-left:20px;border-left:3px solid var(--tr-border-strong,rgba(201,162,75,.4));margin-bottom:18px}
.tr-pt:last-child{margin-bottom:0}
.tr-pt p{font-size:1.18rem;line-height:1.72;margin:0 0 9px}
.tr-pt p:last-child{margin-bottom:0}
.tr-slide-h{font-family:'Cormorant Garamond','Times New Roman',Georgia,serif;font-size:2rem;line-height:1.25;margin:0 0 18px;color:inherit}
.tr-bullets{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
.tr-bullets li{position:relative;padding-left:26px;font-size:1.12rem;line-height:1.65}
.tr-bullets li::before{content:"◆";position:absolute;left:0;top:2px;font-size:.8rem;color:var(--tr-accent,#c9a24b)}
.tr-deck-card strong{color:inherit;filter:brightness(1.15)}
.tr-deck-card a{color:var(--tr-accent-bright,#d9bf82)}
.tr-deck-card code{font-family:Consolas,monospace;font-size:.85em;background:rgba(127,127,127,.15);padding:1px 6px;border-radius:4px}
.tr-qbox{background:var(--tr-qbox-bg,rgba(201,162,75,.10));border:1px solid var(--tr-qbox-border,rgba(201,162,75,.35));border-radius:12px;padding:16px 20px;margin:10px 0 18px}
.tr-qbox .tr-ar{text-align:center;margin:0 0 8px}
.tr-ar{font-family:'Amiri','Noto Naskh Arabic',serif;direction:rtl;text-align:right;font-size:1.75rem;line-height:2.05;color:var(--tr-ar-color,#e2cd9e)}
.tr-ar-center{text-align:center}

.tr-scale{transform-origin:top left}

.tr-post[data-design="minimal-light"] .tr-frame,.tr-post[data-design="minimal-dark"] .tr-frame,
.tr-slide[data-design="minimal-light"] .tr-orn,.tr-slide[data-design="minimal-dark"] .tr-orn,
.tr-post[data-design="minimal-light"] .tr-pattern,.tr-post[data-design="minimal-dark"] .tr-pattern{display:none}
.tr-post[data-design="minimal-light"] .tr-content,.tr-post[data-design="minimal-dark"] .tr-content{align-items:flex-start;text-align:left;padding:80px 90px}
.tr-post[data-design="minimal-light"] .tr-title.simple,.tr-post[data-design="minimal-dark"] .tr-title.simple{font-size:52px;font-weight:700;letter-spacing:-.01em;text-transform:none}
.tr-slide[data-design="minimal-light"] .tr-deck-card,.tr-slide[data-design="minimal-dark"] .tr-deck-card{border-radius:6px;box-shadow:0 10px 30px -12px rgba(0,0,0,.25)}
.tr-slide[data-design="minimal-light"] .tr-cover h1,.tr-slide[data-design="minimal-dark"] .tr-cover h1{-webkit-background-clip:initial;background-clip:initial;color:inherit;background:none;letter-spacing:-.01em;font-family:'Inter',system-ui,sans-serif;font-weight:700}
.tr-post[data-design="noir"]{border-radius:0}
.tr-post[data-design="noir"] .tr-content{font-family:'Courier New',monospace}
.tr-post[data-design="noir"] .tr-title.simple{font-family:'Courier New',monospace;text-transform:uppercase;letter-spacing:.22em;font-size:44px}
.tr-post[data-design="noir"] .tr-frame{inset:24px}
.tr-slide[data-design="noir"] .tr-deck-card{border-radius:0;border-width:2px}
.tr-slide[data-design="noir"] .tr-kicker{letter-spacing:.34em}
.tr-slide[data-design="noir"] .tr-rule-line{width:120px;height:3px}
.tr-slide[data-design="noir"] .tr-cover h1{font-family:'Courier New',monospace;-webkit-background-clip:initial;background-clip:initial;color:inherit;background:none;text-transform:uppercase;letter-spacing:.12em;font-size:2.6rem}
.tr-post[data-design="paper-ink"] .tr-frame{box-shadow:inset 0 0 0 4px rgba(28,25,23,.06),inset 0 0 0 1px var(--tr-frame-inner,rgba(28,25,23,.12))}
.tr-post[data-design="paper-ink"] .tr-title.simple{font-style:italic;text-transform:none;letter-spacing:0}
.tr-slide[data-design="paper-ink"] .tr-deck-card{border-radius:4px;box-shadow:0 2px 0 rgba(28,25,23,.8),0 18px 40px -20px rgba(28,25,23,.4)}
.tr-slide[data-design="paper-ink"] .tr-kicker{font-family:Georgia,serif;font-style:italic;text-transform:none;letter-spacing:.06em;font-size:1rem}
.tr-slide[data-design="gradient-purple"] .tr-deck-card,.tr-slide[data-design="gradient-sunset"] .tr-deck-card{border-radius:26px;border-width:2px}
.tr-post[data-design="gradient-purple"] .tr-title.simple,.tr-post[data-design="gradient-sunset"] .tr-title.simple{font-weight:700;text-shadow:0 4px 30px rgba(0,0,0,.35)}
.tr-slide[data-design="gradient-purple"] .tr-bullets li::before,.tr-slide[data-design="gradient-sunset"] .tr-bullets li::before{content:"●"}
.tr-slide[data-design="midnight-ocean"] .tr-deck-card,.tr-slide[data-design="emerald-forest"] .tr-deck-card{backdrop-filter:blur(10px);border-radius:20px}
.tr-slide[data-design="midnight-ocean"] .tr-kicker,.tr-slide[data-design="emerald-forest"] .tr-kicker{text-shadow:0 0 18px currentColor}
.tr-slide[data-design="rosewood"] .tr-cover h1,.tr-slide[data-design="crimson-royal"] .tr-cover h1{font-style:italic}
.tr-slide[data-design="rosewood"] .tr-quote h1,.tr-slide[data-design="crimson-royal"] .tr-quote h1{font-style:italic}
.tr-slide[data-design="pastel-dawn"] .tr-deck-card,.tr-slide[data-design="sahara"] .tr-deck-card,.tr-slide[data-design="electric-ice"] .tr-deck-card,.tr-slide[data-design="denim-sky"] .tr-deck-card{border-radius:22px;box-shadow:0 20px 45px -22px rgba(60,40,90,.25)}
.tr-slide[data-design="pastel-dawn"] .tr-bullets li::before{content:"✦"}
.tr-slide[data-design="sahara"] .tr-bullets li::before{content:"▲";font-size:.65rem;top:6px}
.tr-slide[data-design="electric-ice"] .tr-bullets li::before,.tr-slide[data-design="denim-sky"] .tr-bullets li::before{content:"➤"}
.tr-post[data-design="islamic-teal"] .tr-title{letter-spacing:.1em}
.tr-slide[data-design="islamic-teal"] .tr-cover h1{letter-spacing:.02em}
`;

function installVisualCss() {
	if (document.getElementById('tr-visual-css')) return;
	const style = document.createElement('style');
	style.id = 'tr-visual-css';
	style.textContent = VISUAL_CSS;
	document.head.appendChild(style);
}
installVisualCss();

const DECK_CHROME_CSS = `
html,body{height:100%;margin:0}
body{background:#020b07;font-family:'Inter',system-ui,sans-serif;color:#f9f3e4}
.tr-stage{position:fixed;inset:0;background:radial-gradient(1200px 700px at 80% -10%,rgba(201,162,75,.07),transparent 60%),radial-gradient(1000px 800px at -10% 110%,rgba(201,162,75,.05),transparent 55%),linear-gradient(160deg,#07281e 0%,#051f17 55%,#04160f 100%);display:flex;align-items:center;justify-content:center;overflow:hidden}
.tr-deck{position:relative;width:1280px;height:720px;flex:none;transform-origin:center center;transition:transform .25s}
.tr-slide{display:none !important}
.tr-slide.active{display:flex !important}
.tr-deck .tr-slide:first-child{display:flex !important}
.tr-deck.js-on .tr-slide{display:none !important}
.tr-deck.js-on .tr-slide.active{display:flex !important}
.rv{opacity:0;transform:translateY(26px);filter:blur(4px);transition:opacity .8s ease var(--d,0s),transform .9s cubic-bezier(.19,.75,.22,1) var(--d,0s),filter .8s ease var(--d,0s)}
.tr-slide.active .rv{opacity:1;transform:none;filter:none}
.tr-progress-bar{position:fixed;top:0;left:0;height:4px;width:0;z-index:70;background:linear-gradient(90deg,#8a7137,#c9a24b,#d9bf82);box-shadow:0 0 12px rgba(201,162,75,.6);transition:width .25s}
.tr-menu-btn{position:fixed;top:16px;left:16px;z-index:70;display:flex;align-items:center;gap:10px;background:rgba(7,40,30,.55);backdrop-filter:blur(8px);border:1px solid rgba(201,162,75,.4);color:#d9bf82;border-radius:999px;padding:9px 18px;font-family:'Inter';font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:border-color .3s,background .3s}
.tr-menu-btn:hover{border-color:#c9a24b;background:rgba(7,40,30,.8)}
.tr-hud{position:fixed;right:18px;bottom:18px;z-index:70;display:flex;align-items:center;gap:12px}
.tr-counter{font-size:.8rem;letter-spacing:.14em;color:#a3956f;min-width:76px;text-align:center}
.tr-nav-btn{width:42px;height:42px;border-radius:50%;border:1px solid rgba(201,162,75,.45);background:rgba(7,40,30,.55);backdrop-filter:blur(8px);color:#d9bf82;cursor:pointer;display:grid;place-items:center;transition:all .3s}
.tr-nav-btn:hover{border-color:#c9a24b;background:rgba(201,162,75,.18);transform:translateY(-2px)}
.tr-nav-btn:disabled{opacity:.3;cursor:default;transform:none}
.tr-nav-btn svg{width:18px;height:18px}
.tr-overlay{position:fixed;inset:0;z-index:80;background:rgba(3,17,12,.9);backdrop-filter:blur(14px);display:grid;place-items:center;opacity:0;visibility:hidden;transition:opacity .35s ease,visibility .35s}
.tr-overlay.open{opacity:1;visibility:visible}
.tr-panel{width:min(680px,92vw);max-height:84vh;overflow:auto;background:linear-gradient(175deg,#fdfaf1,#f9f3e4);border:1px solid rgba(201,162,75,.5);border-radius:18px;padding:clamp(24px,4vw,44px);color:#28352f;box-shadow:0 30px 70px -20px rgba(0,0,0,.55);transform:translateY(18px);transition:transform .35s ease;position:relative}
.tr-overlay.open .tr-panel{transform:none}
.tr-panel h3{font-family:'Cormorant Garamond',serif;font-size:1.7rem;color:#16352a;margin-bottom:4px}
.tr-panel .tr-rule-line{margin:10px 0 18px}
.tr-toc{list-style:none;margin:0;padding:0}
.tr-toc li button{width:100%;display:flex;align-items:baseline;gap:14px;background:none;border:0;border-bottom:1px dashed rgba(138,113,55,.3);padding:12px 6px;cursor:pointer;font-family:'Inter';text-align:left;color:#243529;transition:background .25s,padding .25s}
.tr-toc li button:hover{background:rgba(201,162,75,.12);padding-left:12px}
.tr-toc .no{font-family:'Cormorant Garamond',serif;color:#8a7137;font-weight:700;min-width:34px}
.tr-toc .lb{font-size:.95rem}
.tr-x-btn{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:50%;border:1px solid rgba(138,113,55,.4);background:none;color:#5b4c26;font-size:1rem;cursor:pointer;transition:all .25s}
.tr-x-btn:hover{background:rgba(201,162,75,.18);transform:rotate(90deg)}
@media (max-width:860px){.tr-slide{padding:60px 26px}}
`;

const DECK_SCRIPT = `(function(){
  var deck=document.getElementById('deck');
  if(!deck) return;
  var slides=Array.prototype.slice.call(deck.querySelectorAll('.tr-slide'));
  var counter=document.getElementById('counter');
  var bar=document.getElementById('bar');
  var overlay=document.getElementById('overlay');
  var toc=document.getElementById('toc');
  var prevBtn=document.getElementById('prevBtn');
  var nextBtn=document.getElementById('nextBtn');
  var menuBtn=document.getElementById('menuBtn');
  var closeBtn=document.getElementById('closeBtn');
  var cur=0;
  function label(slide){
    var t=slide.querySelector('.tr-cover-title, .tr-quote h1, .tr-deck-card');
    var txt=t?(t.textContent||'').trim().split('\\n')[0]:'';
    return txt.length>70?txt.slice(0,67)+'…':txt;
  }
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const li = document.createElement('li');
    const b = document.createElement('button');
    const no = document.createElement('span');
    no.className = 'no';
    no.textContent = String(i + 1).padStart(2, '0');
    const lb = document.createElement('span');
    lb.className = 'lb';
    lb.textContent = label(s) || ('Slide ' + (i + 1));
    b.appendChild(no);
    b.appendChild(lb);
    b.addEventListener('click', function() {
      show(i);
      toggle(false);
    });
    li.appendChild(b);
    toc.appendChild(li);
  }
  function show(i){
    cur=Math.max(0,Math.min(slides.length-1,i));
    for (let j = 0; j < slides.length; j++) { slides[j].classList.toggle('active', j === cur); }
    if(counter) counter.textContent=(cur+1)+' / '+slides.length;
    if(bar) bar.style.width=((cur+1)/slides.length*100)+'%';
    if(prevBtn) prevBtn.disabled=cur===0;
    if(nextBtn) nextBtn.disabled=cur===slides.length-1;
  }
  function toggle(open){ if(overlay) overlay.classList.toggle('open',open); }
  function scale(){
    deck.classList.add('js-on');
    var s=Math.min(innerWidth/1280,innerHeight/720);
    deck.style.transform='scale('+s+')';
    deck.style.width='1280px';
    deck.style.height='720px';
  }
  prevBtn.addEventListener('click',function(){show(cur-1);});
  nextBtn.addEventListener('click',function(){show(cur+1);});
  menuBtn.addEventListener('click',function(){toggle(true);});
  closeBtn.addEventListener('click',function(){toggle(false);});
  overlay.addEventListener('click',function(e){if(e.target===overlay) toggle(false);});
  addEventListener('keydown',function(e){
    if(e.key==='ArrowLeft') show(cur-1);
    else if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){e.preventDefault();show(cur+1);}
    else if(e.key==='PageUp') show(cur-1);
    else if(e.key==='Home') show(0);
    else if(e.key==='End') show(slides.length-1);
  });
  addEventListener('resize',scale);
  show(0); scale();
})();`;

function hasArabic(s) { return /[\u0600-\u06FF]/.test(s); }

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function mdInline(s) {
	let out = esc(s);
	out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
	out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
	out = out.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/(^|[^/\w])_([^_\n]+)_/g, '$1<em>$2</em>');
	out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
	return out;
}
function stripMdInline(s) {
	return String(s ?? '')
		.replace(/\[([^\]]+)\]\((?:https?:[^)\s]+)\)/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1')
		.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1$2')
		.replace(/`([^`]+)`/g, '$1').trim();
}
function parseSlideMarkdown(chunk) {
	const lines = String(chunk ?? '').replace(/\r/g, '').split('\n');
	let title = '';
	const paras = [];
	const bullets = [];
	let buf = [];
	const flush = () => { const p = buf.join(' ').trim(); if (p) paras.push(p); buf = []; };
	for (let raw of lines) {
		const line = raw.trim();
		if (!line) { flush(); continue; }
		if (/^---+\s*SLIDE\s*---+$/i.test(line) || /^---+$/.test(line)) continue;
		const h = line.match(/^#{1,3}\s+(.*)$/);
		if (h && !title) { flush(); title = stripMdInline(h[1]); continue; }
		const b = line.match(/^[-*•]\s+(.*)$/) || line.match(/^\d+[.)]\s+(.*)$/);
		if (b) { flush(); bullets.push(stripMdInline(b[1])); continue; }
		buf.push(stripMdInline(line));
	}
	flush();
	return { title, paras, bullets };
}

function el(tag, cls, text) {
	const n = document.createElement(tag);
	if (cls) n.className = cls;
	if (text !== undefined) n.textContent = text;
	return n;
}

function makeOrnament(size) {
	const span = el('span');
	span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width=".7"><path d="M50 4 L61 39 L96 50 L61 61 L50 96 L39 61 L4 50 L39 39 Z"/><path d="M50 14 L58 42 L86 50 L58 58 L50 86 L42 58 L14 50 L42 42 Z"/><circle cx="50" cy="50" r="12"/></g></svg>`;
	return span;
}

function makePost(rawTitle, body, source, design, bgUrl) {
	const title = stripMdInline(String(rawTitle).replace(/^#+\s*/, ''));
	const D = cardDesigns[design] || cardDesigns['islamic-gold'];
	const post = el('figure', 'tr-post');
	post.dataset.design = design;
	post.style.setProperty('--tr-accent', D.accent);
	post.style.setProperty('--tr-accent-bright', D.accentBright || D.accent);
	post.style.setProperty('--tr-rule-color', D.ruleColor);
	post.style.setProperty('--tr-narration-color', D.narrationColor);
	post.style.setProperty('--tr-arabic-color', D.arabicColor);
	post.style.setProperty('--tr-source-color', D.sourceColor);
	post.style.setProperty('--tr-frame-color', D.frameColor);
	post.style.setProperty('--tr-frame-inner', D.frameColor.replace(/[\d.]+\)$/, '.12)'));
	post.style.setProperty('--tr-frame-accent', D.frameAccent);
	post.style.color = D.fg;
	post.style.fontFamily = D.font;

	if (D.islamic) {
		post.appendChild(el('div', design === 'islamic-teal' ? 'tr-teal-sky' : 'tr-sky'));
		post.appendChild(el('div', 'tr-sun'));
		post.appendChild(el('div', 'tr-field'));
		if (bgUrl) {
			const photo = document.createElement('img');
			photo.className = 'tr-photo';
			photo.alt = '';
			photo.src = bgUrl;
			photo.onerror = function () { this.remove(); };
			post.appendChild(photo);
		}
		post.appendChild(el('div', 'tr-pattern'));
		post.appendChild(el('div', design === 'islamic-teal' ? 'tr-scrim-light' : 'tr-scrim'));
	} else {
		post.style.background = D.bg;
		if (bgUrl) {
			post.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35),rgba(0,0,0,0.35)), url(${bgUrl})`;
			post.style.backgroundSize = 'cover';
			post.style.backgroundPosition = 'center';
		}
		post.appendChild(el('div', 'tr-pattern'));
		post.appendChild(el('div', 'tr-scrim-soft'));
	}
	const frame = el('div', 'tr-frame');
	for (let i = 1; i <= 4; i++) frame.appendChild(el('i', 'c' + i));
	post.appendChild(frame);

	const content = el('figcaption', 'tr-content');
	const h1 = el('h1', D.islamic ? 'tr-title' : 'tr-title simple');
	h1.innerHTML = mdInline(title);
	content.appendChild(h1);
	content.appendChild(el('div', 'tr-rule')).appendChild(el('b'));
	if (body.length) {
		for (const p of body) {
			const clean = stripMdInline(String(p).replace(/^#+\s*/, '').replace(/^[-*•]\s*/, '• '));
			const node = el('p', hasArabic(clean) ? 'tr-arabic' : 'tr-narration');
			node.innerHTML = mdInline(clean);
			content.appendChild(node);
		}
	}
	if (source) { const s = el('p', 'tr-source'); s.innerHTML = mdInline(stripMdInline(source)); content.appendChild(s); }
	post.appendChild(content);
	return post;
}

export function renderQuoteCard(text, design, bgImageUrl, subText = '') {
	const { title, paras, bullets } = parseSlideMarkdown(text);
	const cleanTitle = stripMdInline((title || text.split(/\n+/).map(s => s.trim()).filter(Boolean)[0] || 'Untitled').replace(/^#+\s*/, ''));
	const body = [...paras];
	for (const b of bullets) body.push('• ' + b);
	return makePost(cleanTitle, body, subText, design, bgImageUrl);
}

function makeSlideBase(design) {
	const D = slideDesigns[design] || slideDesigns['islamic-gold'];
	const slide = el('section', 'tr-slide');
	slide.dataset.design = design;
	slide.style.setProperty('--tr-accent', D.accent);
	slide.style.setProperty('--tr-accent-bright', D.accentBright);
	slide.style.setProperty('--tr-kicker', D.kicker);
	slide.style.setProperty('--tr-cover-mid', D.accentMid);
	slide.style.setProperty('--tr-card-bg', D.cardBg);
	slide.style.setProperty('--tr-card-fg', D.cardFg);
	slide.style.setProperty('--tr-border', D.border);
	slide.style.setProperty('--tr-border-strong', D.borderStrong);
	slide.style.setProperty('--tr-ar-color', D.arColor);
	slide.style.setProperty('--tr-qbox-bg', D.qboxBg);
	slide.style.setProperty('--tr-qbox-border', D.qboxBorder);
	slide.style.color = D.fg;
	const bg = el('div', 'tr-bg');
	bg.style.background = D.bg;
	slide.appendChild(bg);
	slide.appendChild(el('div', 'tr-pattern'));
	const ornTr = el('div', 'tr-orn tr-orn--tr'); ornTr.appendChild(makeOrnament(220)); slide.appendChild(ornTr);
	const ornBl = el('div', 'tr-orn tr-orn--bl'); ornBl.appendChild(makeOrnament(240)); slide.appendChild(ornBl);
	return { slide, D };
}

function makeCoverSlide(text, design, slideNo) {
	const { slide, D } = makeSlideBase(design);
	const parsed = parseSlideMarkdown(text);
	const coverTitle = parsed.title || stripMdInline(String(text).split('\n').map(s => s.trim()).filter(Boolean)[0] || 'Untitled').replace(/^#+\s*/, '');
	const coverSub = parsed.paras[0] || '';
	const wrap = el('div', 'tr-wrap tr-cover');
	const star = el('div', 'tr-star rv');
	star.innerHTML = `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M50 6 L61 39 L94 50 L61 61 L50 94 L39 61 L6 50 L39 39 Z"/><circle cx="50" cy="50" r="10"/><circle cx="50" cy="50" r="4"/></svg>`;
	wrap.appendChild(star);
	const h1 = el('h1', 'tr-cover-title rv');
	h1.innerHTML = mdInline(coverTitle);
	wrap.appendChild(h1);
	const div = el('div', 'tr-divider rv');
	div.textContent = '✦';
	wrap.appendChild(div);
	const sub = el('p', 'tr-sub rv');
	sub.innerHTML = coverSub ? mdInline(coverSub) : 'Presentation';
	wrap.appendChild(sub);
	slide.appendChild(wrap);
	return slide;
}

function makeQuoteSlide(text, design, slideNo) {
	const { slide, D } = makeSlideBase(design);
	const clean = stripMdInline(String(text).replace(/^#+\s*/gm, '').replace(/^---+\s*SLIDE\s*---+$/gim, '').trim());
	const wrap = el('div', 'tr-wrap tr-quote');
	wrap.appendChild(el('span', 'tr-kicker rv', `Slide ${String(slideNo).padStart(2, '0')}`));
	const rule = el('div', 'tr-rule-line rv'); rule.style.marginInline = 'auto'; wrap.appendChild(rule);
	wrap.appendChild(el('span', 'tr-qmark rv', '“'));
	const h1 = el('h1', 'rv'); h1.innerHTML = mdInline(clean);
	wrap.appendChild(h1);
	slide.appendChild(wrap);
	return slide;
}

function makeContentSlide(text, design, slideNo) {
	const { slide, D } = makeSlideBase(design);
	const { title, paras, bullets } = parseSlideMarkdown(text);
	const wrap = el('div', 'tr-wrap tr-content-slide');
	wrap.appendChild(el('span', 'tr-kicker rv', `Slide ${String(slideNo).padStart(2, '0')}`));
	wrap.appendChild(el('div', 'tr-rule-line rv'));
	const card = el('div', 'tr-deck-card rv');
	if (title) {
		const h = el('h3', 'tr-slide-h rv'); h.innerHTML = mdInline(title);
		card.appendChild(h);
	}
	for (const para of paras) {
		if (hasArabic(para)) {
			const pt = el('div', 'tr-pt');
			const qbox = el('div', 'tr-qbox');
			const p = el('p', 'tr-ar tr-ar-center'); p.innerHTML = mdInline(para);
			qbox.appendChild(p);
			pt.appendChild(qbox);
			card.appendChild(pt);
		} else {
			const pt = el('div', 'tr-pt');
			const p = el('p', null); p.innerHTML = mdInline(para);
			pt.appendChild(p);
			card.appendChild(pt);
		}
	}
	if (bullets.length) {
		const ul = el('ul', 'tr-bullets');
		for (const b of bullets) {
			const li = el('li', null);
			if (hasArabic(b)) li.classList.add('tr-ar');
			li.innerHTML = mdInline(b);
			ul.appendChild(li);
		}
		card.appendChild(ul);
	}
	if (!title && !paras.length && !bullets.length) {
		const pt = el('div', 'tr-pt');
		const p = el('p', null); p.innerHTML = mdInline(stripMdInline(text));
		pt.appendChild(p);
		card.appendChild(pt);
	}
	wrap.appendChild(card);
	slide.appendChild(wrap);
	return slide;
}

function looksLikeHeading(text) {
	const t = text.trim();
	return t.length < 90 && !/[.!?]$/.test(t) && !/\n/.test(t);
}

export function renderDeck(text, design, splitMode, chars, bgImageUrl) {
	const D = slideDesigns[design] || slideDesigns['islamic-gold'];
	const slides = splitSlides(text, splitMode, chars);
	const deck = el('div', 'tr-deck');
	for (let i = 0; i < slides.length; i++) {
		let slide;
		if (i === 0) slide = makeCoverSlide(slides[i], design, i + 1);
		else if (looksLikeHeading(slides[i])) slide = makeQuoteSlide(slides[i], design, i + 1);
		else slide = makeContentSlide(slides[i], design, i + 1);
		if (bgImageUrl) {
			const bg = slide.querySelector('.tr-bg');
			if (bg) bg.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35),rgba(0,0,0,0.35)), url(${bgImageUrl})`;
			bg.style.backgroundSize = 'cover';
			bg.style.backgroundPosition = 'center';
		}
		deck.appendChild(slide);
	}
	return deck;
}

export function splitSlides(text, mode, chars = 400) {
	const raw = text.replace(/\r/g, '').trim();
	if (mode === 'marker') {
		return raw.split(/\n[ \t]*---+(?:[ \t]*SLIDE[ \t]*---+)?[ \t]*(?=\n|$)/i).map(s => s.trim()).filter(Boolean);
	}
	if (mode === 'heading') {
		const parts = [];
		const blocks = raw.split(/\n(?=#{1,3}\s)/);
		let acc = '';
		for (const block of blocks) {
			if (!acc) { acc = block; continue; }
			if ((acc + '\n' + block).length > chars * 1.5) { parts.push(acc.trim()); acc = block; }
			else { acc += '\n' + block; }
		}
		if (acc) parts.push(acc.trim());
		return parts.length ? parts : [raw];
	}
	if (mode === 'chars') {
		const parts = [];
		let i = 0;
		while (i < raw.length) { parts.push(raw.slice(i, i + chars).trim()); i += chars; }
		return parts;
	}
	const paras = raw.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
	return paras.length ? paras : [raw];
}

export async function exportPng(element) {
	return htmlToImage.toPng(element, { cacheBust: true, pixelRatio: 2 });
}

export async function exportDeckPdf(deckEl, filename = 'presentation.pdf') {
	const slides = deckEl.querySelectorAll('.tr-slide');
	if (!slides.length) throw new Error('No slides to export.');
	const holder = document.createElement('div');
	holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;z-index:-1;';
	document.body.appendChild(holder);
	const clone = deckEl.cloneNode(true);
	holder.appendChild(clone);
	await document.fonts.ready;
	await Promise.all(Array.from(clone.querySelectorAll('img')).map(img => {
		if (img.complete && img.naturalWidth) return Promise.resolve();
		return new Promise(res => { img.onload = res; img.onerror = res; });
	}));
	const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1280, 720], hotfixes: ['px_scaling'], compress: true });
	const clonedSlides = clone.querySelectorAll('.tr-slide');
	for (let i = 0; i < clonedSlides.length; i++) {
		const dataUrl = await htmlToImage.toPng(clonedSlides[i], { width: 1280, height: 720, pixelRatio: 2, cacheBust: true });
		if (i > 0) pdf.addPage([1280, 720], 'landscape');
		pdf.addImage(dataUrl, 'PNG', 0, 0, 1280, 720);
	}
	pdf.save(filename);
	holder.remove();
}

export function downloadHtmlDeck(element, filename = 'deck.html') {
	const clone = element.cloneNode(true);
	clone.id = 'deck';
	for (let i = 0; i < clone.querySelectorAll('.tr-slide').length; i++) {
		clone.querySelectorAll('.tr-slide')[i].classList.toggle('active', i === 0);
	}
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deck</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400;1,500;1,600&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Amiri:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
body{margin:0}
${VISUAL_CSS}
${DECK_CHROME_CSS}
</style>
</head>
<body>
<div class="tr-progress-bar" id="bar"></div>
<button class="tr-menu-btn" id="menuBtn" aria-label="Open contents">☰&nbsp; Contents</button>
<div class="tr-hud">
	<span class="tr-counter" id="counter">1 / 1</span>
	<button class="tr-nav-btn" id="prevBtn" aria-label="Previous slide"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
	<button class="tr-nav-btn" id="nextBtn" aria-label="Next slide"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>
</div>
<div class="tr-overlay" id="overlay">
	<div class="tr-panel">
		<button class="tr-x-btn" id="closeBtn" aria-label="Close contents">✕</button>
		<h3>Contents</h3>
		<div class="tr-rule-line"></div>
		<ul class="tr-toc" id="toc"></ul>
	</div>
</div>
<div class="tr-stage">
	${clone.outerHTML}
</div>
<script>${DECK_SCRIPT}<\/script>
</body>
</html>`;
	const blob = new Blob([html], { type: 'text/html' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export { cardDesigns, slideDesigns, VISUAL_CSS, DECK_CHROME_CSS, DECK_SCRIPT };