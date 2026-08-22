/**
 * Device and feature detection utilities.
 */

/** Returns true if the user is likely on a mobile/tablet device. */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(
    navigator.userAgent
  );
}

/** Returns true if the browser supports WebRTC DataChannels. */
export function supportsWebRTC(): boolean {
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof RTCSessionDescription !== 'undefined'
  );
}

/** Returns true if the browser supports getUserMedia (camera access). */
export function supportsCamera(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/** Returns true if Vibration API is available (most Android Chrome). */
export function supportsVibration(): boolean {
  return 'vibrate' in navigator;
}

/** Trigger a short vibration for haptic feedback on connection. */
export function vibrate(pattern: number | number[] = 100): void {
  if (supportsVibration()) {
    navigator.vibrate(pattern);
  }
}

/** Returns the current host origin, suitable for QR code URLs. */
export function getAppOrigin(): string {
  return window.location.origin;
}

/** Build the join URL for a session token. */
export function buildJoinUrl(token: string): string {
  return `${getAppOrigin()}/join/${token}`;
}

/** Check if we're running in a secure context (HTTPS or localhost). */
export function isSecureContext(): boolean {
  return window.isSecureContext ?? (location.protocol === 'https:' || location.hostname === 'localhost');
}
