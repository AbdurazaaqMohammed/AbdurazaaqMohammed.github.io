document.addEventListener("DOMContentLoaded", () => {
	const numBgStars = 50;

	for (let i = 0; i < numBgStars; i++) {
		const star = document.createElement('div');
		star.className = 'starry';
		const size = 5;
		star.style.width = `${size}px`;
		star.style.height = `${size}px`;
		star.style.left = `${Math.random() * 100}vw`;
		star.style.top = `${Math.random() * 100}vh`;

		document.body.appendChild(star);
	}

	const observerOptions = {
		threshold: 0.1,
		rootMargin: '0px 0px -50px 0px'
	};

	const observeSection = (section) => {
		const observer = new IntersectionObserver((entries) => {
			for (let i = 0; i < entries.length; i++) {
				const entry = entries[i];
				if (entry.isIntersecting) {
					setTimeout(() => {
						entry.target.classList.add('reveal');
					}, i * 100);
					observer.unobserve(entry.target);
				}
			}
		}, observerOptions);
		observer.observe(section);
	};

	for(const d of document.getElementsByTagName('section')) observeSection(d);

	const mutationObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for(const node of mutation.addedNodes) {
				if (node.nodeType === Node.ELEMENT_NODE) {
					if (node.matches && node.matches('section')) {
						observeSection(node);
					}
					if (node.querySelectorAll) {
						for(const d of node.querySelectorAll('section')) observeSection(node);
					}
				}
			}
		}
	});
	mutationObserver.observe(document.body, { childList: true, subtree: true });
});