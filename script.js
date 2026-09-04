document.addEventListener("DOMContentLoaded", () => {
	const canvas = document.getElementById('canvas');
	const ctx = canvas.getContext('2d');
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	const stars = [];
	const numStars = 150;
	const mouse = { x: null, y: null };
	const connectionDistance = 150;

	class Star {
		constructor() {
			this.x = Math.random() * canvas.width;
			this.y = Math.random() * canvas.height;
			this.size = Math.random() * 2 + 0.5;
			this.speedX = (Math.random() - 0.5) * 0.3;
			this.speedY = (Math.random() - 0.5) * 0.3;
			this.opacity = Math.random() * 0.5 + 0.3;
		}

		update() {
			this.x += this.speedX;
			this.y += this.speedY;
			if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
			if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
		}

		draw() {
			ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	for (let i = 0; i < numStars; i++) {
		stars.push(new Star());
	}

	function drawConnections() {
		for (let i = 0; i < stars.length; i++) {
			for (let j = i + 1; j < stars.length; j++) {
				const dx = stars[i].x - stars[j].x;
				const dy = stars[i].y - stars[j].y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < connectionDistance) {
					ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 * (1 - distance / connectionDistance)})`;
					ctx.lineWidth = 0.5;
					ctx.beginPath();
					ctx.moveTo(stars[i].x, stars[i].y);
					ctx.lineTo(stars[j].x, stars[j].y);
					ctx.stroke();
				}
			}

			if (mouse.x !== null && mouse.y !== null) {
				const dx = stars[i].x - mouse.x;
				const dy = stars[i].y - mouse.y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < connectionDistance) {
					ctx.strokeStyle = `rgba(99, 102, 241, ${0.4 * (1 - distance / connectionDistance)})`;
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(stars[i].x, stars[i].y);
					ctx.lineTo(mouse.x, mouse.y);
					ctx.stroke();
				}
			}
		}
	}

	function animate() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for (const star of stars) {
			star.update();
			star.draw();
		}
		drawConnections();
		requestAnimationFrame(animate);
	}

	animate();

	window.addEventListener('mousemove', (e) => {
		mouse.x = e.clientX;
		mouse.y = e.clientY;
	});

	window.addEventListener('resize', () => {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	});

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

	for (const d of document.getElementsByTagName('section')) observeSection(d);

	const mutationObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node.nodeType === Node.ELEMENT_NODE) {
					if (node.matches && node.matches('section')) {
						observeSection(node);
					}
					if (node.querySelectorAll) {
						for (const d of node.getElementsByTagName('section')) observeSection(d);
					}
				}
			}
		}
	});
	mutationObserver.observe(document.body, { childList: true, subtree: true });

	const cardObserver = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				entry.target.classList.add('reveal');
				cardObserver.unobserve(entry.target);
			}
		}
	}, observerOptions);

	for (const card of document.getElementsByClassName('project-card')) {
		cardObserver.observe(card);
	}

	const starRepos = ["MP-Manager", "AntiSplit-M", "AXML-Editor", "APKExtractor"];
	for (const repoName of starRepos) {
		const starElement = document.querySelector(`[data-repo="${repoName}"]`);
		if (starElement) {
			fetch(`https://api.github.com/repos/AbdurazaaqMohammed/${repoName}`)
				.then(response => response.json())
				.then(data => {
					starElement.textContent = `\u2605 ${data.stargazers_count}`;
				})
				.catch(() => {
					starElement.textContent = '';
				});
		}
	}

	fetch('https://api.github.com/users/AbdurazaaqMohammed')
		.then(response => response.json())
		.then(data => {
			const reposEl = document.getElementById('stat-repos');
			const followersEl = document.getElementById('stat-followers');
			if (reposEl) reposEl.textContent = data.public_repos;
			if (followersEl) followersEl.textContent = data.followers;
		})
		.catch(() => {});

	fetch('https://api.github.com/users/AbdurazaaqMohammed/repos?per_page=100')
		.then(response => response.json())
		.then(data => {
			if (Array.isArray(data)) {
				const totalStars = data.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
				const starsEl = document.getElementById('stat-stars');
				if (starsEl) starsEl.textContent = totalStars;
			}
		})
		.catch(() => {});
});
