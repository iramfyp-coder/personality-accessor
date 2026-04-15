import { useEffect, useRef } from 'react';
import { AVATAR_EVENTS } from './AvatarEvents';

const ACTION_SELECTOR = '[data-avatar-action], button, a, [role="button"]';

const toPayload = (element, override = {}) => ({
  targetElement: element,
  targetKey: element?.getAttribute?.('data-avatar-target') || element?.dataset?.avatarTarget || '',
  action: element?.getAttribute?.('data-avatar-action') || element?.dataset?.avatarAction || '',
  hint: element?.getAttribute?.('data-avatar-hint') || element?.dataset?.avatarHint || '',
  label:
    element?.getAttribute?.('aria-label') ||
    element?.textContent?.trim()?.slice(0, 80) ||
    element?.id ||
    '',
  ...override,
});

const shouldIgnoreNode = (element) => {
  if (!element) {
    return true;
  }

  const ariaHidden = element.getAttribute('aria-hidden');
  return ariaHidden === 'true' || element.closest('[data-avatar-ignore="true"]');
};

export const useAvatarUIBridge = ({ emit, enabled = true }) => {
  const lastHoverKeyRef = useRef('');
  const typingDebounceRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') {
      return () => {};
    }

    const onPointerOver = (event) => {
      const target = event.target?.closest?.(ACTION_SELECTOR);
      if (!target || shouldIgnoreNode(target)) {
        return;
      }

      const key = `${target.getAttribute('data-avatar-action') || ''}:${target.textContent || ''}`;
      if (key === lastHoverKeyRef.current) {
        return;
      }

      lastHoverKeyRef.current = key;
      emit(AVATAR_EVENTS.BUTTON_HOVER, toPayload(target));
    };

    const onClick = (event) => {
      const target = event.target?.closest?.(ACTION_SELECTOR);
      if (!target || shouldIgnoreNode(target)) {
        return;
      }

      emit(AVATAR_EVENTS.BUTTON_CLICK, toPayload(target));
    };

    const onInput = (event) => {
      const target = event.target;
      if (!target || shouldIgnoreNode(target)) {
        return;
      }

      const isInputLike =
        target.matches?.('input, textarea, [contenteditable="true"]') ||
        target.closest?.('input, textarea, [contenteditable="true"]');

      if (!isInputLike) {
        return;
      }

      window.clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = window.setTimeout(() => {
        emit(AVATAR_EVENTS.INPUT_TYPING, toPayload(target));
      }, 90);
    };

    document.addEventListener('pointerover', onPointerOver, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInput, true);

    return () => {
      window.clearTimeout(typingDebounceRef.current);
      document.removeEventListener('pointerover', onPointerOver, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('input', onInput, true);
    };
  }, [emit, enabled]);
};
