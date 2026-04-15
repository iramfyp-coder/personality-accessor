import { useEffect, useRef, useState } from 'react';

const SECTION_SELECTOR = '[data-avatar-section]';
const DEFAULT_SCROLL_IDLE_MS = 400;

const readSections = () => {
  if (typeof document === 'undefined') {
    return [];
  }

  return Array.from(document.querySelectorAll(SECTION_SELECTOR)).map((element) => ({
    id: element.getAttribute('data-avatar-section') || '',
    label: element.getAttribute('data-avatar-label') || '',
    element,
  }));
};

const pickActiveSection = (sections = []) => {
  if (!sections.length) {
    return '';
  }

  const viewportMiddle = window.innerHeight * 0.42;
  let best = sections[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  sections.forEach((section) => {
    const rect = section.element.getBoundingClientRect();
    const sectionMiddle = rect.top + rect.height * 0.4;
    const distance = Math.abs(sectionMiddle - viewportMiddle);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = section;
    }
  });

  return best.id;
};

export const useAvatarScrollEngine = ({ enabled = true, onSectionChange }) => {
  const [activeSectionId, setActiveSectionId] = useState('');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollDirection, setScrollDirection] = useState('down');
  const [isScrolling, setIsScrolling] = useState(false);

  const lastYRef = useRef(0);
  const rafRef = useRef(0);
  const scrollIdleTimeoutRef = useRef(0);
  const pendingSectionRef = useRef('');

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return () => {};
    }

    const updateScrollMetrics = () => {
      const nextY = window.scrollY || 0;
      const maxScrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(100, Math.round((nextY / maxScrollable) * 100)));
      setScrollProgress(progress);

      setScrollDirection(nextY >= lastYRef.current ? 'down' : 'up');
      lastYRef.current = nextY;
    };

    const commitSection = (nextActiveSection, sections) => {
      if (!nextActiveSection) {
        return;
      }

      setActiveSectionId((current) => {
        if (current !== nextActiveSection) {
          onSectionChange?.(nextActiveSection, sections);
        }

        return nextActiveSection;
      });
    };

    const computeSection = () => {
      const sections = readSections();
      const nextActiveSection = pickActiveSection(sections) || '';
      pendingSectionRef.current = nextActiveSection;
      return { sections, nextActiveSection };
    };

    const computeImmediate = () => {
      updateScrollMetrics();
      const { sections, nextActiveSection } = computeSection();
      commitSection(nextActiveSection, sections);
    };

    const computeQueuedSection = () => {
      const { nextActiveSection } = computeSection();
      return nextActiveSection;
    };

    const scheduleSectionIdleCommit = () => {
      window.clearTimeout(scrollIdleTimeoutRef.current);
      scrollIdleTimeoutRef.current = window.setTimeout(() => {
        setIsScrolling(false);
        const sections = readSections();
        const nextActiveSection = pendingSectionRef.current || pickActiveSection(sections);
        commitSection(nextActiveSection, sections);
      }, DEFAULT_SCROLL_IDLE_MS);
    };

    const onScroll = () => {
      updateScrollMetrics();
      setIsScrolling(true);

      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = window.requestAnimationFrame(computeQueuedSection);

      scheduleSectionIdleCommit();
    };

    const requestComputeImmediate = () => {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = window.requestAnimationFrame(computeImmediate);
    };

    computeImmediate();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', requestComputeImmediate);

    const ObserverCtor = window.MutationObserver || window.WebKitMutationObserver;
    const mutationObserver = ObserverCtor ? new ObserverCtor(requestComputeImmediate) : null;
    mutationObserver?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-avatar-section'],
    });

    return () => {
      window.clearTimeout(scrollIdleTimeoutRef.current);
      window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', requestComputeImmediate);
      mutationObserver?.disconnect();
    };
  }, [enabled, onSectionChange]);

  return {
    activeSectionId,
    scrollProgress,
    scrollDirection,
    isScrolling,
  };
};
