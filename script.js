// Updated script.js
const stars = [];
const numStars = 30;
let mouseX = 0, mouseY = 0;
let starIndex = 0;
let isTwinkling = false;
let lastMoveTime = Date.now();
let spiralAngle = 0;
let spiralRadius = 5;

const starsContainer = document.createElement('cursor-tracker');
const cursorTracker = document.createElement('stars-container');
document.body.appendChild(starsContainer);
document.body.appendChild(cursorTracker);

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    lastMoveTime = Date.now();
    isTwinkling = false;
});

for (let i = 0; i < numStars; i++) {
    const star = document.createElement('div');
    star.classList.add('star');
    starsContainer.appendChild(star);
    stars.push(star);
}

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
    const existingStyle = document.querySelector('#star-dimensions');
    if (existingStyle) {
        existingStyle.remove();
    }
    const style = document.createElement('style');
    style.id = 'star-dimensions';
    style.innerHTML = `.star { height: ${h}px; width: ${w}px; }`;
    document.head.appendChild(style);
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

document.addEventListener("DOMContentLoaded", () => {
    for (let i = 0; i < 100; i++) {
        const star = document.createElement("div");
        star.classList.add("starry");
        star.style.left = `${Math.random() * 100}vw`;
        star.style.top = `${Math.random() * 100}vh`;
        star.style.animationDuration = `${5 + Math.random() * 10}s`;
        starsContainer.appendChild(star);
    }
    
    animateStars();
});