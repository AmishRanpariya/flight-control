const scoreSpan = document.querySelector("#score");

let planes = [];
let airports = [];

let heli, heliWing, helipad;
let img1, img2, img3, img4, img5, img6;
let img1Gray, img2Gray, img3Gray, img4Gray, img5Gray, img6Gray;

let speedFactor = 1;
let score = 0;
let isPaused = false;
const WALL_DISTANCE = 30; //distance from window boundary to make plane comeback to window
const SMOOTH_FACTOR = 4; //to smooth the path

const COLORS = ["#FFDD09", "#62FCB1", "#F23557", "#ffffff"];

function findProjection(pos, a, b) {
	let v1 = p5.Vector.sub(a, pos);
	let v2 = p5.Vector.sub(b, pos);
	v2.normalize();
	let sp = v1.dot(v2);
	v2.mult(sp);
	v2.add(pos);
	return v2;
}

const PLANE_TYPES = [
	{
		speed: 1,
		radius: 35,
	},
	{
		speed: 0.75,
		radius: 30,
	},
	{
		speed: 0.5,
		radius: 25,
	},
];

class Airport {
	constructor(
		x,
		y,
		w = 250,
		h = 30,
		angle = 0,
		color,
		planes = [
			{ color: img1, gray: img1Gray },
			{ color: img2, gray: img2Gray },
			{ color: img3, gray: img3Gray },
			{ color: img4, gray: img4Gray },
			{ color: img5, gray: img5Gray },
			{ color: img6, gray: img6Gray },
		],
		isHelipad = false
	) {
		this.pos = createVector(x, y);
		this.isHelipad = isHelipad;
		this.width = w;
		if (this.isHelipad) {
			this.width = h * 1.2;
		}
		this.height = h * 1.2;
		this.runway = p5.Vector.add(
			createVector(x, y),
			createVector(this.width, 0).setHeading(radians(angle))
		);

		this.angle = angle;
		this.color = color;
		this.supportedPlanes = planes;
	}

	draw() {
		push();
		translate(this.pos.x, this.pos.y);
		rotate(this.angle);

		if (!this.isHelipad) {
			fill("gray");
			noStroke();
			rectMode(CENTER);
			rect(this.width / 2 - this.height / 2, 0, this.width, this.height, 8);
			fill(this.color + "d9");
			rect(0, 0, this.height, this.height, 8, 0, 0, 8);
			fill(0, 101);
			triangle(0, 0, -6, -this.height / 2 + 5, -6, this.height / 2 - 5);
			triangle(6, 0, 1, -this.height / 2 + 5, 1, this.height / 2 - 5);
			triangle(12, 0, 7, -this.height / 2 + 5, 7, this.height / 2 - 5);
			stroke(this.color + "88");
			strokeWeight(4);
			line(0, this.height / 2 - 4, this.width - 22, this.height / 2 - 4);
			line(0, -this.height / 2 + 4, this.width - 22, -this.height / 2 + 4);
			stroke(0, 20);
			line(22, 0, this.width - 52, 0);
		} else {
			rectMode(CENTER);
			fill(255);
			rect(0, 0, this.width * 1.2, this.height * 1.2, 8);
			imageMode(CENTER);
			image(helipad, 0, 0, this.width, this.height);
		}
		pop();
	}

	drawRunway() {
		push();
		translate(this.pos.x, this.pos.y);
		rotate(this.angle);

		if (!this.isHelipad) {
			fill("gray");
			noStroke();
			rectMode(CENTER);
			rect(this.width / 2 - this.height / 2, 0, this.width, this.height, 8);
			fill(this.color + "d9");
			rect(0, 0, this.height, this.height, 8, 0, 0, 8);
		} else {
			rectMode(CENTER);
			fill(255);
			rect(0, 0, this.width * 1.2, this.height * 1.2, 8);
			imageMode(CENTER);
			image(helipad, 0, 0, this.width, this.height);
		}
		pop();
	}
	drawRunwayMarkings() {
		push();
		translate(this.pos.x, this.pos.y);
		rotate(this.angle);
		if (!this.isHelipad) {
			noStroke();
			fill(0, 101);
			triangle(0, 0, -6, -this.height / 2 + 5, -6, this.height / 2 - 5);
			triangle(6, 0, 1, -this.height / 2 + 5, 1, this.height / 2 - 5);
			triangle(12, 0, 7, -this.height / 2 + 5, 7, this.height / 2 - 5);
			stroke(this.color + "88");
			strokeWeight(4);
			line(18, this.height / 2 - 4, this.width - 22, this.height / 2 - 4);
			line(18, -this.height / 2 + 4, this.width - 22, -this.height / 2 + 4);
			stroke(0, 20);
			line(22, 0, this.width - 52, 0);
		}
		pop();
	}
}

class Plane {
	constructor(x, y, maxSpeed = 2, radius, airport) {
		this.pos = createVector(x, y);
		this.vel = createVector(0, 0);
		this.acc = p5.Vector.random2D(); // createVector(0, 0);
		this.maxSpeed = maxSpeed;
		this.maxForce = 0.2;
		this.radius = radius;
		this.isLanded = false;
		this.isLanding = false;
		this.airport = airport;
		this.isMakingPath = false;
		this.isHavePathToAirport = false;
		this.path = [
			createVector(
				random(width / 3, (2 * width) / 3),
				random(height / 3, (2 * height) / 3)
			),
		];
		this.smoothenPath = [this.path[0].copy()];
		this.pathIndex = 0;
		this.isInDanger = false;
		this.imgs = random(this.airport.supportedPlanes);
	}

	smoothDirection() {
		let dir = this.path.map((v) => v.copy());
		if (dir.length > SMOOTH_FACTOR) {
			for (let i = SMOOTH_FACTOR; i < dir.length - SMOOTH_FACTOR; i++) {
				dir[i] = averageVector(dir.slice(i - SMOOTH_FACTOR, i + SMOOTH_FACTOR));
			}
		}
		this.smoothenPath = dir;
	}

	//seek the static target
	seek(target, arrival = false) {
		let force = p5.Vector.sub(target, this.pos);

		let desiredSpeed = this.maxSpeed * speedFactor;
		if (arrival) {
			let distance = force.mag();
			let slowRadius = 100;
			if (distance < slowRadius) {
				desiredSpeed = map(
					distance,
					0,
					slowRadius,
					0,
					this.maxSpeed * speedFactor
				);
			}
		}
		force.setMag(desiredSpeed);
		force.sub(this.vel);
		force.limit(this.maxForce * speedFactor);
		return force;
	}

	//arrive at the target by slowing down
	arrive(target) {
		//2nd argument true means its arrival behavior
		return this.seek(target, true);
	}

	checkForLanding() {
		if (!this.isLanded && !this.isLanding) {
			let d = p5.Vector.dist(this.pos, this.airport.pos);
			if (d < this.airport.height / 2) {
				this.isLanding = true;
			}

			if (
				this.smoothenPath &&
				this.smoothenPath.length > 1 &&
				p5.Vector.dist(
					this.airport.pos,
					this.smoothenPath[this.smoothenPath.length - 1]
				) < this.airport.height
			) {
				this.isHavePathToAirport = true;
			} else {
				this.isHavePathToAirport = false;
			}
		}
		if (!this.isLanded) {
			if (this.radius <= 2) {
				this.isLanded = true;
			}
		}
	}

	applyForce(force) {
		this.acc.add(force);
		// this.vel.add(this.acc)
	}

	update() {
		if (this.pathIndex < this.smoothenPath.length) {
			let force = this.seek(this.smoothenPath[this.pathIndex]);
			this.applyForce(force);
			if (p5.Vector.dist(this.pos, this.smoothenPath[this.pathIndex]) < 10) {
				this.pathIndex += 1;

				if (this.pathIndex >= this.smoothenPath.length - 1) {
					this.smoothenPath = [];
					this.path = [];
					this.pathIndex = 0;
				}
			}
		}
		this.vel.add(this.acc);
		this.vel.limit(this.maxSpeed * speedFactor);
		this.pos.add(this.vel);
		this.acc.set(0, 0);

		if (this.isLanding && this.radius > 0) {
			this.smoothenPath = [];
			this.pathIndex = 0;
			this.smoothenPath.push(this.airport.runway);
			this.radius -= this.airport.isHelipad ? 2 : 0.3;
		}
	}

	isCollidingWith(planeB) {
		let d = p5.Vector.dist(this.pos, planeB.pos);
		if (d <= this.radius + planeB.radius + 30) {
			this.isInDanger = true;
			return false;
		}
	}

	isCollided(planeB) {
		if (this.isLanding || planeB.isLanding) return false;
		if (
			this.pos.x < WALL_DISTANCE ||
			this.pos.x > width - WALL_DISTANCE ||
			this.pos.y < WALL_DISTANCE ||
			this.pos.y > height - WALL_DISTANCE
		) {
			//means colliding outside the window
			//so don't game over
			return false;
		}
		let d = p5.Vector.dist(this.pos, planeB.pos);
		return d <= max(this.radius, planeB.radius);
	}

	edge() {
		let desired = null;

		if (this.pos.x < WALL_DISTANCE) {
			desired = createVector(this.maxSpeed, this.vel.y);
		} else if (this.pos.x > width - WALL_DISTANCE) {
			desired = createVector(-this.maxSpeed, this.vel.y);
		}

		if (this.pos.y < WALL_DISTANCE) {
			desired = createVector(this.vel.x, this.maxSpeed);
		} else if (this.pos.y > height - WALL_DISTANCE) {
			desired = createVector(this.vel.x, -this.maxSpeed);
		}

		if (desired && this.smoothenPath.length === 0) {
			desired.normalize();
			desired.mult(this.maxSpeed * speedFactor);
			let steer = p5.Vector.sub(desired, this.vel);
			steer.limit(this.maxForce * speedFactor);
			this.applyForce(steer);
		}
	}

	draw() {
		push();
		if (this.isInDanger) {
			stroke("red");
			fill("#f005");
		} else {
			noStroke();
		}
		ellipseMode(CENTER);
		translate(this.pos.x, this.pos.y);
		rotate(90 + this.vel.heading());
		ellipse(0, 0, this.radius * 2.2, this.radius * 2.2);
		imageMode(CENTER);

		if (this.imgs.heli) {
			image(this.imgs.heli, 0, 0, this.radius * 1.8, this.radius * 1.8);
			push();
			rotate(frameCount * 10);
			image(this.imgs.wing, 0, 0, this.radius * 1.8, this.radius * 1.8);
			pop();
		} else {
			if (this.isHavePathToAirport) {
				image(this.imgs.gray, 0, 0, this.radius * 1.8, this.radius * 1.8);
			} else {
				image(this.imgs.color, 0, 0, this.radius * 1.8, this.radius * 1.8);
			}
		}

		pop();
	}

	drawPath() {
		stroke(255);
		noFill();
		beginShape();
		for (let j = this.pathIndex; j < this.smoothenPath.length; j++) {
			vertex(this.smoothenPath[j].x, this.smoothenPath[j].y);
		}
		endShape();
	}

	startedMakingPath(point) {
		this.isMakingPath = true;
		this.path = [];
		this.pathIndex = 0;
		this.path.push(point);
	}
	continueMakingPath(point) {
		this.path.push(point);
		this.smoothDirection();
	}
	stopMakingPath() {
		this.isMakingPath = false;
	}
}

function averageVector(arr) {
	let some = arr.reduce(
		(acc, vec) => p5.Vector.add(vec, acc),
		createVector(0, 0)
	);
	some = some.mult(1 / arr.length);
	return some;
}

/////////////////////////////////////////////////////////////////////////////////
function preload() {
	helipad = loadImage("./helipad.jpg");
	heli = loadImage("./helicopter.png");
	heliWing = loadImage("./helicopter_wings.png");
	img1 = loadImage("./plane-yellow.svg");
	img1Gray = loadImage("./plane-yellow.svg");
	img2 = loadImage("./super-plane-yellow.svg");
	img2Gray = loadImage("./super-plane-yellow.svg");
	img3 = loadImage("./plane-green.svg");
	img3Gray = loadImage("./plane-green.svg");
	img4 = loadImage("./super-plane-green.svg");
	img4Gray = loadImage("./super-plane-green.svg");
	img5 = loadImage("./plane-pink.svg");
	img5Gray = loadImage("./plane-pink.svg");
	img6 = loadImage("./super-plane-pink.svg");
	img6Gray = loadImage("./super-plane-pink.svg");
	img7 = loadImage("./plane-blue.svg");
	img7Gray = loadImage("./plane-blue.svg");
	img8 = loadImage("./super-plane-blue.svg");
	img8Gray = loadImage("./super-plane-blue.svg");
}

/////////////////////////////////////////////////////////////////////////////////
let canvas;
function setup() {
	canvas = createCanvas(windowWidth - 40, windowHeight - 80);
	angleMode(DEGREES);
	frameRate(60);
	img1Gray.filter(GRAY);
	img2Gray.filter(GRAY);
	img3Gray.filter(GRAY);
	img4Gray.filter(GRAY);
	img5Gray.filter(GRAY);
	img6Gray.filter(GRAY);
	const SUPPORTED_PLANES = [
		[
			{ color: img1, gray: img1Gray },
			{ color: img2, gray: img2Gray },
		],
		[
			{ color: img3, gray: img3Gray },
			{ color: img4, gray: img4Gray },
		],
		[
			{ color: img5, gray: img5Gray },
			{ color: img6, gray: img6Gray },
		],
		[{ heli: heli, wing: heliWing }],
	];
	for (let i = 0; i < 4; i++) {
		airports.push(
			new Airport(
				random(width / 3, (2 * width) / 3),
				random(height / 3, (2 * height) / 3),
				random(200, 300),
				30,
				random(0, 180),
				COLORS[i],
				SUPPORTED_PLANES[i],
				i === 3
			)
		);
	}

	for (let i = 0; i < 1; i++) {
		let p = random(PLANE_TYPES);

		planes.push(
			new Plane(
				random([random(-width / 2, 0), random(width, 1.5 * width)]),
				random([random(-height / 2, 0), random(height, 1.5 * height)]),
				p.speed, // random(0.3, 1.5),
				p.radius, //random(15, 35),
				random(airports)
			)
		);
	}
}
/////////////////////////////////////////////////////////////////////////////////

function draw() {
	// background("#A8DDA8"); //white background
	canvas.clear();
	for (let airport of airports) {
		airport.drawRunway();
	}
	//making separate loop for airports because not want to overlap the runway marking with other runway
	for (let airport of airports) {
		airport.drawRunwayMarkings();
	}
	for (let plane of planes) {
		plane.drawPath();
		plane.draw();
		plane.update();
		if (speedFactor === 2) {
			plane.update();
		}
		plane.checkForLanding();
		plane.edge();
	}

	for (let i = planes.length - 1; i >= 0; i--) {
		if (planes[i].isLanded) {
			planes.splice(i, 1);
			score++;
			scoreSpan.innerHTML = score;
		}
	}

	for (let planeA of planes) {
		planeA.isInDanger = false;
		for (let planeB of planes) {
			if (planeA !== planeB) {
				planeA.isCollidingWith(planeB);
			}
		}
	}

	for (let planeA of planes) {
		for (let planeB of planes) {
			if (planeA !== planeB) {
				if (planeA.isCollided(planeB)) {
					console.log("Game Over");
					gameOverWindow.style.display = "flex";
					noLoop();
					break;
				}
			}
		}
	}

	if (frameCount % 200 == 0) {
		console.log("added");
		let p = random(PLANE_TYPES);
		planes.push(
			new Plane(
				random([random(-width / 2, 0), random(width, 1.5 * width)]),
				random([random(-height / 2, 0), random(height, 1.5 * height)]),
				p.speed, // random(0.3, 1.5),
				p.radius, //random(15, 35),
				random(airports)
			)
		);
	}
}

function mousePressed() {
	for (let plane of planes) {
		let d = dist(mouseX, mouseY, plane.pos.x, plane.pos.y);
		if (d < plane.radius * 1.2) {
			plane.startedMakingPath(createVector(mouseX, mouseY));
		}
	}
}

function mouseDragged() {
	for (let plane of planes) {
		if (plane.isMakingPath) {
			if (
				mouseX > WALL_DISTANCE &&
				mouseX < width - WALL_DISTANCE &&
				mouseY > WALL_DISTANCE &&
				mouseY < height - WALL_DISTANCE
			) {
				plane.continueMakingPath(createVector(mouseX, mouseY));
			}
		}
	}
}

function mouseReleased() {
	for (let plane of planes) {
		plane.stopMakingPath();
	}
}

function togglePause() {
	if (isPaused) {
		loop();
	} else {
		noLoop();
	}
	isPaused = !isPaused;
}

const gameOverWindow = document.querySelector(".gameOverWindow");

gameOverWindow.style.display = "none";

const speedButton = document.querySelector("#speedButton");
speedButton.addEventListener("click", (e) => {
	speedFactor = speedFactor === 1 ? 2 : 1;
	speedButton.innerHTML =
		speedFactor === 1
			? `<svg	xmlns="http://www.w3.org/2000/svg" width="40px"	height="40px"	stroke-width="4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path	stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>`
			: `<svg xmlns="http://www.w3.org/2000/svg" width="40px"	height="40px"	stroke-width="4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>`;
});

const pauseButton = document.querySelector("#pauseButton");
pauseButton.addEventListener("click", (e) => {
	if (isPaused) {
		loop();
	} else {
		noLoop();
	}
	isPaused = !isPaused;
	pauseButton.innerHTML = isPaused
		? `<svg xmlns="http://www.w3.org/2000/svg" width="45px"	height="45px"	fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
	</svg>`
		: `<svg xmlns="http://www.w3.org/2000/svg" width="45px"	height="45px"	fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
	</svg>`;
});
