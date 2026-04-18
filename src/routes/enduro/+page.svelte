<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	// --- Game State (Svelte 5) ---
	let score = $state(0);
	let distance = $state(0);
	let speed = $state(1); // 3D units per frame
	let playerX = $state(0);
	let gameOver = $state(false);
	let weather = $state<'clear' | 'snow' | 'fog' | 'night'>('clear');
	let isAiThinking = $state(false);
	let gameStarted = $state(false);
	let gamepadStartWasPressed = $state(false);
	let lives = $state(3);
	let highScore = $state(0);
	let crashCooldown = $state(false);
	let crashFlash = $state(false);

	// --- Three.js Variables ---
	let container: HTMLDivElement;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let road: THREE.Mesh;
	let player: THREE.Group;
	let cars: { mesh: THREE.Group; overtaken: boolean }[] = [];
	let snowParticles: THREE.Points;

	const ROAD_WIDTH = 20;
	const ROAD_LENGTH = 1000;
	const GAMEPAD_DEADZONE = 0.2;
	const GAMEPAD_MOVE_SPEED = 0.15;

	function createCarMesh(color: number) {
		const group = new THREE.Group();
		// Body
		const body = new THREE.Mesh(
			new THREE.BoxGeometry(2, 1, 4),
			new THREE.MeshPhongMaterial({ color, flatShading: true })
		);
		body.position.y = 0.5;
		group.add(body);
		// Cabin
		const cabin = new THREE.Mesh(
			new THREE.BoxGeometry(1.5, 0.8, 2),
			new THREE.MeshPhongMaterial({ color: 0x333333 })
		);
		cabin.position.y = 1.4;
		cabin.position.z = -0.5;
		group.add(cabin);
		return group;
	}

	function spawnEnemyCar() {
		if (gameOver) return;
		const car = createCarMesh(Math.random() * 0xffffff);
		car.position.x = (Math.random() - 0.5) * (ROAD_WIDTH - 4);
		car.position.z = -200;
		scene.add(car);
		cars.push({ mesh: car, overtaken: false });

		setTimeout(spawnEnemyCar, Math.max(200, 1000 - distance / 10));
	}

	function initThree() {
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x4ade80); // Green-400
		scene.fog = new THREE.Fog(0x4ade80, 50, 200);

		camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		camera.position.set(0, 5, 10);
		camera.lookAt(0, 0, -20);

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(window.innerWidth, window.innerHeight);
		container.appendChild(renderer.domElement);

		// Lights
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
		scene.add(ambientLight);
		const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
		sunLight.position.set(10, 20, 10);
		scene.add(sunLight);

		// Road
		const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
		const roadMat = new THREE.MeshPhongMaterial({ color: 0x334155 });
		road = new THREE.Mesh(roadGeo, roadMat);
		road.rotation.x = -Math.PI / 2;
		road.position.z = -ROAD_LENGTH / 4;
		scene.add(road);

		// Road Lines
		const lineGeo = new THREE.PlaneGeometry(0.5, ROAD_LENGTH);
		const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
		const line = new THREE.Mesh(lineGeo, lineMat);
		line.rotation.x = -Math.PI / 2;
		line.position.y = 0.01;
		line.position.z = -ROAD_LENGTH / 4;
		scene.add(line);

		// Player
		player = createCarMesh(0xff0000); // Red player
		scene.add(player);

		// Snow
		const snowGeo = new THREE.BufferGeometry();
		const snowCount = 2000;
		const snowPos = new Float32Array(snowCount * 3);
		for (let i = 0; i < snowCount * 3; i++) snowPos[i] = (Math.random() - 0.5) * 200;
		snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
		snowParticles = new THREE.Points(
			snowGeo,
			new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 })
		);
		snowParticles.visible = false;
		scene.add(snowParticles);

		animate();
		spawnEnemyCar();
	}

	function animate() {
		requestAnimationFrame(animate);

		// Gamepad input
		const gamepads = navigator.getGamepads();
		for (let gi = 0; gi < gamepads.length; gi++) {
			const gp = gamepads[gi];
			if (!gp) continue;

			// A button to start/restart
			if (gp.buttons[0]?.pressed && !gamepadStartWasPressed) {
				if (!gameStarted) {
					gameStarted = true;
				} else if (gameOver) {
					restartGame();
				}
				gamepadStartWasPressed = true;
			}
			if (!gp.buttons[0]?.pressed) {
				gamepadStartWasPressed = false;
			}

			if (!gameStarted || gameOver) continue;

			// Left stick horizontal
			const axisX = gp.axes[0];
			if (Math.abs(axisX) > GAMEPAD_DEADZONE) {
				playerX = Math.max(
					-ROAD_WIDTH / 2 + 2,
					Math.min(ROAD_WIDTH / 2 - 2, playerX + axisX * GAMEPAD_MOVE_SPEED)
				);
			}

			// D-pad horizontal (buttons 14=left, 15=right)
			if (gp.buttons[14]?.pressed) {
				playerX = Math.max(-ROAD_WIDTH / 2 + 2, playerX - GAMEPAD_MOVE_SPEED);
			}
			if (gp.buttons[15]?.pressed) {
				playerX = Math.min(ROAD_WIDTH / 2 - 2, playerX + GAMEPAD_MOVE_SPEED);
			}
		}

		if (gameOver) return;
		if (!gameStarted) return;

		// Update Distance & Speed
		distance += speed;
		speed = 1 + distance / 5000;

		// Move Road (Illusion of movement)
		if (road.material instanceof THREE.MeshPhongMaterial) {
			road.material.color.setHSL((distance % 1000) / 1000, 0.5, 0.5); // Psycho color road!
		}

		// Player Control
		player.position.x = THREE.MathUtils.lerp(player.position.x, playerX, 0.1);
		camera.position.x = player.position.x * 0.5;
		camera.lookAt(player.position.x, 0, -20);

		// Enemy Cars
		for (let i = cars.length - 1; i >= 0; i--) {
			const car = cars[i];
			car.mesh.position.z += speed * 0.5; // Enemies move slower than player's perspective

			// Collision
			if (!crashCooldown && car.mesh.position.z > -2 && car.mesh.position.z < 2) {
				if (Math.abs(car.mesh.position.x - player.position.x) < 3) {
					handleCrash();
				}
			}

			// Overtake Score
			if (car.mesh.position.z > 5 && !car.overtaken) {
				score++;
				car.overtaken = true;
			}

			// Cleanup
			if (car.mesh.position.z > 20) {
				scene.remove(car.mesh);
				cars.splice(i, 1);
			}
		}

		// Weather Logic
		const weatherCycle = Math.floor(distance / 2000) % 4;
		const weathers: ('clear' | 'snow' | 'fog' | 'night')[] = ['clear', 'snow', 'fog', 'night'];
		weather = weathers[weatherCycle];

		const fog = scene.fog as THREE.Fog;

		if (weather === 'snow') {
			snowParticles.visible = true;
			snowParticles.position.z += 1;
			if (snowParticles.position.z > 100) snowParticles.position.z = 0;
			scene.background = new THREE.Color(0xffffff);
			if (fog) {
				fog.color.set(0xffffff);
				fog.far = 200;
			}
		} else if (weather === 'fog') {
			snowParticles.visible = false;
			scene.background = new THREE.Color(0xcccccc);
			if (fog) {
				fog.color.set(0xcccccc);
				fog.far = 50;
			}
		} else if (weather === 'night') {
			snowParticles.visible = false;
			scene.background = new THREE.Color(0x000000);
			if (fog) {
				fog.color.set(0x000000);
				fog.far = 100;
			}
		} else {
			snowParticles.visible = false;
			scene.background = new THREE.Color(0x4ade80);
			if (fog) {
				fog.color.set(0x4ade80);
				fog.far = 200;
			}
		}

		renderer.render(scene, camera);
	}

	function endGame() {
		if (score > highScore) {
			highScore = score;
			localStorage.setItem('enduro-high-score', String(highScore));
		}
		gameOver = true;
	}

	function handleCrash() {
		if (crashCooldown) return;

		lives--;
		crashFlash = true;
		setTimeout(() => { crashFlash = false; }, 300);

		if (lives <= 0) {
			endGame();
			return;
		}

		crashCooldown = true;
		setTimeout(() => { crashCooldown = false; }, 1500);

		// Remove the car that caused the crash
		for (let i = cars.length - 1; i >= 0; i--) {
			const car = cars[i];
			if (car.mesh.position.z > -2 && car.mesh.position.z < 2) {
				if (Math.abs(car.mesh.position.x - player.position.x) < 3) {
					scene.remove(car.mesh);
					cars.splice(i, 1);
					break;
				}
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!gameStarted) {
			if (e.key === ' ' || e.key === 'Enter') {
				e.preventDefault();
				gameStarted = true;
			}
			return;
		}
		if (gameOver) {
			if (e.key === ' ' || e.key === 'Enter') {
				e.preventDefault();
				restartGame();
			}
			return;
		}
		if (e.key === 'ArrowLeft') playerX = Math.max(-ROAD_WIDTH / 2 + 2, playerX - 4);
		if (e.key === 'ArrowRight') playerX = Math.min(ROAD_WIDTH / 2 - 2, playerX + 4);
	}

	let showChaosModal = $state(false);
	function triggerChaos() {
		showChaosModal = true;
		speed *= 5; // MASSIVE SPEED UP
		camera.fov = 120; // WIDE ANGLE CHAOS
		camera.updateProjectionMatrix();
	}

	function startGame() {
		gameStarted = true;
	}

	function restartGame() {
		score = 0;
		distance = 0;
		speed = 1;
		playerX = 0;
		gameOver = false;
		lives = 3;
		weather = 'clear';
		showChaosModal = false;
		crashCooldown = false;
		crashFlash = false;
		camera.fov = 75;
		camera.updateProjectionMatrix();

		// Remove all existing cars from scene
		for (const car of cars) {
			scene.remove(car.mesh);
		}
		cars = [];

		// Restart animation loop and enemy car spawning
		requestAnimationFrame(animate);
		spawnEnemyCar();
	}

	onMount(() => {
		const saved = localStorage.getItem('enduro-high-score');
		if (saved) {
			highScore = parseInt(saved, 10);
		}

		initThree();
		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('gamepadconnected', () => {});
		window.addEventListener('gamepaddisconnected', () => {});

		const gamepadPoll = setInterval(() => {
			if (gameStarted || gameOver) return;
			const gamepads = navigator.getGamepads();
			for (let gi = 0; gi < gamepads.length; gi++) {
				const gp = gamepads[gi];
				if (!gp) continue;
				if (gp.buttons[0]?.pressed && !gamepadStartWasPressed) {
					gameStarted = true;
					gamepadStartWasPressed = true;
					return;
				}
				if (!gp.buttons[0]?.pressed) {
					gamepadStartWasPressed = false;
				}
			}
		}, 100);

		const handleResize = () => {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		};
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('gamepadconnected', () => {});
			window.removeEventListener('gamepaddisconnected', () => {});
			clearInterval(gamepadPoll);
			renderer.dispose();
		};
	});
</script>

<div class="relative h-screen w-screen overflow-hidden font-mono" bind:this={container}>
	<!-- Splash Screen -->
	{#if !gameStarted}
		<div
			class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
		>
			<div class="mb-12 flex gap-8">
				<div class="animate-bounce text-6xl" style="animation-delay: 0ms;">🏎️</div>
				<div class="animate-bounce text-6xl" style="animation-delay: 150ms;">🏁</div>
				<div class="animate-bounce text-6xl" style="animation-delay: 300ms;">💨</div>
			</div>
			<h1
				class="mb-4 text-7xl font-black tracking-tighter text-yellow-300 uppercase italic drop-shadow-[6px_6px_0_rgba(0,0,0,1)]"
			>
				ENDURO 3D CHAOS
			</h1>
			<p class="mb-8 text-2xl font-bold text-pink-400 italic">Dodge cars. Survive the chaos.</p>
			<div
				class="mb-12 flex gap-6 border-4 border-white bg-black/50 p-4 text-lg font-bold text-white"
			>
				<span>← → to move</span>
				<span>🎮 Stick / D-pad to steer</span>
			</div>
			{#if highScore > 0}
				<p class="mb-4 text-xl font-bold text-yellow-400">HIGH SCORE: {highScore}</p>
			{/if}
			<button
				onclick={startGame}
				class="animate-pulse border-8 border-yellow-300 bg-yellow-300 px-16 py-6 text-4xl font-black text-black uppercase shadow-[12px_12px_0_rgba(255,255,255,0.3)] transition-transform hover:scale-110"
			>
				PRESS SPACE or A to START
			</button>
		</div>
	{/if}

	<!-- UI Overlay -->
	<div class="pointer-events-none absolute inset-0 z-20 flex flex-col items-center p-8">
		<h1
			class="text-6xl font-black text-yellow-300 uppercase italic drop-shadow-[6px_6px_0_rgba(0,0,0,1)]"
		>
			ENDURO 3D CHAOS
		</h1>

		<div
			class="mt-4 flex gap-6 border-4 border-white bg-black p-4 text-2xl font-black text-white shadow-[8px_8px_0_rgba(0,0,0,1)]"
		>
			<span>SCORE: {score}</span>
			<span class="text-yellow-400">HI: {highScore}</span>
			<span>DIST: {Math.floor(distance)}m</span>
			<span class="text-red-500">SPEED: {Math.floor(speed * 100)}%</span>
			<span class="text-green-400">{'🚗'.repeat(lives)}</span>
		</div>

		{#if weather !== 'clear'}
			<div
				class="mt-10 animate-pulse border-8 border-black bg-white p-4 text-4xl font-black text-black uppercase"
			>
				⚠️ {weather.toUpperCase()} WARNING ⚠️
			</div>
		{/if}
	</div>

	<!-- Crash Flash Overlay -->
	{#if crashFlash}
		<div class="pointer-events-none absolute inset-0 z-40 bg-red-500/40"></div>
	{/if}

	<!-- Mobile Controls -->
	<div class="absolute right-0 bottom-10 left-0 z-30 flex justify-center gap-20 px-10">
		<button
			onmousedown={() => (playerX = Math.max(-ROAD_WIDTH / 2 + 2, playerX - 5))}
			class="h-24 w-24 border-8 border-black bg-white text-5xl shadow-[10px_10px_0_rgba(0,0,0,1)] transition-all active:translate-x-2 active:translate-y-2 active:shadow-none"
		>
			⬅️
		</button>
		<button
			onmousedown={() => (playerX = Math.min(ROAD_WIDTH / 2 - 2, playerX + 5))}
			class="h-24 w-24 border-8 border-black bg-white text-5xl shadow-[10px_10px_0_rgba(0,0,0,1)] transition-all active:translate-x-2 active:translate-y-2 active:shadow-none"
		>
			➡️
		</button>
	</div>

	<!-- Reset / Game Over -->
	{#if gameOver}
		<div
			class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-8 text-center"
		>
			<h2
				class="mb-4 animate-bounce text-9xl font-black text-red-600 uppercase drop-shadow-[8px_8px_0_white]"
			>
				CRASHED! 💀
			</h2>
			<p class="mb-4 text-4xl font-bold text-white uppercase italic">
				You died with a score of {score}.
			</p>
			{#if score >= highScore && score > 0}
				<p class="mb-8 text-2xl font-bold text-yellow-400 animate-pulse">
					NEW HIGH SCORE!
				</p>
			{:else}
				<p class="mb-8 text-xl font-bold text-yellow-400">
					HIGH SCORE: {highScore}
				</p>
			{/if}
			<button
				onclick={restartGame}
				class="border-8 border-white bg-red-600 px-16 py-8 text-6xl font-black text-white uppercase shadow-[15px_15px_0_rgba(255,255,255,1)] transition-transform hover:scale-110"
			>
				REVIVE! ⚡
			</button>
			<p class="mt-6 animate-pulse text-xl font-bold text-yellow-300">
				Press A or SPACE to restart
			</p>
		</div>
	{/if}

	<a
		href="/"
		class="absolute bottom-8 left-8 z-30 text-2xl font-black text-white underline decoration-8 hover:text-yellow-300"
	>
		← ABANDON SHIP
	</a>

	<!-- Forbidden Button -->
	<button
		onclick={triggerChaos}
		class="absolute right-8 bottom-8 z-30 border-8 border-black bg-pink-500 p-8 text-xl font-black text-white uppercase shadow-[10px_10px_0_rgba(0,0,0,1)] transition-transform hover:scale-110 hover:rotate-12"
	>
		Don't Click Me 🚫
	</button>

	<!-- Chaos Modal -->
	{#if showChaosModal}
		<div
			class="fixed inset-0 z-[100] flex items-center justify-center bg-red-600/50 backdrop-blur-2xl"
		>
			<div class="absolute inset-0 animate-ping bg-yellow-400 opacity-20"></div>
			<div
				class="relative w-full max-w-2xl border-[12px] border-black bg-white p-12 text-center shadow-[20px_20px_0_rgba(0,0,0,1)]"
			>
				<div class="mb-6 animate-spin text-9xl">🌀</div>
				<h2 class="mb-6 text-6xl font-black tracking-tighter text-black uppercase">
					DIMENSIONAL RIFT!
				</h2>
				<p class="mb-12 text-3xl leading-tight font-bold text-black italic">
					"YOUR SPEED IS NOW CALCULATED IN PURE ADRENALINE! GOOD LUCK SURVIVING THIS!"
				</p>
				<button
					onclick={() => (showChaosModal = false)}
					class="w-full border-8 border-black bg-black px-10 py-6 text-4xl font-black text-white uppercase transition-colors hover:bg-pink-500"
				>
					HELP ME! 😱
				</button>
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
