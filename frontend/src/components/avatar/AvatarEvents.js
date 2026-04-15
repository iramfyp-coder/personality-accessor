import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export const AVATAR_EVENTS = {
  PAGE_CHANGE: 'page_change',
  BUTTON_HOVER: 'button_hover',
  BUTTON_CLICK: 'button_click',
  ANSWER_SELECTED: 'answer_selected',
  ANSWER_CHANGED: 'answer_changed',
  SCROLL_SECTION: 'scroll_section',
  AI_LOADING: 'ai_loading',
  RESULTS_LOADED: 'results_loaded',
  CHAT_MESSAGE: 'chat_message',
  CHAT_RESPONSE: 'chat_response',
  ASSESSMENT_COMPLETE: 'assessment_complete',
  INPUT_TYPING: 'input_typing',
  EMPTY_STATE: 'empty_state',
  ERROR_STATE: 'error_state',
};

const AvatarEventsContext = createContext(null);

const getStore = (store, eventType) => {
  if (!store.has(eventType)) {
    store.set(eventType, new Set());
  }

  return store.get(eventType);
};

export const AvatarEventProvider = ({ children }) => {
  const listenersRef = useRef(new Map());
  const [lastEvent, setLastEvent] = useState(null);

  const emit = useCallback((eventType, payload = {}) => {
    if (!eventType) {
      return;
    }

    const event = {
      id: `${eventType}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: eventType,
      payload,
      timestamp: Date.now(),
    };

    const directListeners = listenersRef.current.get(eventType);
    const wildcardListeners = listenersRef.current.get('*');

    if (directListeners) {
      directListeners.forEach((listener) => {
        listener(event);
      });
    }

    if (wildcardListeners) {
      wildcardListeners.forEach((listener) => {
        listener(event);
      });
    }

    setLastEvent(event);
  }, []);

  const subscribe = useCallback((eventType, listener) => {
    if (!eventType || typeof listener !== 'function') {
      return () => {};
    }

    const listeners = getStore(listenersRef.current, eventType);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        listenersRef.current.delete(eventType);
      }
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      emit,
      subscribe,
      lastEvent,
    }),
    [emit, subscribe, lastEvent]
  );

  return <AvatarEventsContext.Provider value={contextValue}>{children}</AvatarEventsContext.Provider>;
};

export const useAvatarEvents = () => {
  const context = useContext(AvatarEventsContext);

  if (!context) {
    return {
      emit: () => {},
      subscribe: () => () => {},
      lastEvent: null,
    };
  }

  return context;
};

export const useAvatarEventEmitter = () => {
  const { emit } = useAvatarEvents();
  return emit;
};
