let planes = [];
let airports = [];

let img1, img2, img3, img4, img5, img6;
let img1Gray, img2Gray, img3Gray, img4Gray, img5Gray, img6Gray;

const WALL_DISTANCE = 20; //distance from window boundary to make plane comeback to window
const SMOOTH_FACTOR = 2; //to smooth the path

const COLORS = ["#FFDD09", "#62FCB1", "#F23557"];

function findProjection(pos, a, b) {
	let v1 = p5.Vector.sub(a, pos);
	let v2 = p5.Vector.sub(b, pos);
	v2.normalize();
	let sp = v1.dot(v2);
	v2.mult(sp);
	v2.add(pos);
	return v2;
}

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
		]
	) {
		this.pos = createVector(x, y);
		this.runway = p5.Vector.add(
			createVector(x, y),
			createVector(w, 0).setHeading(radians(angle))
		);
		this.width = w;
		this.height = h;
		this.angle = angle;
		this.color = color;
		this.supportedPlanes = planes;
	}

	draw() {
		push();
		translate(this.pos.x, this.pos.y);
		rotate(this.angle);
		fill("gray");
		noStroke();
		rectMode(CENTER);
		rect(this.width / 2 - this.height / 2, 0, this.width, this.height);
		fill(this.color);
		rect(0, 0, this.height, this.height);
		stroke(0, 40);
		strokeWeight(4);
		line(0, 0, this.width - this.height, 0);
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
		this.path = [createVector(random(width), random(height))];
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

		let desiredSpeed = this.maxSpeed;
		if (arrival) {
			let distance = force.mag();
			let slowRadius = 100;
			if (distance < slowRadius) {
				desiredSpeed = map(distance, 0, slowRadius, 0, this.maxSpeed);
			}
		}
		force.setMag(desiredSpeed);
		force.sub(this.vel);
		force.limit(this.maxForce);
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
		this.vel.limit(this.maxSpeed);
		this.pos.add(this.vel);
		this.acc.set(0, 0);

		if (this.isLanding && this.radius > 0) {
			this.smoothenPath = [];
			this.pathIndex = 0;
			this.smoothenPath.push(this.airport.runway);
			this.radius -= 0.2;
		}
	}

	isCollidingWith(planeB) {
		let d = p5.Vector.dist(this.pos, planeB.pos);
		if (d <= this.radius + planeB.radius + 10) {
			this.isInDanger = true;
			return false;
		}
	}

	isCollided(planeB) {
		let d = p5.Vector.dist(this.pos, planeB.pos);
		return d <= max(this.radius, planeB.radius) - 4;
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
			desired.mult(this.maxSpeed);
			let steer = p5.Vector.sub(desired, this.vel);
			steer.limit(this.maxForce);
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
		if (this.isHavePathToAirport) {
			image(this.imgs.gray, 0, 0, this.radius * 1.8, this.radius * 1.8);
		} else {
			image(this.imgs.color, 0, 0, this.radius * 1.8, this.radius * 1.8);
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
function setup() {
	createCanvas(windowWidth, windowHeight);
	angleMode(DEGREES);

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
	];
	for (let i = 0; i < 3; i++) {
		airports.push(
			new Airport(
				random(width / 3, (2 * width) / 3),
				random(height / 3, (2 * height) / 3),
				random(150, 300),
				random(25, 35),
				random(0, 180),
				COLORS[i],
				SUPPORTED_PLANES[i]
			)
		);
	}

	for (let i = 0; i < 5; i++) {
		planes.push(
			new Plane(
				random([random(-width / 2, 0), random(width, 1.5 * width)]),
				random([random(-height / 2, 0), random(height, 1.5 * height)]),
				random(0.3, 1.5),
				random(15, 35),
				random(airports)
			)
		);
	}
}
/////////////////////////////////////////////////////////////////////////////////

function draw() {
	background("#A8DDA8"); //white background

	for (let airport of airports) {
		airport.draw();
	}
	for (let plane of planes) {
		plane.drawPath();
		plane.draw();
		plane.update();
		plane.checkForLanding();
		plane.edge();
	}

	for (let i = planes.length - 1; i >= 0; i--) {
		if (planes[i].isLanded) {
			planes.splice(i, 1);
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
					noLoop();
					break;
				}
			}
		}
	}

	if (frameCount % 500 == 0) {
		console.log("added");
		planes.push(
			new Plane(
				random([random(-width / 2, 0), random(width, 1.5 * width)]),
				random([random(-height / 2, 0), random(height, 1.5 * height)]),
				random(0.3, 1.5),
				random(15, 35),
				random(airports)
			)
		);
	}
}

function mousePressed() {
	for (let plane of planes) {
		let d = dist(mouseX, mouseY, plane.pos.x, plane.pos.y);
		if (d < plane.radius) {
			plane.isMakingPath = true;
			plane.path = [];
			plane.pathIndex = 0;
			plane.path.push(createVector(mouseX, mouseY));
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
				plane.path.push(createVector(mouseX, mouseY));
				plane.smoothDirection();
			}
		}
	}
}

function mouseReleased() {
	for (let plane of planes) {
		plane.isMakingPath = false;
	}
}
