export function withWaitOptions(body, options = {}) {
  const {
    wait,
    waitMs,
    terminalDefaultMs,
    ackDefaultMs,
    defaultWait = false,
  } = options;

  const shouldWait = wait === undefined ? Boolean(defaultWait) : Boolean(wait);

  if (shouldWait) {
    return {
      ...body,
      wait: true,
      waitMs: waitMs ?? terminalDefaultMs,
    };
  }

  return {
    ...body,
    wait: false,
    waitAckMs: waitMs ?? ackDefaultMs,
  };
}
