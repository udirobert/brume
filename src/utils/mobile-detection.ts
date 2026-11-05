/**
 * Mobile detection utilities for enhanced mobile experience
 */

export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

export const isIOSDevice = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isAndroidDevice = (): boolean => {
  return /Android/.test(navigator.userAgent);
};

export const getViewportHeight = (): number => {
  // Use dynamic viewport height on mobile for better experience
  return window.visualViewport?.height || window.innerHeight;
};

export const getSafeAreaInsets = () => {
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0'),
    bottom: parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
    left: parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0'),
    right: parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0'),
  };
};

export const enableMobileOptimizations = () => {
  // Zoom stays enabled — WCAG 1.4.4: a page must never pin
  // maximum-scale/user-scalable=no, on touch devices or anywhere else.
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && isTouchDevice()) {
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, viewport-fit=cover'
    );
  }

  // Add touch-friendly classes to body
  if (isTouchDevice()) {
    document.body.classList.add('touch-device');
  }

  if (isIOSDevice()) {
    document.body.classList.add('ios-device');
  }

  if (isAndroidDevice()) {
    document.body.classList.add('android-device');
  }
};

export const disablePullToRefresh = () => {
  // Disable pull-to-refresh on mobile
  document.body.style.overscrollBehavior = 'none';
};

export const optimizeForMobile = () => {
  enableMobileOptimizations();
  disablePullToRefresh();
};