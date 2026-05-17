export type CabinetScreen = 'splash' | 'game' | 'end';
export type CabinetReturnTarget = 'dashboard' | 'splash-preserve-run' | 'splash-reset-run';

export type CabinetFlow = {
	splashScreen: boolean;
	gameScreen: boolean;
	endScreen: boolean;
	menuScreen: boolean;
	returnTarget: CabinetReturnTarget;
};

type BooleanCabinetFlowInput = {
	gameStarted: boolean;
	ended: boolean;
	transitionActive?: boolean;
};

type CabinetReturnHandlers = {
	toDashboard: () => void;
	toSplash: (preserveRun: boolean) => void;
};

function createCabinetFlow(
	splashScreen: boolean,
	gameScreen: boolean,
	endScreen: boolean,
	returnTarget: CabinetReturnTarget
): CabinetFlow {
	return {
		splashScreen,
		gameScreen,
		endScreen,
		menuScreen: splashScreen || endScreen,
		returnTarget
	};
}

export function getCabinetFlow(screen: CabinetScreen): CabinetFlow {
	return createCabinetFlow(
		screen === 'splash',
		screen === 'game',
		screen === 'end',
		screen === 'game' ? 'splash-preserve-run' : screen === 'end' ? 'splash-reset-run' : 'dashboard'
	);
}

export function getBooleanCabinetFlow({
	gameStarted,
	ended,
	transitionActive = false
}: BooleanCabinetFlowInput): CabinetFlow {
	const returnTarget = ended
		? 'splash-reset-run'
		: gameStarted
			? 'splash-preserve-run'
			: 'dashboard';

	return createCabinetFlow(
		!gameStarted && !ended && !transitionActive,
		gameStarted && !ended && !transitionActive,
		ended && !transitionActive,
		returnTarget
	);
}

export function returnFromCabinet(
	flow: Pick<CabinetFlow, 'returnTarget'>,
	handlers: CabinetReturnHandlers
) {
	if (flow.returnTarget === 'dashboard') {
		handlers.toDashboard();
		return;
	}

	handlers.toSplash(flow.returnTarget === 'splash-preserve-run');
}
