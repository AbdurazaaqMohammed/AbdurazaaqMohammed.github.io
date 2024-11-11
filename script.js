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
});