<script lang="ts">
	import { onMount, tick } from 'svelte';
	import * as THREE from 'three';
	import { getBooleanCabinetFlow, returnFromCabinet } from '$lib/cabinet-flow';
	import { gameCabinetById, readCabinetScore, recordCabinetHighScore } from '$lib/cabinets';
	import { normalizeKey } from '$lib/keys';
	import {
		activateFocusedControlItem,
		focusFirstControlItem,
		handleLinearMenuKeydown,
		MENU_BUTTON_SELECTOR,
		moveLinearFocus
	} from '$lib/unified-controls';

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
	let helpOpen = $state(false);
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

	let stageElement = $state<HTMLDivElement | null>(null);
	let canvasElement = $state<HTMLCanvasElement | null>(null);

	let flow = $derived(
		getBooleanCabinetFlow({
			gameStarted,
			ended: gameOver
		})
	);
	let splashScreen = $derived(flow.splashScreen);
	let gameScreen = $derived(flow.gameScreen);
	let endScreen = $derived(flow.endScreen);
	let menuScreen = $derived(flow.menuScreen);
	let showTouchControls = $derived(touchCapable && viewportWidth < 960 && gameScreen);

	let keyUp = $state(false);
	let keyDown = $state(false);
	let keyLeft = $state(false);
	let keyRight = $state(false);

	function clearTransientControls() {
		keyUp = false;
		keyDown = false;
		keyLeft = false;
		keyRight = false;
		touchThrottle = false;
		touchBrake = false;
		touchSteer = 0;
		touchSteeringActive = false;
		gamepadThrottle = false;
		gamepadBrake = false;
		gamepadSteer = 0;
	}

	function clearWeatherTimer() {
		if (!weatherTimer) return;
		clearTimeout(weatherTimer);
		weatherTimer = null;
	}

	function clearStartTimer() {
		if (!startTimer) return;
		clearTimeout(startTimer);
		startTimer = null;
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
		if (isStarting && enemyCars.length === 0 && !startTimer) {
			queueStartSequence();
		}
	}

	function resetRunState() {
		clearStartTimer();
		clearWeatherTimer();
		hasActiveRun = false;
		isStarting = false;
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

		if (preserveRun) {
			hasActiveRun = true;
			clearTransientControls();
			return;
		}

		resetRunState();
	}

	function handleReturnAction() {
		returnFromCabinet(flow, {
			toDashboard: backToDashboard,
			toSplash: returnToSplash
		});
	}

	function readStageSize(): StageSize {
		const rect = stageElement?.getBoundingClientRect();
		const fallbackWidth =
			typeof window === 'undefined' ? FALLBACK_STAGE_SIZE.width : window.innerWidth;
		const fallbackHeight =
			typeof window === 'undefined' ? FALLBACK_STAGE_SIZE.height : window.innerHeight;

		return {
			width: Math.max(1, Math.floor(rect?.width || fallbackWidth || FALLBACK_STAGE_SIZE.width)),
			height: Math.max(1, Math.floor(rect?.height || fallbackHeight || FALLBACK_STAGE_SIZE.height))
		};
	}

	function resizeRendererToStage() {
		if (!camera || !renderer) return;

		const size = readStageSize();
		camera.aspect = size.width / size.height;
		camera.updateProjectionMatrix();
		renderer.setSize(size.width, size.height, false);
	}

	function handleResize() {
		resizeRendererToStage();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (
			handleLinearMenuKeydown(e, {
				enabled: menuScreen,
				onBack: handleReturnAction,
				selector: MENU_BUTTON_SELECTOR
			})
		)
			return;

		const key = normalizeKey(e.key);

		// Track key state
		if (key === 'w' || key === 'W') keyUp = true;
		if (key === 's' || key === 'S') keyDown = true;
		if (key === 'a' || key === 'A') keyLeft = true;
		if (key === 'd' || key === 'D') keyRight = true;

		// In-game controls
		if (gameStarted && !gameOver) {
			if (e.key === 'p' || e.key === 'P') {
				e.preventDefault();
				paused = !paused;
			}
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		const key = normalizeKey(e.key);
		if (key === 'w' || key === 'W') keyUp = false;
		if (key === 's' || key === 'S') keyDown = false;
		if (key === 'a' || key === 'A') keyLeft = false;
		if (key === 'd' || key === 'D') keyRight = false;
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
				return focusFirstControlItem(MENU_BUTTON_SELECTOR, true);
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
		} else {
			// Game is running — move focus away from any button so
			// svelte:window receives all keydown/keyup events directly
			(document.activeElement as HTMLElement)?.blur();
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
	type StageSize = {
		width: number;
		height: number;
	};

	type EnemyCar = {
		mesh: THREE.Group;
		z: number;
		x: number;
		passed: boolean;
	};

	type GamepadInput = {
		throttle: boolean;
		brake: boolean;
		steer: number;
	};

	let enemyCars: EnemyCar[] = [];
	let horizon: THREE.Mesh;
	let fogPlane: THREE.Mesh;
	let fogPlaneNear: THREE.Mesh;
	let animationId = 0;
	let lastFrameNow = 0;
	let resizeObserver: ResizeObserver | null = null;
	let weatherTimer: ReturnType<typeof setTimeout> | null = null;
	let startTimer: ReturnType<typeof setTimeout> | null = null;

	const ROAD_WIDTH = 34;
	const STEER_SPEED = 0.65;
	const MAX_X = ROAD_WIDTH / 2 - 4.5;
	const GAMEPAD_DEADZONE = 0.2;
	const TARGET_FRAME_MS = 1000 / 60;
	const MAX_FRAME_SCALE = 2.5;
	const FALLBACK_STAGE_SIZE: StageSize = { width: 960, height: 540 };
	// Coarse arcade hit box tuned to the visible car bodies.
	const CAR_COLLISION = {
		halfWidth: 4.2,
		playerHalfDepth: 4,
		enemyHalfDepth: 4,
		rearClearance: 0.75
	} as const;
	const cabinet = gameCabinetById.enduro;

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
		if (!canvasElement) return;

		const stageSize = readStageSize();

		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x112233);

		camera = new THREE.PerspectiveCamera(64, stageSize.width / stageSize.height, 1, 400);
		camera.position.set(0, 18, 30);
		camera.lookAt(0, 0, -60);

		renderer = new THREE.WebGLRenderer({
			canvas: canvasElement,
			antialias: false,
			alpha: false
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(stageSize.width, stageSize.height, false);

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

		// Second, closer fog plane for denser layered effect
		const fogGeoNear = new THREE.PlaneGeometry(ROAD_WIDTH * 12, 200);
		const fogMatNear = new THREE.MeshBasicMaterial({
			color: 0x909090,
			transparent: true,
			opacity: 0
		});
		fogPlaneNear = new THREE.Mesh(fogGeoNear, fogMatNear);
		fogPlaneNear.position.set(0, 8, -55);
		scene.add(fogPlaneNear);

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

		startRenderLoop();
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

	function frameLerp(baseAmount: number, frameScale: number) {
		return 1 - (1 - baseAmount) ** frameScale;
	}

	function getFrameScale(now: number) {
		if (!lastFrameNow) {
			lastFrameNow = now;
			return 1;
		}

		const elapsed = Math.max(0, Math.min(100, now - lastFrameNow));
		lastFrameNow = now;
		return Math.min(MAX_FRAME_SCALE, Math.max(0.25, elapsed / TARGET_FRAME_MS));
	}

	function enemyCollidesWithPlayer(enemy: EnemyCar) {
		if (!playerCar) return false;
		if (enemy.passed) return false;

		const dx = enemy.mesh.position.x - playerCar.position.x;
		const dz = enemy.z - playerCar.position.z;
		const overlapDepth = CAR_COLLISION.playerHalfDepth + CAR_COLLISION.enemyHalfDepth;
		return Math.abs(dx) < CAR_COLLISION.halfWidth && Math.abs(dz) < overlapDepth;
	}

	function enemyHasClearedPlayer(enemy: EnemyCar) {
		if (!playerCar) return false;

		const clearDistance =
			CAR_COLLISION.playerHalfDepth + CAR_COLLISION.enemyHalfDepth + CAR_COLLISION.rearClearance;
		return enemy.z - playerCar.position.z > clearDistance;
	}

	function updateRoadAndWeather(frameScale: number) {
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
		if (Math.random() < 0.004 * frameScale && weather === 'clear' && !weatherTimer) {
			weather = Math.random() > 0.5 ? 'fog' : 'ice';
			weatherTimer = setTimeout(() => {
				if (!gameOver) weather = 'clear';
				weatherTimer = null;
			}, 7200);
		}

		// Smooth transition for ice visuals
		const targetIce = weather === 'ice' ? 1 : 0;
		iceFactor = THREE.MathUtils.lerp(iceFactor, targetIce, frameLerp(0.015, frameScale));

		const targetFog = weather === 'fog' ? 1 : 0;
		fogFactor = THREE.MathUtils.lerp(fogFactor, targetFog, frameLerp(0.02, frameScale));

		if (fogPlane.material instanceof THREE.MeshBasicMaterial) {
			fogPlane.material.opacity = fogFactor * 0.96;
		}
		if (fogPlaneNear.material instanceof THREE.MeshBasicMaterial) {
			fogPlaneNear.material.opacity = fogFactor * 0.62;
		}

		if (isNight) {
			tempColor.setHex(0x000011).lerp(cFog, fogFactor * 0.65);
			scene.background = tempColor.clone();
			if (horizon.material instanceof THREE.MeshBasicMaterial) {
				tempColor.setHex(0x112244).lerp(cFog, fogFactor * 0.65);
				horizon.material.color.copy(tempColor);
			}
		} else {
			tempColor.setHex(0x225588).lerp(cFog, fogFactor * 0.9);
			scene.background = tempColor.clone();
			if (horizon.material instanceof THREE.MeshBasicMaterial) {
				tempColor.setHex(0x88bbff).lerp(cFog, fogFactor);
				horizon.material.color.copy(tempColor);
			}
		}

		const curve = Math.sin(distance * 0.0004) * 32;

		roadGroup.children.forEach((child, i) => {
			if (child instanceof THREE.Group) {
				child.position.z += speed * 3.5 * frameScale;

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
			c.z += (speed - 0.45) * 3.2 * frameScale;
			c.mesh.position.z = c.z;

			// Enemy cars also follow the same subtle curve
			const edz = Math.max(0, -c.z - 15);
			const curveOffset = edz * edz * 0.001 * curve * 0.11;
			c.mesh.position.x = c.x + curveOffset;

			if (!c.passed && enemyHasClearedPlayer(c)) {
				c.passed = true;
				carsPassed++;
				score += 15 + day * 3;
				playPassSound();
			}

			if (enemyCollidesWithPlayer(c)) {
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
			highScore = recordCabinetHighScore(localStorage, cabinet, score);
		}
	}

	function initAudio() {
		if (!audioCtx) {
			type AudioWindow = Window &
				typeof globalThis & {
					webkitAudioContext?: typeof AudioContext;
				};
			const AudioContextConstructor =
				window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
			if (!AudioContextConstructor) return;
			audioCtx = new AudioContextConstructor();
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

	function pollGamepadInput(): GamepadInput {
		const gamepads = navigator.getGamepads?.() ?? [];
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
				if (menuScreen) moveLinearFocus(-1, MENU_BUTTON_SELECTOR);
			}
			if (joyDown && !lastJoyDown) {
				if (menuScreen) moveLinearFocus(1, MENU_BUTTON_SELECTOR);
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
				if (menuScreen) {
					if (!activateFocusedControlItem(MENU_BUTTON_SELECTOR)) {
						// Fallback if focus is lost
						if (endScreen) restartGame();
						else if (splashScreen) startGame();
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

		return {
			throttle: gpThrottle,
			brake: gpBrake,
			steer: gpSteer
		};
	}

	function updateDrivingFrame(input: GamepadInput, frameScale: number, now: number) {
		if (!playerCar || !camera) return;

		if (gameStarted && !gameOver && !paused) {
			// Throttle and Brake (Combined Keyboard + Gamepad)
			const isAccelerating = keyUp || input.throttle || touchThrottle;
			const isBraking = keyDown || input.brake || touchBrake;

			if (isAccelerating) {
				speed = Math.min(maxSpeed, speed + 0.012 * frameScale);
			} else if (isBraking) {
				speed = Math.max(0, speed - 0.025 * frameScale);
			}

			distance += speed * 12 * frameScale;

			// Centrifugal drift: curve > 0 = road bends right → push player left
			const curveDrift = Math.sin(distance * 0.0004) * 32;
			const curvePush = -curveDrift * 0.0006 * speed * frameScale;

			let steer = 0;
			if (keyLeft) steer -= 1;
			if (keyRight) steer += 1;
			steer += input.steer;
			steer += touchSteer;

			playerX = Math.max(-MAX_X, Math.min(MAX_X, playerX + steer * STEER_SPEED * frameScale + curvePush));

			playerCar.position.x = THREE.MathUtils.lerp(
				playerCar.position.x,
				playerX,
				frameLerp(0.26, frameScale)
			);

			// Forward-nudging effect based on speed
			playerZOffset = THREE.MathUtils.lerp(playerZOffset, speed * 8, frameLerp(0.05, frameScale));
			playerCar.position.z = -2 + playerZOffset;

			camera.position.x = playerCar.position.x * 0.4;
			// Camera looks slightly into the curve for a banking feel
			camera.lookAt(playerCar.position.x * 0.6 + curveDrift * 0.25, -4, -70);

			updateRoadAndWeather(frameScale);

			if (Math.random() < 0.15 * frameScale) playEngineSound();
		}

		if (!paused) {
			playerCar.position.y = 1.2 + Math.sin(now * 0.009) * 0.06;
		}
	}

	function renderFrame(now: number) {
		if (!renderer || !scene || !camera) return;

		const frameScale = getFrameScale(now);
		const gamepadInput = pollGamepadInput();
		updateDrivingFrame(gamepadInput, frameScale, now);

		renderer.render(scene, camera);
	}

	function animate(now: number) {
		animationId = requestAnimationFrame(animate);
		renderFrame(now);
	}

	function startRenderLoop() {
		if (animationId) cancelAnimationFrame(animationId);
		lastFrameNow = 0;
		animationId = requestAnimationFrame(animate);
	}

	function queueStartSequence() {
		clearStartTimer();
		startTimer = setTimeout(() => {
			startTimer = null;
			if (gameStarted && !gameOver) {
				isStarting = false;
				for (let i = 0; i < 8; i++) spawnEnemy(-180 - i * 45);
			}
		}, 2500);
	}

	function startGame() {
		initAudio();
		if (audioCtx?.state === 'suspended') audioCtx.resume();

		clearWeatherTimer();
		clearStartTimer();
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

		queueStartSequence();
	}

	function restartGame() {
		startGame();
	}

	function goToSplash() {
		returnToSplash(false);
	}

	onMount(() => {
		let destroyed = false;

		async function setupStage() {
			highScore = readCabinetScore(localStorage, cabinet);
			touchCapable = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

			await tick();
			if (destroyed) return;

			initThree();
			resizeObserver = new ResizeObserver(resizeRendererToStage);
			if (stageElement) resizeObserver.observe(stageElement);
			resizeRendererToStage();
		}

		setupStage();

		return () => {
			destroyed = true;
			if (animationId) cancelAnimationFrame(animationId);
			resizeObserver?.disconnect();
			clearStartTimer();
			clearWeatherTimer();
			if (renderer) {
				renderer.dispose();
			}
		};
	});
</script>

<svelte:head>
	<title>Enduro Chaos | Retro 3D Racing Game</title>
	<meta
		name="description"
		content="Race against the clock and other cars in Enduro Chaos. A 3D retro racing game inspired by classic 1983 arcade hits. Experience fog, ice, and night racing!"
	/>
	<meta property="og:title" content="Enduro Chaos - 3D Retro Racing" />
	<meta
		property="og:description"
		content="Can you pass 200 cars on Day 1? Speed through changing weather conditions in this intense vintage racer."
	/>
</svelte:head>

<svelte:window
	bind:innerWidth={viewportWidth}
	onkeydown={handleKeyDown}
	onkeyup={handleKeyUp}
	onresize={handleResize}
	onblur={clearTransientControls}
/>

<div class="relative h-screen w-screen overflow-hidden bg-black font-mono">
	<div bind:this={stageElement} class="absolute inset-0 z-0 overflow-hidden bg-black">
		<canvas bind:this={canvasElement} class="block h-full w-full"></canvas>
	</div>

	<!-- SPLASH -->
	{#if splashScreen}
		<div
			class="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-yellow-300 px-1 py-2 font-mono text-black sm:px-6 sm:py-8"
		>
			<div
				class="my-auto w-full max-w-4xl border-4 border-black bg-white shadow-[4px_4px_0_rgba(0,0,0,1)] sm:shadow-[14px_14px_0_rgba(0,0,0,1)]"
			>
				<div class="border-b-4 border-black bg-black px-4 py-3 text-yellow-300 sm:px-8 sm:py-5">
					<div
						class="text-[0.55rem] font-black tracking-[0.4em] uppercase text-yellow-300/50 sm:text-xs"
					>
						Road Fury
					</div>
					<div class="flex items-center justify-between gap-4">
						<h1
							class="text-xl font-black leading-none uppercase sm:text-5xl sm:drop-shadow-[3px_3px_0_rgba(255,221,0,0.25)]"
						>
							🏎️ Enduro Chaos 🏎️
						</h1>
						<div class="shrink-0 text-right">
							<div
								class="text-[0.5rem] tracking-widest uppercase text-yellow-300/50 sm:text-[0.6rem]"
							>
								Hi-Score
							</div>
							<div class="text-lg font-black leading-none sm:text-4xl">{highScore}</div>
						</div>
					</div>
					<p class="mt-1 text-[0.65rem] font-bold uppercase text-yellow-300/60 sm:mt-2 sm:text-base">
						Pass 200 cars on day 1. Burn rubber.
					</p>
				</div>

				<div class="p-4 sm:p-8">
					<div class="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-4">
						<div class="border-2 border-black bg-yellow-100 p-2 sm:border-4 sm:p-4">
							<div
								class="mb-2 text-[0.55rem] font-black tracking-[0.3em] uppercase text-black/50 sm:mb-3 sm:text-xs"
							>
								Day 1 Target
							</div>
							<div class="text-xs font-black uppercase leading-tight sm:text-base">
								Pass 200 Cars
							</div>
							<div class="mt-1 text-[0.5rem] font-bold uppercase text-black/60 sm:text-xs">
								300+ every day after
							</div>
						</div>
						<div class="border-2 border-black bg-yellow-100 p-2 sm:border-4 sm:p-4">
							<div
								class="mb-2 text-[0.55rem] font-black tracking-[0.3em] uppercase text-black/50 sm:mb-3 sm:text-xs"
							>
								Conditions
							</div>
							<div class="text-xs font-black uppercase leading-tight sm:text-base">
								Fog • Ice • Night
							</div>
							<div class="mt-1 text-[0.5rem] font-bold uppercase text-black/60 sm:text-xs">
								Weather shifts mid-run
							</div>
						</div>
					</div>

					<div class="mb-4 border-2 border-black sm:mb-6 sm:border-4">
						<button
							type="button"
							onclick={() => (helpOpen = !helpOpen)}
							class="flex w-full items-center justify-between bg-yellow-200 px-3 py-2 text-xs font-black uppercase transition-colors hover:bg-yellow-300 active:scale-[0.98] sm:px-4 sm:py-3 sm:text-sm"
						>
							<span>❓ How to Play</span>
							<span
								class="text-base leading-none transition-transform duration-200"
								class:rotate-180={helpOpen}>▾</span
							>
						</button>
						{#if helpOpen}
							<div
								class="border-t-2 border-black bg-yellow-50 px-3 py-2 text-xs font-bold leading-relaxed uppercase sm:border-t-4 sm:px-4 sm:py-3 sm:text-sm"
							>
								← → / WASD steer • ↑ ↓ speed up or brake.<br />
								Gamepad + touch drag / throttle / brake supported.<br />
								P pauses during a run. Esc / B returns to splash.<br />
								<span class="mt-2 block text-[0.6rem] text-black/60 sm:text-xs">
									A / Enter = select • B / Esc = return.
								</span>
							</div>
						{/if}
					</div>

					{#if hasActiveRun}
						<div class="grid grid-cols-2 gap-2 sm:gap-4">
							<button
								data-menu-button
								onclick={continueGame}
								class="border-2 border-yellow-400 bg-black py-3 text-base font-black text-yellow-400 uppercase transition-all hover:bg-yellow-400 hover:text-black focus:bg-yellow-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:py-5 sm:text-2xl"
							>
								Continue
							</button>
							<button
								data-menu-button
								onclick={backToDashboard}
								class="border-2 border-black bg-white py-3 text-base font-black text-black uppercase transition-all hover:bg-black hover:text-white focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:py-5 sm:text-2xl"
							>
								Dashboard
							</button>
						</div>
						<button
							data-menu-button
							onclick={startGame}
							class="mt-2 w-full border-2 border-black bg-white py-2 text-sm font-black text-black uppercase transition-all hover:bg-black hover:text-white focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:py-3 sm:text-base"
						>
							New Game
						</button>
					{:else}
						<div class="grid grid-cols-2 gap-2 sm:gap-4">
							<button
								data-menu-button
								onclick={startGame}
								class="border-2 border-yellow-400 bg-black py-3 text-base font-black text-yellow-400 uppercase transition-all hover:bg-yellow-400 hover:text-black focus:bg-yellow-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:py-5 sm:text-2xl"
							>
								Burn Rubber
							</button>
							<button
								data-menu-button
								onclick={backToDashboard}
								class="border-2 border-black bg-white py-3 text-base font-black text-black uppercase transition-all hover:bg-black hover:text-white focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:py-5 sm:text-2xl"
							>
								Dashboard
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- IN-GAME HUD -->
	{#if gameScreen}
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
					class="absolute top-24 left-1/2 -translate-x-1/2 border-2 border-red-500 bg-black/80 px-8 py-2 text-xl font-bold text-red-400"
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
				<div class="absolute top-32 right-0 left-0 flex justify-center bg-transparent">
					<div class="border-4 border-yellow-400 bg-black/80 px-16 py-6">
						<div class="text-5xl font-black tracking-widest text-yellow-400">PAUSED</div>
						<div class="mt-2 text-center text-lg font-bold text-white/70">PRESS 'P' TO RESUME</div>
					</div>
				</div>
			{/if}
		</div>

		{#if showTouchControls}
			<div
				class="absolute inset-x-0 bottom-0 z-40 flex items-end justify-between gap-4 p-4 text-white sm:p-6"
			>
				<div class="pointer-events-auto w-[58%] max-w-sm">
					<div class="mb-2 text-xs font-black tracking-[0.35em] text-white/60">STEER</div>
					<div
						class="relative h-24 touch-none rounded-none border-4 border-white bg-black/70 px-4 py-3 select-none"
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
							'min-w-28 touch-none border-4 px-5 py-4 text-lg font-black text-white transition-all select-none',
							touchThrottle
								? 'scale-95 border-yellow-400 bg-yellow-400 text-black'
								: 'border-white bg-black/75'
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
							'min-w-28 touch-none border-4 px-5 py-4 text-lg font-black text-white transition-all select-none',
							touchBrake
								? 'scale-95 border-red-500 bg-red-500 text-black'
								: 'border-white bg-black/75'
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
	{#if endScreen}
		<div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95">
			<div
				class="mb-2 text-5xl font-black text-red-500 drop-shadow-[4px_4px_0_#000] sm:mb-6 sm:text-8xl"
			>
				CRASHED
			</div>

			<div class="mb-3 text-xl font-bold text-white sm:mb-8 sm:text-5xl">
				DAY {day} • {carsPassed} CARS
			</div>

			<div class="mb-6 text-3xl font-black text-yellow-400 sm:mb-12 sm:text-6xl">
				{score}
			</div>

			{#if score >= highScore && score > 0}
				<div class="mb-4 text-lg font-bold tracking-widest text-lime-400 sm:mb-8 sm:text-3xl">
					NEW HIGH SCORE
				</div>
			{/if}

			<div class="flex flex-col gap-2 sm:gap-4">
				<button
					data-menu-button
					onclick={restartGame}
					class="border-4 border-white bg-white px-8 py-3 text-xl font-black text-black shadow-[4px_4px_0_rgba(255,255,255,1)] transition-all hover:scale-110 hover:bg-yellow-300 hover:shadow-none focus:scale-110 focus:bg-yellow-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black sm:px-16 sm:py-6 sm:text-4xl"
				>
					RETRY
				</button>
				<button
					data-menu-button
					onclick={goToSplash}
					class="border-4 border-white px-8 py-3 text-xl font-black text-white shadow-[4px_4px_0_rgba(255,255,255,1)] transition-all hover:scale-110 hover:bg-white hover:text-black hover:shadow-none focus:scale-110 focus:bg-white focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black sm:px-16 sm:py-6 sm:text-4xl"
				>
					BACK TO SPLASH
				</button>
			</div>

			<div class="mt-6 text-xs text-white/50 sm:mt-12 sm:text-sm">
				ENTER / A TO SELECT • ESC / B TO RETURN
			</div>
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
