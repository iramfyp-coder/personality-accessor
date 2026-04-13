const { EventEmitter } = require('events');

const progressEmitter = new EventEmitter();
progressEmitter.setMaxListeners(0);

const REPLAY_LIMIT_PER_SESSION = 400;
const replayBuffer = new Map();

const parseSequenceFromEventId = (eventId) => {
  const raw = String(eventId || '').trim();
  if (!raw) {
    return null;
  }

  const tail = raw.includes(':') ? raw.split(':').pop() : raw;
  const numeric = Number(tail);

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const buildEventPayload = (payload = {}) => ({
  eventId: String(payload.eventId || ''),
  stage: String(payload.stage || 'assessment'),
  status: String(payload.status || 'info'),
  message: String(payload.message || ''),
  meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : undefined,
  createdAt: payload.createdAt || new Date().toISOString(),
});

const rememberReplayEvent = ({ sessionId, event }) => {
  if (!sessionId || !event?.eventId) {
    return;
  }

  const list = replayBuffer.get(sessionId) || [];
  list.push(event);

  if (list.length > REPLAY_LIMIT_PER_SESSION) {
    list.splice(0, list.length - REPLAY_LIMIT_PER_SESSION);
  }

  replayBuffer.set(sessionId, list);
};

const emitProgress = ({ sessionId, event }) => {
  if (!sessionId) {
    return;
  }

  const payload = buildEventPayload(event);
  rememberReplayEvent({ sessionId, event: payload });

  progressEmitter.emit(`progress:${sessionId}`, payload);
};

const streamProgress = ({ req, res, sessionId, initialEvents = [] }) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const send = (eventName, payload) => {
    const normalized = buildEventPayload(payload);

    if (normalized.eventId) {
      res.write(`id: ${normalized.eventId}\n`);
    }

    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(normalized)}\n\n`);
  };

  const connectedEventId = `${sessionId}:connected:${Date.now()}`;
  send('connected', {
    eventId: connectedEventId,
    stage: 'connection',
    status: 'connected',
    message: 'Progress stream connected',
    meta: { sessionId },
    createdAt: new Date().toISOString(),
  });

  const lastEventIdHeader =
    req.get('last-event-id') || req.get('Last-Event-ID') || req.query?.lastEventId || '';

  const lastSeenSequence = parseSequenceFromEventId(lastEventIdHeader);

  const persistedEvents = (Array.isArray(initialEvents) ? initialEvents : []).map((event) =>
    buildEventPayload(event)
  );

  const bufferedEvents = replayBuffer.get(sessionId) || [];

  const allReplayCandidates = [...persistedEvents, ...bufferedEvents]
    .filter((event, index, list) => {
      const identity = event.eventId || `${event.createdAt}:${event.stage}:${event.message}`;
      const firstIndex = list.findIndex((candidate) => {
        const candidateIdentity =
          candidate.eventId || `${candidate.createdAt}:${candidate.stage}:${candidate.message}`;
        return candidateIdentity === identity;
      });
      return firstIndex === index;
    })
    .sort((a, b) => {
      const aSeq = parseSequenceFromEventId(a.eventId);
      const bSeq = parseSequenceFromEventId(b.eventId);

      if (aSeq == null && bSeq == null) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      if (aSeq == null) {
        return -1;
      }

      if (bSeq == null) {
        return 1;
      }

      return aSeq - bSeq;
    });

  const replayEvents = allReplayCandidates.filter((event) => {
    if (lastSeenSequence == null) {
      return true;
    }

    const sequence = parseSequenceFromEventId(event.eventId);
    if (sequence == null) {
      return false;
    }

    return sequence > lastSeenSequence;
  });

  replayEvents.forEach((event) => {
    send('progress', event);
  });

  const listener = (event) => {
    send('progress', buildEventPayload(event));
  };

  progressEmitter.on(`progress:${sessionId}`, listener);

  const heartbeat = setInterval(() => {
    send('heartbeat', {
      eventId: `${sessionId}:heartbeat:${Date.now()}`,
      stage: 'connection',
      status: 'heartbeat',
      message: 'alive',
      meta: { sessionId },
      createdAt: new Date().toISOString(),
    });
  }, 15000);

  const close = () => {
    clearInterval(heartbeat);
    progressEmitter.off(`progress:${sessionId}`, listener);
    res.end();
  };

  req.on('close', close);
  req.on('aborted', close);
};

module.exports = {
  emitProgress,
  streamProgress,
};
