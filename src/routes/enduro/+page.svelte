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
	let paused = $state(false);
	let isStarting = $state(false);
	let highScore = $state(0);
	let distance = $state(0);
	let weather = $state<'clear' | 'fog' | 'ice'>('clear');
	let isNight = $state(false);
	let iceFactor = $state(0);

	let container: HTMLDivElement;

	const cNormalEven = new THREE.Color(0x1a1a1a);
	const cNormalOdd = new THREE.Color(0x111111);
	const cIceEven = new THREE.Color(0xffffff);
	const cIceOdd = new THREE.Color(0xf0f0ff);
	const tempColor = new THREE.Color();
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let roadGroup: THREE.Group;
	let playerCar: THREE.Group;
	let enemyCars: { mesh: THREE.Group; z: number; x: number; passed: boolean }[] = [];
	let horizon: THREE.Mesh;

	const ROAD_WIDTH = 34;
	const CAR_SPEED = 0.85;
	const STEER_SPEED = 0.65;
	const MAX_X = ROAD_WIDTH / 2 - 4.5;

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
			antialias: false,
			alpha: false
		});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		container.appendChild(renderer.domElement);

		const skyGeo = new THREE.PlaneGeometry(800, 240);
		const skyMat = new THREE.MeshBasicMaterial({
			color: 0x557799
		});
		horizon = new THREE.Mesh(skyGeo, skyMat);
		horizon.rotation.x = -0.32;
		horizon.position.y = 75;
		horizon.position.z = -250;
		scene.add(horizon);

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

				// Darken markers when road is white
				if (child.children.length > 1) {
					const markerColor = 1 - iceFactor * 0.35;
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
		gain.gain.value = 0.08 + speed * 0.05;

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
		gain.gain.setValueAtTime(1.1, audioCtx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.1);

		noise.connect(filter);
		filter.connect(gain);
		gain.connect(audioCtx.destination);
		noise.start();
	}

	function animate() {
		requestAnimationFrame(animate);
		if (!renderer || !scene || !camera) return;

		if (gameStarted && !gameOver && !paused) {
			// Throttle and Brake
			if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) {
				speed = Math.min(maxSpeed, speed + 0.012);
			} else if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) {
				speed = Math.max(0, speed - 0.025);
			}

			distance += speed * 12;

			let steer = 0;
			if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) steer -= 1;
			if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) steer += 1;
			steer += gamepadSteer;

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
		gameStarted = false;
		gameOver = false;
		paused = false;
		isStarting = false;
		speed = 0;
		score = 0;
		carsPassed = 0;
		day = 1;
		distance = 0;
		playerX = 0;
		playerZOffset = 0;
		weather = 'clear';

		enemyCars.forEach((c) => scene?.remove(c.mesh));
		enemyCars = [];
	}

	onMount(() => {
		const saved = localStorage.getItem('enduro-high-score');
		if (saved) highScore = parseInt(saved, 10);

		initThree();

		const onKeyDown = (e: KeyboardEvent) => {
			keys.add(e.key);
			if (!gameStarted && (e.key === ' ' || e.key === 'Enter')) startGame();
			if (gameOver && (e.key === ' ' || e.key === 'Enter')) restartGame();
			if (gameStarted && !gameOver && (e.key === 'p' || e.key === 'P')) paused = !paused;
		};

		const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key);

		const pollGamepad = () => {
			const pads = navigator.getGamepads();
			for (const pad of pads) {
				if (pad?.axes?.[0] !== undefined) {
					gamepadSteer = pad.axes[0];
					if (Math.abs(gamepadSteer) < 0.18) gamepadSteer = 0;
				}
			}
		};

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		const gamepadLoop = setInterval(pollGamepad, 16);

		const handleResize = () => {
			if (!camera || !renderer) return;
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		};
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('resize', handleResize);
			clearInterval(gamepadLoop);
			if (renderer) {
				renderer.dispose();
			}
		};
	});
</script>

<div class="relative h-screen w-screen overflow-hidden bg-black font-mono" bind:this={container}>
	<!-- THREE.JS CANVAS is appended by renderer -->

	<!-- SPLASH -->
	{#if !gameStarted}
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
			</div>

			<button
				onclick={startGame}
				class="border-4 border-yellow-400 bg-black px-14 py-5 text-4xl font-black text-yellow-400 transition-all hover:bg-yellow-400 hover:text-black active:scale-95"
			>
				PRESS START
			</button>

			<div class="mt-16 text-sm text-white/60">
				← → STEER ONLY • ARROWS OR WASD<br />
				GAMEPAD STICK SUPPORTED
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

			{#if paused}
				<div class="absolute top-32 left-0 right-0 flex justify-center bg-transparent">
					<div class="rounded-xl border-4 border-yellow-400 bg-black/80 px-16 py-6">
						<div class="text-5xl font-black tracking-widest text-yellow-400">PAUSED</div>
						<div class="mt-2 text-center text-lg font-bold text-white/70">PRESS 'P' TO RESUME</div>
					</div>
				</div>
			{/if}
		</div>
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
					onclick={restartGame}
					class="border-4 border-white bg-white px-16 py-6 text-4xl font-black text-black hover:bg-yellow-300"
				>
					REVIVE
				</button>
				<button
					onclick={goToSplash}
					class="border-4 border-white px-16 py-6 text-4xl font-black text-white hover:bg-white hover:text-black"
				>
					SPLASH
				</button>
			</div>

			<div class="mt-12 text-sm text-white/50">PRESS SPACE TO RESTART</div>
		</div>
	{/if}

	<a
		href="/"
		class="absolute bottom-8 left-8 z-40 text-xl font-black text-white/70 hover:text-white"
	>
		← MENU
	</a>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
	}
</style>
