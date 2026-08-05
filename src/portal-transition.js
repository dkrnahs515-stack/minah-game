export function createPortalTransition(portal) {
  return {
    elapsed: 0,
    swapped: false,
    duration: 0.5,
    swapAt: 0.25,
    cooldownAfter: 1,
    destination: { ...portal.destination },
  };
}

export function advancePortalTransition(state, dt) {
  const elapsed = Math.min(state.duration, state.elapsed + dt);
  const shouldSwap = !state.swapped && elapsed >= state.swapAt;
  const nextState = {
    ...state,
    elapsed,
    swapped: state.swapped || shouldSwap,
  };
  return {
    state: nextState,
    shouldSwap,
    finished: elapsed >= state.duration,
  };
}
