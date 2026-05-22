export function buttonLooksLikeStop(label = '') {
  const normalized = String(label || '').toLowerCase();
  return normalized.includes('stop')
    || normalized.includes('停止')
    || normalized.includes('cancel')
    || normalized.includes('取消');
}

export function submissionLooksSuccessful({ didSubmit = false, inputContainsPrompt = true, runningDetected = false } = {}) {
  return Boolean(didSubmit) || !inputContainsPrompt || runningDetected;
}
