const stars = [];
const numStars = 30;
let mouseX = 0, mouseY = 0;
let starIndex = 0;
let mouseTimeout;
let isTwinkling = false;
let lastMoveTime = Date.now();
let spiralAngle = 0;
let spiralRadius = 5;

for (let i = 0; i < numStars; i++) {
	const star = document.createElement('div');
	star.classList.add('star');
	document.body.appendChild(star);
	stars.push(star);
}

document.addEventListener('mousemove', (e) => {
	mouseX = e.pageX;
	mouseY = e.pageY;
	lastMoveTime = Date.now();
	isTwinkling = false;
});

function animateDoubleSpiral() {
	const centerX = mouseX;
	const centerY = mouseY;
	spiralAngle += 0.01;
	
	stars.forEach((star, index) => {
		const spiralSet = Math.floor(index / (numStars / 2));
		const spiralOffset = spiralSet * Math.PI;
		
		const adjustedIndex = index % (numStars / 2);
		
		const angle = spiralAngle + (adjustedIndex * (2 * Math.PI / (numStars / 2))) + spiralOffset;
		const radius = spiralRadius + (adjustedIndex * 0.5);
		
		const x = centerX + radius * Math.cos(angle);
		const y = centerY + radius * Math.sin(angle);
		
		star.style.left = `${x}px`;
		star.style.top = `${y}px`;
		star.style.opacity = 0.8;
		star.style.transform = 'translate(-50%, -50%) scale(1)';
	});
}

function setStarHW(h, w) {
	document.head.appendChild(document.createElement('style')).innerHTML = '.star { height: ' + h + 'px; width: ' + w + 'px; }';
}

function animateStars() {
	const currentTime = Date.now();
	const timeSinceMove = currentTime - lastMoveTime;

	if (timeSinceMove > 1000) {
		setStarHW(3, 3);
		isTwinkling = true;
		animateDoubleSpiral();
	} else if (!isTwinkling) {
		setStarHW(30, 30);
		const star = stars[starIndex];
		star.style.left = `${mouseX}px`;
		star.style.top = `${mouseY}px`;
		star.style.opacity = 1;
		star.style.transform = 'translate(-50%, -50%) scale(1)';
		
		setTimeout(() => {
			star.style.opacity = 0;
			star.style.transform = 'translate(-50%, -50%) scale(0.5)';
		}, 50);

		starIndex = (starIndex + 1) % numStars;
	}
	
	requestAnimationFrame(animateStars);
}

animateStars();