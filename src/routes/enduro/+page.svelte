<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	let score = $state(0);
	let carsPassed = $state(0);
	let day = $state(1);
	let targetCars = $state(200);
	let playerX = $state(0);
	let playerZOffset = $state(0);
	let speed = $state(0);
	let maxSpeed = $state(1.4);
	let gameOver = $state(false);
	let gameStarted = $state(false);
	let hasActiveRun = $state(false);
	let paused = $state(false);
	let isStarting = $state(false);
	let gamepadStartWasPressed = $state(false);
	let highScore = $state(0);
	let distance = $state(0);
	let weather = $state<'clear' | 'fog' | 'ice'>('clear');
	let isNight = $state(false);
	let iceFactor = $state(0);
	let fogFactor = $state(0);
	let gamepadThrottle = $state(false);
	let gamepadBrake = $state(false);
	let touchCapable = $state(false);
	let viewportWidth = $state(0);
	let touchThrottle = $state(false);
	let touchBrake = $state(false);
	let touchSteer = $state(0);
	let touchSteeringActive = $state(false);
	let lastFireBtn = false;
	let lastBackBtn = false;
	let lastJoyUp = false;
	let lastJoyDown = false;

	let canvasElement: HTMLCanvasElement;

	const MENU_BUTTON_SELECTOR = '[data-menu-button]:not([disabled])';
	let menuScreen = $derived(!gameStarted || gameOver);
	let showTouchControls = $derived(touchCapable && viewportWidth < 960 && gameStarted && !gameOver);

	function getMenuButtons() {
		return Array.from(document.querySelectorAll(MENU_BUTTON_SELECTOR)) as HTMLElement[];
	}

	function moveFocus(direction: number) {
		const focusable = getMenuButtons();
		if (focusable.length === 0) return;

		let index = focusable.indexOf(document.activeElement as HTMLElement);
		if (index === -1) {
			focusable[0].focus();
			return;
		}

		index = (index + direction + focusable.length) % focusable.length;
		focusable[index].focus();
	}

	function activateFocusedMenuItem() {
		const focusable = getMenuButtons();
		if (focusable.length === 0) return;

		const active = document.activeElement as HTMLElement | null;
		if (active && focusable.includes(active)) {
			active.click();
			return;
		}

		focusable[0].focus();
	}

	function clearTransientControls() {
		keys.clear();
		touchThrottle = false;
		touchBrake = false;
		touchSteer = 0;
		touchSteeringActive = false;
		gamepadThrottle = false;
		gamepadBrake = false;
		gamepadSteer = 0;
	}

	function backToDashboard() {
		window.location.href = '/';
	}

	function continueGame() {
		initAudio();
		if (audioCtx?.state === 'suspended') audioCtx.resume();

		hasActiveRun = true;
		gameStarted = true;
		gameOver = false;
		paused = false;
		isStarting = false;
	}

	function resetRunState() {
		hasActiveRun = false;
		speed = 0;
		score = 0;
		carsPassed = 0;
		day = 1;
		targetCars = 200;
		distance = 0;
		playerX = 0;
		playerZOffset = 0;
		weather = 'clear';
		isNight = false;
		iceFactor = 0;
		fogFactor = 0;
		clearTransientControls();

		enemyCars.forEach((c) => scene?.remove(c.mesh));
		enemyCars = [];

		if (playerCar) {
			playerCar.position.set(0, 1.2, -2);
			playerCar.rotation.x = 0.25;
		}

		if (camera) {
			camera.position.set(0, 18, 30);
			camera.lookAt(0, -4, -70);
		}
	}

	function returnToSplash(preserveRun = false) {
		gameStarted = false;
		gameOver = false;
		paused = false;
		isStarting = false;

		if (preserveRun) {
			hasActiveRun = true;
			clearTransientControls();
			return;
		}

		resetRunState();
	}

	function handleReturnAction() {
		if (gameOver) {
			returnToSplash(false);
			return;
		}

		if (gameStarted) {
			returnToSplash(true);
			return;
		}

		backToDashboard();
	}

	function handleResize() {
		if (!camera || !renderer) return;
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') {
			e.preventDefault();
			handleReturnAction();
			return;
		}

		if (menuScreen && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
			e.preventDefault();
			moveFocus(-1);
			return;
		}

		if (menuScreen && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
			e.preventDefault();
			moveFocus(1);
			return;
		}

		if (menuScreen && (e.key === 'Enter' || e.key === ' ' || e.key === 'a' || e.key === 'A')) {
			e.preventDefault();
			activateFocusedMenuItem();
			return;
		}

		keys.add(e.key);

		if (gameStarted && !gameOver && (e.key === 'p' || e.key === 'P')) {
			e.preventDefault();
			paused = !paused;
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		keys.delete(e.key);
	}

	function updateTouchSteer(clientX: number, element: HTMLElement) {
		const rect = element.getBoundingClientRect();
		const ratio = ((clientX - rect.left) / rect.width) * 2 - 1;
		touchSteer = Math.max(-1, Math.min(1, ratio));
	}

	function handleSteerPointerDown(event: PointerEvent) {
		const element = event.currentTarget;
		if (!(element instanceof HTMLElement)) return;

		touchSteeringActive = true;
		element.setPointerCapture(event.pointerId);
		updateTouchSteer(event.clientX, element);
	}

	function handleSteerPointerMove(event: PointerEvent) {
		if (!touchSteeringActive) return;

		const element = event.currentTarget;
		if (!(element instanceof HTMLElement)) return;

		updateTouchSteer(event.clientX, element);
	}

	function clearTouchSteer(event?: PointerEvent) {
		const element = event?.currentTarget;
		if (event && element instanceof HTMLElement && element.hasPointerCapture(event.pointerId)) {
			element.releasePointerCapture(event.pointerId);
		}

		touchSteeringActive = false;
		touchSteer = 0;
	}

	$effect(() => {
		// Auto-focus first button on menu screens
		if (menuScreen) {
			const focusFirst = () => {
				const firstBtn = document.querySelector(MENU_BUTTON_SELECTOR) as HTMLElement;
				if (firstBtn) {
					firstBtn.focus();
					return true;
				}
				return false;
			};
			
			if (!focusFirst()) {
				// Try again after a short delay if DOM isn't ready
				const retryTimer = setTimeout(focusFirst, 50);
				const fallbackTimer = setTimeout(focusFirst, 250);
				return () => {
					clearTimeout(retryTimer);
					clearTimeout(fallbackTimer);
				};
			}
		}
	});

	const cNormalEven = new THREE.Color(0x1a1a1a);
	const cNormalOdd = new THREE.Color(0x111111);
	const cIceEven = new THREE.Color(0xffffff);
	const cIceOdd = new THREE.Color(0xf0f0ff);
	const cFog = new THREE.Color(0x777777);
	const tempColor = new THREE.Color();
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let roadGroup: THREE.Group;
	let playerCar: THREE.Group;
	let enemyCars: { mesh: THREE.Group; z: number; x: number; passed: boolean }[] = [];
	let horizon: THREE.Mesh;
	let fogPlane: THREE.Mesh;
	let animationId: number;

	const ROAD_WIDTH = 34;
	const CAR_SPEED = 0.85;
	const STEER_SPEED = 0.65;
	const MAX_X = ROAD_WIDTH / 2 - 4.5;
	const GAMEPAD_DEADZONE = 0.2;

	let keys = $state(new Set<string>());
	let gamepadSteer = $state(0);
	let audioCtx: AudioContext | null = null;

	function createRetroCar(color: number, isPlayer = false): THREE.Group {
		const group = new THREE.Group();

		const bodyGeo = new THREE.BoxGeometry(isPlayer ? 5.2 : 4.8, 2.2, 8);
		const bodyMat = new THREE.MeshBasicMaterial({
			color: isPlayer ? 0xff2222 : color
		});
		const body = new THREE.Mesh(bodyGeo, bodyMat);
		body.position.y = 1.6;
		group.add(body);

		const cabinGeo = new THREE.BoxGeometry(3.2, 1.8, 4.5);
		const cabinMat = new THREE.MeshBasicMaterial({
			color: 0x111111
		});
		const cabin = new THREE.Mesh(cabinGeo, cabinMat);
		cabin.position.set(0, 3.4, -1);
		group.add(cabin);

		const wheelMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
		const wheelPositions = [
			[-2.2, 0.9, 2.8],
			[2.2, 0.9, 2.8],
			[-2.2, 0.9, -2.8],
			[2.2, 0.9, -2.8]
		];

		wheelPositions.forEach((pos) => {
			const wheel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 2.4), wheelMat);
			wheel.position.set(pos[0], pos[1], pos[2]);
			group.add(wheel);
		});

		return group;
	}

	function createRoadSegment(index: number): THREE.Group {
		const group = new THREE.Group();

		const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, 6);
		const roadMat = new THREE.MeshBasicMaterial({
			color: index % 2 === 0 ? 0x1a1a1a : 0x111111
		});
		const road = new THREE.Mesh(roadGeo, roadMat);
		road.rotation.x = -Math.PI * 0.5;
		road.position.z = 0;
		group.add(road);

		if (index % 2 === 0) {
			const left = new THREE.Mesh(
				new THREE.PlaneGeometry(1.4, 6),
				new THREE.MeshBasicMaterial({ color: 0xffffff })
			);
			left.rotation.x = -Math.PI * 0.5;
			left.position.set(-ROAD_WIDTH / 2 + 2.2, 0.03, 0);
			group.add(left);

			const right = left.clone();
			right.position.x = ROAD_WIDTH / 2 - 2.2;
			group.add(right);
		}

		return group;
	}

	function initThree() {
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x112233);

		camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 1, 400);
		camera.position.set(0, 18, 30);
		camera.lookAt(0, 0, -60);

		renderer = new THREE.WebGLRenderer({
			canvas: canvasElement,
			antialias: false,
			alpha: false
		});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		const skyGeo = new THREE.PlaneGeometry(800, 240);
		const skyMat = new THREE.MeshBasicMaterial({
			color: 0x557799
		});
		horizon = new THREE.Mesh(skyGeo, skyMat);
		horizon.rotation.x = -0.32;
		horizon.position.y = 75;
		horizon.position.z = -250;
		scene.add(horizon);

		// Fog plane for limited visibility
		const fogGeo = new THREE.PlaneGeometry(ROAD_WIDTH * 10, 150);
		const fogMat = new THREE.MeshBasicMaterial({
			color: 0x777777,
			transparent: true,
			opacity: 0
		});
		fogPlane = new THREE.Mesh(fogGeo, fogMat);
		fogPlane.position.set(0, 5, -120);
		scene.add(fogPlane);

		roadGroup = new THREE.Group();
		scene.add(roadGroup);

		for (let i = 0; i < 100; i++) {
			const segment = createRoadSegment(i);
			segment.position.z = -i * 6;
			roadGroup.add(segment);
		}

		playerCar = createRetroCar(0xff2222, true);
		playerCar.position.set(0, 1.2, -2);
		playerCar.rotation.x = 0.25;
		scene.add(playerCar);

		spawnEnemy(-240);
		spawnEnemy(-310);

		animate();
	}

	function spawnEnemy(startZ = -140) {
		if (gameOver || !scene) return;

		const colors = [0x00bb33, 0x2266ff, 0xffdd00, 0xff6600];
		const car = createRetroCar(colors[Math.floor(Math.random() * colors.length)]);

		const lane = (Math.random() - 0.5) * (ROAD_WIDTH - 12);
		car.position.set(lane, 0, startZ);
		car.rotation.x = 0.1;

		scene.add(car);
		enemyCars.push({
			mesh: car,
			z: startZ,
			x: lane,
			passed: false
		});
	}

	function updateRoadAndWeather() {
		const cycle = Math.floor(distance / 6500);
		isNight = cycle % 2 === 1;

		if (isNight) {
			scene.background = new THREE.Color(0x000011);
			if (horizon.material instanceof THREE.MeshBasicMaterial)
				horizon.material.color.setHex(0x112244);
		} else {
			scene.background = new THREE.Color(0x225588);
			if (horizon.material instanceof THREE.MeshBasicMaterial)
				horizon.material.color.setHex(0x88bbff);
		}

		// Weather
		if (Math.random() < 0.004 && weather === 'clear') {
			weather = Math.random() > 0.5 ? 'fog' : 'ice';
			setTimeout(() => {
				if (!gameOver) weather = 'clear';
			}, 7200);
		}

		// Smooth transition for ice visuals
		const targetIce = weather === 'ice' ? 1 : 0;
		iceFactor = THREE.MathUtils.lerp(iceFactor, targetIce, 0.015);

		const targetFog = weather === 'fog' ? 1 : 0;
		fogFactor = THREE.MathUtils.lerp(fogFactor, targetFog, 0.02);

		if (fogPlane.material instanceof THREE.MeshBasicMaterial) {
			fogPlane.material.opacity = fogFactor * 0.85;
		}

		if (isNight) {
			scene.background = new THREE.Color(0x000011);
			if (horizon.material instanceof THREE.MeshBasicMaterial) {
				tempColor.setHex(0x112244).lerp(cFog, fogFactor * 0.5);
				horizon.material.color.copy(tempColor);
			}
		} else {
			scene.background = new THREE.Color(0x225588);
			if (horizon.material instanceof THREE.MeshBasicMaterial) {
				tempColor.setHex(0x88bbff).lerp(cFog, fogFactor);
				horizon.material.color.copy(tempColor);
			}
		}

		const curve = Math.sin(distance * 0.0004) * 32;

		roadGroup.children.forEach((child, i) => {
			if (child instanceof THREE.Group) {
				child.position.z += speed * 3.5;

				// Update colors for ice transition
				const roadMesh = child.children[0] as THREE.Mesh;
				const roadMat = roadMesh.material as THREE.MeshBasicMaterial;
				const baseColor = i % 2 === 0 ? cNormalEven : cNormalOdd;
				const iceColor = i % 2 === 0 ? cIceEven : cIceOdd;
				roadMat.color.copy(baseColor).lerp(iceColor, iceFactor);

				// Darken road during fog
				roadMat.color.lerp(cFog, fogFactor * 0.6);

				// Darken markers when road is white or foggy
				if (child.children.length > 1) {
					const markerColor = 1 - iceFactor * 0.35 - fogFactor * 0.4;
					const leftMarker = child.children[1] as THREE.Mesh;
					const leftMat = leftMarker.material as THREE.MeshBasicMaterial;
					leftMat.color.setRGB(markerColor, markerColor, markerColor);

					const rightMarker = child.children[2] as THREE.Mesh;
					const rightMat = rightMarker.material as THREE.MeshBasicMaterial;
					rightMat.color.setRGB(markerColor, markerColor, markerColor);
				}

				// Apply even more subtle curve starting ahead of the player
				const dz = Math.max(0, -child.position.z - 15);
				child.position.x = dz * dz * 0.001 * curve * 0.11;

				if (child.position.z > 40) {
					child.position.z -= 100 * 6;
				}
			}
		});

		for (let i = enemyCars.length - 1; i >= 0; i--) {
			const c = enemyCars[i];
			// Enemy speed is fixed, so relative movement depends on player speed
			c.z += (speed - 0.45) * 3.2;
			c.mesh.position.z = c.z;

			// Enemy cars also follow the same subtle curve
			const edz = Math.max(0, -c.z - 15);
			const curveOffset = edz * edz * 0.001 * curve * 0.11;
			c.mesh.position.x = c.x + curveOffset;

			if (!c.passed && c.z > 14) {
				c.passed = true;
				carsPassed++;
				score += 15 + day * 3;
				playPassSound();
			}

			// Adjusted collision detection for playerZOffset
			const dx = c.mesh.position.x - playerCar.position.x;
			if (Math.abs(dx) < 4.2 && Math.abs(c.z - (4 + playerZOffset)) < 7.5) {
				handleCrash();
				return;
			}

			if (c.z > 95) {
				scene.remove(c.mesh);
				enemyCars.splice(i, 1);
				spawnEnemy(-210 - Math.random() * 80);
			}
		}

		if (carsPassed >= targetCars) {
			score += 800;
			carsPassed = 0;
			day++;
			targetCars = day === 1 ? 200 : 300 + (day - 2) * 50;
		}
	}

	function handleCrash() {
		if (gameOver) return;
		gameOver = true;
		hasActiveRun = false;
		speed = 0;
		initAudio();
		playCrashSound();

		if (score > highScore) {
			highScore = score;
			localStorage.setItem('enduro-high-score', highScore.toString());
		}
	}

	function initAudio() {
		if (!audioCtx) {
			audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
		}
	}

	function playEngineSound() {
		if (!audioCtx) return;
		const osc = audioCtx.createOscillator();
		osc.type = 'sawtooth';
		// Pitch follows speed
		osc.frequency.value = 60 + speed * 60 + Math.random() * 25;

		const gain = audioCtx.createGain();
		gain.gain.value = 0.04 + speed * 0.03;

		const filter = audioCtx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = 450 + speed * 400;

		osc.connect(filter);
		filter.connect(gain);
		gain.connect(audioCtx.destination);

		osc.start();
		setTimeout(() => {
			if (audioCtx) {
				gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
				osc.stop(audioCtx.currentTime + 0.5);
			}
		}, 60);
	}

	function playCrashSound() {
		if (!audioCtx) return;
		const noise = audioCtx.createBufferSource();
		const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 1.1, audioCtx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
		noise.buffer = buffer;

		const filter = audioCtx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(1800, audioCtx.currentTime);
		filter.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.9);

		const gain = audioCtx.createGain();
		gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.1);

		noise.connect(filter);
		filter.connect(gain);
		gain.connect(audioCtx.destination);
		noise.start();
	}

	function playPassSound() {
		if (!audioCtx) return;
		const noise = audioCtx.createBufferSource();
		const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
		noise.buffer = buffer;

		const filter = audioCtx.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.setValueAtTime(1200, audioCtx.currentTime);
		filter.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);

		const gain = audioCtx.createGain();
		gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

		noise.connect(filter);
		filter.connect(gain);
		gain.connect(audioCtx.destination);
		noise.start();
	}

	function animate() {
		animationId = requestAnimationFrame(animate);
		if (!renderer || !scene || !camera) return;

		// Gamepad handling (following Space Invaders pattern)
		const gamepads = navigator.getGamepads();
		let gpThrottle = false;
		let gpBrake = false;
		let gpSteer = 0;

		for (let gi = 0; gi < gamepads.length; gi++) {
			const gp = gamepads[gi];
			if (!gp) continue;

			// Steering (X-axis or D-pad)
			const axisX = gp.axes[0];
			if (Math.abs(axisX) > GAMEPAD_DEADZONE) {
				gpSteer = axisX;
			}
			if (gp.buttons[14]?.pressed) gpSteer = -1;
			if (gp.buttons[15]?.pressed) gpSteer = 1;

			// Throttle/Brake (Y-axis or D-pad or Buttons)
			const axisY = gp.axes[1];
			if (axisY < -GAMEPAD_DEADZONE) gpThrottle = true;
			if (axisY > GAMEPAD_DEADZONE) gpBrake = true;

			const joyUp = gp.buttons[12]?.pressed || axisY < -0.5;
			const joyDown = gp.buttons[13]?.pressed || axisY > 0.5;

			if (joyUp && !lastJoyUp) {
				if (!gameStarted || gameOver) moveFocus(-1);
			}
			if (joyDown && !lastJoyDown) {
				if (!gameStarted || gameOver) moveFocus(1);
			}
			lastJoyUp = joyUp;
			lastJoyDown = joyDown;

			if (gp.buttons[12]?.pressed) gpThrottle = true; // D-pad Up
			if (gp.buttons[13]?.pressed) gpBrake = true; // D-pad Down

			// Action Buttons (0=A, 1=B, 2=X, 3=Y, 7=RT)
			const fireBtn =
				gp.buttons[0]?.pressed ||
				gp.buttons[1]?.pressed ||
				gp.buttons[2]?.pressed ||
				gp.buttons[3]?.pressed ||
				gp.buttons[7]?.pressed;

			if (fireBtn && !lastFireBtn) {
				if (!gameStarted || gameOver) {
					const active = document.activeElement;
					if (active instanceof HTMLElement && active.tagName !== 'BODY') {
						active.click();
					} else {
						// Fallback if focus is lost
						if (gameOver) restartGame();
						else if (!gameStarted) startGame();
					}
				}
			}

			const pauseBtn = gp.buttons[9]?.pressed; // Start
			const selectBtn = gp.buttons[8]?.pressed; // Select/Back

			if (selectBtn && !lastBackBtn) {
				handleReturnAction();
			}

			// Mimic original Enduro: fire button = accelerate
			if (fireBtn && gameStarted && !gameOver && !paused) gpThrottle = true;

			// Start/Pause (9=Start)
			if (pauseBtn) {
				if (!gamepadStartWasPressed && gameStarted && !gameOver) {
					paused = !paused;
				}
				gamepadStartWasPressed = true;
			} else {
				gamepadStartWasPressed = false;
			}

			lastFireBtn = fireBtn;
			lastBackBtn = selectBtn;
		}

		gamepadSteer = gpSteer;
		gamepadThrottle = gpThrottle;
		gamepadBrake = gpBrake;

		if (gameStarted && !gameOver && !paused) {
			// Throttle and Brake (Combined Keyboard + Gamepad)
			const isAccelerating =
				keys.has('ArrowUp') || keys.has('w') || keys.has('W') || gamepadThrottle || touchThrottle;
			const isBraking =
				keys.has('ArrowDown') || keys.has('s') || keys.has('S') || gamepadBrake || touchBrake;

			if (isAccelerating) {
				speed = Math.min(maxSpeed, speed + 0.012);
			} else if (isBraking) {
				speed = Math.max(0, speed - 0.025);
			}

			distance += speed * 12;

			let steer = 0;
			if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) steer -= 1;
			if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) steer += 1;
			steer += gamepadSteer;
			steer += touchSteer;

			playerX = Math.max(-MAX_X, Math.min(MAX_X, playerX + steer * STEER_SPEED));

			playerCar.position.x = THREE.MathUtils.lerp(playerCar.position.x, playerX, 0.26);

			// Forward-nudging effect based on speed
			playerZOffset = THREE.MathUtils.lerp(playerZOffset, speed * 8, 0.05);
			playerCar.position.z = -2 + playerZOffset;

			camera.position.x = playerCar.position.x * 0.4;
			camera.lookAt(playerCar.position.x * 0.6, -4, -70);

			updateRoadAndWeather();

			if (Math.random() < 0.15) playEngineSound();
		}

		if (!paused) {
			playerCar.position.y = 1.2 + Math.sin(Date.now() * 0.009) * 0.06;
		}

		renderer.render(scene, camera);
	}

	function startGame() {
		initAudio();
		if (audioCtx?.state === 'suspended') audioCtx.resume();

		hasActiveRun = true;
		gameStarted = true;
		gameOver = false;
		paused = false;
		isStarting = true;
		speed = 0.45; // Start with some momentum
		score = 0;
		carsPassed = 0;
		day = 1;
		targetCars = 200;
		distance = 0;
		playerX = 0;
		playerZOffset = 0;
		weather = 'clear';

		enemyCars.forEach((c) => scene?.remove(c.mesh));
		enemyCars = [];

		setTimeout(() => {
			if (gameStarted && !gameOver) {
				isStarting = false;
				for (let i = 0; i < 8; i++) spawnEnemy(-180 - i * 45);
			}
		}, 2500);
	}

	function restartGame() {
		startGame();
	}

	function goToSplash() {
		returnToSplash(false);
	}

	onMount(() => {
		const saved = localStorage.getItem('enduro-high-score');
		if (saved) highScore = parseInt(saved, 10);
		touchCapable = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

		initThree();

		return () => {
			if (animationId) cancelAnimationFrame(animationId);
			if (renderer) {
				renderer.dispose();
			}
		};
	});
</script>

<svelte:head>
	<title>Enduro | Game Chaos</title>
</svelte:head>

<svelte:window bind:innerWidth={viewportWidth} onkeydown={handleKeyDown} onkeyup={handleKeyUp} onresize={handleResize} />

<div class="relative h-screen w-screen overflow-hidden bg-black font-mono">
	<canvas bind:this={canvasElement} class="absolute inset-0 h-full w-full"></canvas>

	<!-- SPLASH -->
	{#if !gameStarted && !gameOver}
		<div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
			<div class="mb-8 flex scale-125 gap-6">
				<div class="text-7xl">🏎️</div>
				<div class="text-7xl text-yellow-400">1983</div>
			</div>

			<h1
				class="mb-3 text-[92px] leading-none font-black tracking-[-6px] text-[#ffcc00] drop-shadow-[0_8px_0_#000]"
			>
				ENDURO
			</h1>
			<div class="mb-10 text-4xl font-bold tracking-[6px] text-white">ACTIVISION</div>

			<div
				class="mb-12 max-w-xs border-4 border-white bg-black p-6 text-center text-lg leading-tight text-white"
			>
				PASS <span class="text-yellow-300">200 CARS</span> ON DAY 1<br />
				THEN 300+ EVERY DAY AFTER<br />
				<span class="mt-4 block text-xs opacity-70">FOG • ICE • NIGHT</span>
				<span class="mt-3 block text-xs leading-relaxed opacity-70">
					KEYBOARD • GAMEPAD • TOUCH<br />
					A / ENTER = SELECT • B / ESC = RETURN
				</span>
			</div>

			<div class="mt-8 flex flex-col gap-4">
				{#if hasActiveRun}
					<button
						data-menu-button
						onclick={continueGame}
						class="border-4 border-yellow-400 bg-black px-14 py-5 text-4xl font-black text-yellow-400 transition-all hover:scale-110 hover:bg-yellow-400 hover:text-black focus:scale-110 focus:bg-yellow-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-95"
					>
						CONTINUE
					</button>
					<button
						data-menu-button
						onclick={startGame}
						class="border-4 border-white bg-black px-14 py-4 text-center text-2xl font-black text-white transition-all hover:scale-110 hover:bg-white hover:text-black focus:scale-110 focus:bg-white focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-95"
					>
						NEW GAME
					</button>
				{:else}
					<button
						data-menu-button
						onclick={startGame}
						class="border-4 border-yellow-400 bg-black px-14 py-5 text-4xl font-black text-yellow-400 transition-all hover:scale-110 hover:bg-yellow-400 hover:text-black focus:scale-110 focus:bg-yellow-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-95"
					>
						PRESS START
					</button>
				{/if}
				<button
					data-menu-button
					onclick={backToDashboard}
					class="border-4 border-white bg-black px-14 py-4 text-center text-2xl font-black text-white transition-all hover:scale-110 hover:bg-white hover:text-black focus:scale-110 focus:bg-white focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-95"
				>
					DASHBOARD
				</button>
			</div>

			<div class="mt-16 text-sm text-white/60">
				← → / WASD STEER • ↑ ↓ SPEED<br />
				GAMEPAD + TOUCH DRAG / THROTTLE / BRAKE
			</div>

			{#if highScore > 0}
				<div class="absolute bottom-12 text-xl font-bold text-yellow-400">
					HIGH SCORE — {highScore}
				</div>
			{/if}
		</div>
	{/if}

	<!-- IN-GAME HUD -->
	{#if gameStarted}
		<div class="pointer-events-none absolute inset-0 z-30 flex flex-col p-6 text-white">
			<div class="flex justify-between text-2xl font-black">
				<div>DAY <span class="text-[#ffcc00]">{day}</span></div>
				<div class="text-right">
					PASSED <span class="text-[#ffcc00]">{carsPassed}</span> /
					<span class="text-white/70">{targetCars}</span>
				</div>
			</div>

			<div class="mt-auto flex items-baseline justify-between text-5xl font-black tracking-tighter">
				<div class="text-[#ffcc00]">{score.toString().padStart(5, '0')}</div>
				<div class="self-end font-mono text-sm text-white/40">
					HI {highScore.toString().padStart(5, '0')}
				</div>
			</div>

			{#if weather !== 'clear'}
				<div
					class="absolute top-24 left-1/2 -translate-x-1/2 rounded border border-red-500 bg-black/80 px-8 py-2 text-xl font-bold text-red-400 shadow-xl"
				>
					{weather.toUpperCase()} CONDITIONS
				</div>
			{/if}

			{#if isStarting}
				<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div
						class="text-7xl font-black tracking-widest text-[#ffcc00] drop-shadow-[0_8px_0_#000]"
					>
						GET READY!
					</div>
				</div>
			{/if}

			{#if isNight}
				<div class="absolute top-8 right-8 text-xs font-bold text-blue-300">NIGHT</div>
			{/if}

			<div class="absolute right-6 bottom-6 text-right text-xs font-bold text-white/55">
				ESC / B TO SPLASH<br />
				P TO PAUSE
			</div>

			{#if paused}
				<div class="absolute top-32 left-0 right-0 flex justify-center bg-transparent">
					<div class="rounded-xl border-4 border-yellow-400 bg-black/80 px-16 py-6">
						<div class="text-5xl font-black tracking-widest text-yellow-400">PAUSED</div>
						<div class="mt-2 text-center text-lg font-bold text-white/70">PRESS 'P' TO RESUME</div>
					</div>
				</div>
			{/if}
		</div>

		{#if showTouchControls}
			<div class="absolute inset-x-0 bottom-0 z-40 flex items-end justify-between gap-4 p-4 text-white sm:p-6">
				<div class="pointer-events-auto w-[58%] max-w-sm">
					<div class="mb-2 text-xs font-black tracking-[0.35em] text-white/60">STEER</div>
					<div
						class="relative h-24 rounded-none border-4 border-white bg-black/70 px-4 py-3 touch-none select-none"
						role="slider"
						tabindex="0"
						aria-label="Touch steering"
						aria-valuemin={-100}
						aria-valuemax={100}
						aria-valuenow={Math.round(touchSteer * 100)}
						onpointerdown={handleSteerPointerDown}
						onpointermove={handleSteerPointerMove}
						onpointerup={clearTouchSteer}
						onpointercancel={clearTouchSteer}
						onpointerleave={clearTouchSteer}
					>
						<div class="flex h-full items-center justify-between text-3xl font-black text-white/35">
							<span>←</span>
							<span>→</span>
						</div>
						<div class="absolute top-1/2 right-4 left-4 h-1 -translate-y-1/2 bg-white/20"></div>
						<div
							class="absolute top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border-4 border-yellow-400 bg-black"
							style={`left: calc(50% + ${touchSteer * 42}px); transform: translate(-50%, -50%);`}
						></div>
					</div>
				</div>

				<div class="pointer-events-auto flex shrink-0 flex-col gap-3">
					<button
						class={[
							'min-w-28 border-4 px-5 py-4 text-lg font-black text-white transition-all touch-none select-none',
							touchThrottle ? 'border-yellow-400 bg-yellow-400 text-black scale-95' : 'border-white bg-black/75'
						]}
						onpointerdown={() => (touchThrottle = true)}
						onpointerup={() => (touchThrottle = false)}
						onpointercancel={() => (touchThrottle = false)}
						onpointerleave={() => (touchThrottle = false)}
					>
						THROTTLE
					</button>
					<button
						class={[
							'min-w-28 border-4 px-5 py-4 text-lg font-black text-white transition-all touch-none select-none',
							touchBrake ? 'border-red-500 bg-red-500 text-black scale-95' : 'border-white bg-black/75'
						]}
						onpointerdown={() => (touchBrake = true)}
						onpointerup={() => (touchBrake = false)}
						onpointercancel={() => (touchBrake = false)}
						onpointerleave={() => (touchBrake = false)}
					>
						BRAKE
					</button>
				</div>
			</div>
		{/if}
	{/if}

	<!-- GAME OVER -->
	{#if gameOver}
		<div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95">
			<div class="mb-6 text-8xl font-black text-red-500 drop-shadow-[0_10px_4px_#000]">CRASHED</div>

			<div class="mb-8 text-5xl font-bold text-white">DAY {day} • {carsPassed} CARS</div>

			<div class="mb-12 text-6xl font-black text-yellow-400">
				{score}
			</div>

			{#if score >= highScore && score > 0}
				<div class="mb-8 text-3xl font-bold tracking-widest text-lime-400">NEW HIGH SCORE</div>
			{/if}

			<div class="flex flex-col gap-4">
				<button
					data-menu-button
					onclick={restartGame}
					class="border-4 border-white bg-white px-16 py-6 text-4xl font-black text-black transition-all hover:scale-110 hover:bg-yellow-300 focus:scale-110 focus:bg-yellow-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
				>
					RETRY
				</button>
				<button
					data-menu-button
					onclick={goToSplash}
					class="border-4 border-white px-16 py-6 text-4xl font-black text-white transition-all hover:scale-110 hover:bg-white hover:text-black focus:scale-110 focus:bg-white focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
				>
					BACK TO SPLASH
				</button>
			</div>

			<div class="mt-12 text-sm text-white/50">ENTER / A TO SELECT • ESC / B TO RETURN</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
	}
</style>
