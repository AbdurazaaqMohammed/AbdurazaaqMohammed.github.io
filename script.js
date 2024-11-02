const stars = [];
const numStars = 30;
let mouseX = 0, mouseY = 0;
let starIndex = 0;
let isTwinkling = false;
let lastMoveTime = Date.now();
let spiralAngle = 0;
let spiralRadius = 5;

const starsContainer = document.createElement('cursor-tracker');
document.body.appendChild(starsContainer);

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
	const numBgStars = 50;
	const body = document.body;

	for (let i = 0; i < numBgStars; i++) {
		const star = document.createElement('div');
		star.className = 'star';
		const size = 5;
		star.style.width = `${size}px`;
		star.style.height = `${size}px`;
		star.style.left = `${Math.random() * 100}vw`;
		star.style.top = `${Math.random() * 100}vh`;

		const moveX = (Math.random() - 0.5) * 100;
		const moveY = (Math.random() - 0.5) * 100;
		star.style.setProperty('--move-x', `${moveX}px`);
		star.style.setProperty('--move-y', `${moveY}px`);

		star.style.animationDuration = `${Math.random() * 2 + 1}s, ${Math.random() * 5 + 5}s`;
		star.style.animationDelay = `${Math.random() * 2}s, ${Math.random() * 5}s`;
		star.style.animationName = `twinkle, move`;
		star.style.animationTimingFunction = 'ease-in-out, linear';
		star.style.animationIterationCount = 'infinite, infinite';
		star.style.animationFillMode = 'forwards';

		body.appendChild(star);
	}
	animateStars();
});

/* Copyright (c) 2024 by SS (https://codepen.io/CheeseTurtle/pen/AYJYqE)
Fork of an original work Simple Typing Carousel  https://codepen.io/gschier/pen/DLmXKJ

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. */

var TxtRotate = function(el, toRotate, period) {
	this.toRotate = toRotate;
	this.el = el;
	this.loopNum = 0;
	this.period = parseInt(period, 10) || 2000;
	this.txt = '';
	this.tick();
	this.isDeleting = false;
};

TxtRotate.prototype.tick = function() {
	var i = this.loopNum % this.toRotate.length;
	var fullTxt = this.toRotate[i];

	this.txt = fullTxt.substring(0, this.txt.length + (this.isDeleting ? -1 : 1));

	this.el.innerHTML = '<span class="wrap">'+this.txt+'</span>';

	var that = this;
	var delta = 300 - Math.random() * 100;

	if (this.isDeleting) { delta /= 2; }

	if (!this.isDeleting && this.txt === fullTxt) {
		delta = this.period;
		this.isDeleting = true;
	} else if (this.isDeleting && this.txt === '') {
		this.isDeleting = false;
		this.loopNum++;
		delta = 500;
	}

	setTimeout(function() {
		that.tick();
	}, delta);
};

window.onload = function() {
	var elements = document.getElementsByClassName('txt-rotate');
	for (var i=0; i<elements.length; i++) {
		var toRotate = elements[i].getAttribute('data-rotate');
		var period = elements[i].getAttribute('data-period');
		if (toRotate) {
			new TxtRotate(elements[i], JSON.parse(toRotate), period);
		}
	}
	var css = document.createElement("style");
	css.type = "text/css";
	css.innerHTML = ".txt-rotate > .wrap { border-right: 0.08em solid #666 }";
	document.body.appendChild(css);
};