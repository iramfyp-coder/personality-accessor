import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { gsap } from 'gsap';
import {
  FiBarChart2,
  FiBell,
  FiChevronDown,
  FiChevronRight,
  FiClipboard,
  FiClock,
  FiCpu,
  FiGrid,
  FiLogOut,
  FiMenu,
  FiSearch,
  FiSettings,
  FiUpload,
  FiUser,
  FiX,
  FiZap,
} from 'react-icons/fi';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import {
  useAssessmentHistoryQuery,
  useAssessmentReportQuery,
  useTraitTrendsQuery,
} from '../../hooks/useAssessment';
import { useActiveFlowSessionQuery } from '../../hooks/useAssessmentFlow';
import {
  hasResumableAssessmentDraft,
  readAssessmentDraft,
} from '../../utils/assessmentSessionStorage';
import { getPersonalityProfile } from '../../utils/personalityProfiles';
import { normalizeTraits, TRAIT_META, TRAIT_ORDER } from '../../utils/traits';
import TraitRadarChart from '../../components/charts/TraitRadarChart';
import TraitTrendsChart from '../../components/charts/TraitTrendsChart';
import TraitDistributionChart from '../../components/charts/TraitDistributionChart';
import InsightHeatmapChart from '../../components/charts/InsightHeatmapChart';

const SECTION_IDS = {
  dashboard: 'dashboard-overview',
  assessments: 'assessment-history',
  analytics: 'trait-analytics',
  reports: 'ai-reports',
  settings: 'advanced-stats',
};

const SIDEBAR_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: FiGrid },
  { key: 'assessments', label: 'Assessments', icon: FiClipboard },
  { key: 'analytics', label: 'Analytics', icon: FiBarChart2 },
  { key: 'reports', label: 'AI Reports', icon: FiCpu },
  { key: 'settings', label: 'Settings', icon: FiSettings },
];

const MOCK_NOTIFICATIONS = [
  {
    id: 'daily-digest',
    title: 'Daily digest ready',
    detail: 'Your trait momentum summary has been refreshed.',
    time: '2m ago',
  },
  {
    id: 'trend-delta',
    title: 'Trend alert',
    detail: 'Conscientiousness increased by 4% since the previous run.',
    time: '1h ago',
  },
  {
    id: 'ai-report',
    title: 'AI report available',
    detail: 'Open the latest report to review growth recommendations.',
    time: 'Today',
  },
];

const AVATAR_STORAGE_PREFIX = 'dashboard-avatar';

const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

const formatShortDate = (value) => {
  if (!value) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
};

const getInitials = (value = '') => {
  if (!value.trim()) {
    return 'U';
  }

  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
};

const averageTraitScore = (traits = {}) => {
  const normalized = normalizeTraits(traits);
  const total = TRAIT_ORDER.reduce((sum, traitKey) => sum + normalized[traitKey], 0);
  return Math.round(total / TRAIT_ORDER.length);
};

const toTraitAverage = (trendData = []) => {
  if (!trendData.length) {
    return normalizeTraits();
  }

  const totals = trendData.reduce(
    (accumulator, item) => {
      TRAIT_ORDER.forEach((traitKey) => {
        accumulator[traitKey] += Number(item.traits?.[traitKey] || 0);
      });
      return accumulator;
    },
    { O: 0, C: 0, E: 0, A: 0, N: 0 }
  );

  return TRAIT_ORDER.reduce((accumulator, traitKey) => {
    accumulator[traitKey] = Math.round(totals[traitKey] / trendData.length);
    return accumulator;
  }, {});
};

const useMediaQuery = (query) => {
  const getMatches = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia(query).matches;
  }, [query]);

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => {};
    }

    const mediaQueryList = window.matchMedia(query);

    const onChange = (event) => {
      setMatches(event.matches);
    };

    setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', onChange);

    return () => {
      mediaQueryList.removeEventListener('change', onChange);
    };
  }, [query, getMatches]);

  return matches;
};

const useTypewriter = (value, enabled) => {
  const [renderedValue, setRenderedValue] = useState(value || '');

  useEffect(() => {
    const nextValue = value || '';

    if (!enabled || !nextValue) {
      setRenderedValue(nextValue);
      return () => {};
    }

    let index = 0;
    setRenderedValue('');

    const timerId = window.setInterval(() => {
      index += 1;
      setRenderedValue(nextValue.slice(0, index));

      if (index >= nextValue.length) {
        window.clearInterval(timerId);
      }
    }, 14);

    return () => {
      window.clearInterval(timerId);
    };
  }, [value, enabled]);

  return renderedValue;
};

const DashboardTimelineItem = memo(
  ({ assessment, isExpanded, latestAssessmentId, onToggle, onCompare }) => {
    const personalityProfile = getPersonalityProfile(assessment.dominantTrait);
    const normalizedTraits = normalizeTraits(assessment.traits);
    const isComparable = Boolean(latestAssessmentId) && latestAssessmentId !== assessment.assessmentId;

    return (
      <article className={`intel-timeline__item ${isExpanded ? 'is-expanded' : ''}`}>
        <button
          type="button"
          className="intel-timeline__trigger"
          onClick={() => onToggle(assessment.assessmentId)}
        >
          <span className="intel-timeline__node" aria-hidden="true" />
          <div className="intel-timeline__summary">
            <p className="intel-timeline__date">{formatDate(assessment.createdAt)}</p>
            <h4>{personalityProfile.name}</h4>
            <p className="intel-timeline__meta">Dominant Trait: {assessment.dominantTrait}</p>
          </div>
          <FiChevronRight className="intel-timeline__chevron" aria-hidden="true" />
        </button>

        <div className="intel-timeline__details">
          <div className="intel-timeline__metrics">
            {TRAIT_ORDER.map((traitKey) => (
              <div
                className={`intel-trait-meter intel-trait-meter--${traitKey.toLowerCase()}`}
                key={`${assessment.assessmentId}-${traitKey}`}
              >
                <div className="intel-trait-meter__head">
                  <span>{TRAIT_META[traitKey].label}</span>
                  <strong>{normalizedTraits[traitKey]}%</strong>
                </div>
                <div className="intel-trait-meter__bar">
                  <span style={{ width: `${normalizedTraits[traitKey]}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="intel-timeline__actions">
            <Link className="history-item__link" to={`/result/${assessment.assessmentId}`}>
              View Report
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCompare(assessment.assessmentId)}
              disabled={!isComparable}
            >
              Compare
            </Button>
          </div>
        </div>
      </article>
    );
  }
);

DashboardTimelineItem.displayName = 'DashboardTimelineItem';

const AnimatedStatValue = ({ value }) => {
  const valueRef = useRef(null);

  useEffect(() => {
    if (!valueRef.current) {
      return;
    }

    const raw = String(value || '').trim();
    const match = raw.match(/^(-?\d+)(.*)$/);

    if (!match) {
      valueRef.current.textContent = raw;
      return;
    }

    const target = Number(match[1]);
    const suffix = String(match[2] || '');
    const state = { current: 0 };
    const animation = gsap.to(state, {
      current: target,
      duration: 0.9,
      ease: 'power2.out',
      onUpdate: () => {
        if (valueRef.current) {
          valueRef.current.textContent = `${Math.round(state.current)}${suffix}`;
        }
      },
    });

    return () => animation.kill();
  }, [value]);

  return <span ref={valueRef}>{String(value || '--')}</span>;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useMediaQuery('(max-width: 760px)');

  const historyQuery = useAssessmentHistoryQuery(auth.userId, Boolean(auth.userId));
  const activeFlowSessionQuery = useActiveFlowSessionQuery(Boolean(auth.userId));
  const trendsQuery = useTraitTrendsQuery(auth.userId, Boolean(auth.userId));

  const assessments = useMemo(() => historyQuery.data || [], [historyQuery.data]);
  const latestAssessment = assessments[0] || null;
  const previousAssessment = assessments[1] || null;
  const latestAssessmentId = latestAssessment?.assessmentId || '';

  const reportQuery = useAssessmentReportQuery(latestAssessmentId, Boolean(latestAssessmentId));

  const profile = getPersonalityProfile(latestAssessment?.dominantTrait);
  const trendData = useMemo(() => trendsQuery.data || [], [trendsQuery.data]);
  const latestTraits = useMemo(
    () => normalizeTraits(latestAssessment?.traits || {}),
    [latestAssessment?.traits]
  );

  const benchmarkTraits = useMemo(
    () => toTraitAverage(trendData.length ? trendData : [{ traits: latestTraits }]),
    [trendData, latestTraits]
  );

  const hasLocalResume = hasResumableAssessmentDraft(auth.userId);
  const localDraft = readAssessmentDraft(auth.userId);
  const hasServerResume = Boolean(activeFlowSessionQuery.data?.session?.sessionId);
  const hasResume = hasServerResume || hasLocalResume;

  const dominantTraitExplanation =
    reportQuery.data?.insightEngine?.dominantTraitExplanation ||
    `${profile.traitName} is currently your strongest behavioral signal in your latest assessment.`;

  const recommendationSnippet =
    reportQuery.data?.aiReport?.growthSuggestions?.[0] ||
    profile.recommendations?.[0] ||
    'Turn your strongest trait into a consistent weekly habit.';

  const aiSummary = reportQuery.data?.aiReport?.summary || profile.summary;
  const typedSummary = useTypewriter(aiSummary, !prefersReducedMotion && !reportQuery.isPending);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAssessmentId, setExpandedAssessmentId] = useState('');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarDraft, setAvatarDraft] = useState('');
  const [avatarError, setAvatarError] = useState('');

  const notificationRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    if (!assessments.length) {
      setExpandedAssessmentId('');
      return;
    }

    setExpandedAssessmentId((current) => {
      if (current && assessments.some((item) => item.assessmentId === current)) {
        return current;
      }

      return assessments[0].assessmentId;
    });
  }, [assessments]);

  useEffect(() => {
    if (!auth.userId) {
      setAvatarUrl('');
      return;
    }

    const savedAvatar = localStorage.getItem(`${AVATAR_STORAGE_PREFIX}:${auth.userId}`) || '';
    setAvatarUrl(savedAvatar);
  }, [auth.userId]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setIsNotificationOpen(false);
      }

      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const isSectionKeywordSearch = useMemo(
    () =>
      normalizedSearchQuery.length > 0 &&
      SIDEBAR_ITEMS.some((item) =>
        item.label.toLowerCase().includes(normalizedSearchQuery)
      ),
    [normalizedSearchQuery]
  );

  const filteredAssessments = useMemo(() => {
    if (!normalizedSearchQuery || isSectionKeywordSearch) {
      return assessments;
    }

    return assessments.filter((assessment) => {
      const profileLabel = getPersonalityProfile(assessment.dominantTrait).name;
      const content = [
        assessment.dominantTrait,
        profileLabel,
        formatShortDate(assessment.createdAt),
        formatDate(assessment.createdAt),
      ]
        .join(' ')
        .toLowerCase();

      return content.includes(normalizedSearchQuery);
    });
  }, [assessments, normalizedSearchQuery, isSectionKeywordSearch]);

  const advancedStats = useMemo(() => {
    if (!assessments.length) {
      return [
        { key: 'assessments', label: 'Assessments', value: '--', trend: 'No data yet' },
        { key: 'stability', label: 'Dominant Stability', value: '--', trend: 'No dominant pattern yet' },
        { key: 'momentum', label: 'Momentum', value: '--', trend: 'Need at least two assessments' },
        { key: 'facets', label: 'Facet Coverage', value: '--', trend: 'Heatmap unlocks after first report' },
      ];
    }

    const latestAverage = averageTraitScore(latestAssessment?.traits);
    const previousAverage = averageTraitScore(previousAssessment?.traits);
    const momentum = previousAssessment ? latestAverage - previousAverage : 0;

    const dominantMatches = assessments.filter(
      (item) => item.dominantTrait === latestAssessment?.dominantTrait
    ).length;

    const stability = Math.round((dominantMatches / assessments.length) * 100);

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const monthlyAssessments = assessments.filter(
      (item) => new Date(item.createdAt).getTime() >= thirtyDaysAgo
    ).length;

    const facetCount = Object.keys(reportQuery.data?.facetScores || {}).length;

    return [
      {
        key: 'assessments',
        label: 'Assessments',
        value: String(assessments.length),
        trend: `${monthlyAssessments} completed in last 30 days`,
      },
      {
        key: 'stability',
        label: 'Dominant Stability',
        value: `${stability}%`,
        trend: `${latestAssessment?.dominantTrait || '-'} remained dominant`,
      },
      {
        key: 'momentum',
        label: 'Momentum',
        value: previousAssessment
          ? `${momentum > 0 ? '+' : ''}${momentum} pts`
          : `${latestAverage} avg`,
        trend: previousAssessment
          ? 'Average trait score shift from previous assessment'
          : 'First benchmark captured',
      },
      {
        key: 'facets',
        label: 'Facet Coverage',
        value: facetCount ? `${facetCount} facets` : '--',
        trend: facetCount
          ? 'Facet-level heatmap intensity available'
          : 'Generate latest report to inspect facets',
      },
    ];
  }, [assessments, latestAssessment, previousAssessment, reportQuery.data?.facetScores]);

  const spotlightInsights = useMemo(() => {
    const strengths = reportQuery.data?.aiReport?.strengths || [];
    if (strengths.length) {
      return strengths.slice(0, 3);
    }

    return profile.recommendations.slice(0, 3);
  }, [profile.recommendations, reportQuery.data?.aiReport?.strengths]);

  const scrollToSection = useCallback((sectionId) => {
    const section = document.getElementById(sectionId);

    if (!section) {
      return;
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleNavSelection = useCallback(
    (key) => {
      setActiveNav(key);
      const targetSection = SECTION_IDS[key];

      if (targetSection) {
        scrollToSection(targetSection);
      }
    },
    [scrollToSection]
  );

  const handleLogout = useCallback(() => {
    auth.logout();
    navigate('/login');
  }, [auth, navigate]);

  const handleStart = useCallback(() => {
    navigate('/assessment/start');
  }, [navigate]);

  const handleResume = useCallback(() => {
    const activeSession = activeFlowSessionQuery.data?.session;
    const activeSessionId = String(activeSession?.sessionId || '').trim();
    const activeStage = String(activeSession?.stage || '').toLowerCase();

    if (activeSessionId) {
      if (activeStage === 'behavior') {
        navigate(`/assessment/behavior?session=${activeSessionId}`);
        return;
      }

      if (activeStage === 'result') {
        navigate(`/assessment/result?session=${activeSessionId}`);
        return;
      }

      if (activeStage === 'questionnaire') {
        navigate(`/assessment/test?session=${activeSessionId}`);
        return;
      }

      navigate('/assessment/start');
      return;
    }

    if (localDraft?.sessionId) {
      navigate(`/assessment?mode=resume&session=${localDraft.sessionId}`);
      return;
    }

    navigate('/assessment/start');
  }, [activeFlowSessionQuery.data?.session, localDraft?.sessionId, navigate]);

  const handleSearchSubmit = useCallback(
    (event) => {
      event.preventDefault();

      if (!normalizedSearchQuery) {
        return;
      }

      const matchedSection = SIDEBAR_ITEMS.find((item) =>
        item.label.toLowerCase().includes(normalizedSearchQuery)
      );

      if (matchedSection) {
        handleNavSelection(matchedSection.key);
        return;
      }

      if (filteredAssessments.length > 0) {
        handleNavSelection('assessments');
      }
    },
    [normalizedSearchQuery, filteredAssessments.length, handleNavSelection]
  );

  const handleCompareFromTimeline = useCallback(
    (compareAssessmentId) => {
      if (!compareAssessmentId) {
        return;
      }

      if (!latestAssessmentId || latestAssessmentId === compareAssessmentId) {
        navigate(`/result/${compareAssessmentId}`);
        return;
      }

      navigate(`/result/${latestAssessmentId}`, {
        state: {
          compareWith: compareAssessmentId,
          openComparison: true,
        },
      });
    },
    [latestAssessmentId, navigate]
  );

  const handleAvatarModalOpen = useCallback(() => {
    setAvatarDraft(avatarUrl);
    setAvatarError('');
    setIsAvatarModalOpen(true);
    setIsUserMenuOpen(false);
  }, [avatarUrl]);

  const handleAvatarModalClose = useCallback(() => {
    setIsAvatarModalOpen(false);
    setAvatarError('');
    setAvatarDraft(avatarUrl);
  }, [avatarUrl]);

  const handleAvatarFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please upload a valid image file.');
      return;
    }

    const maxFileSize = 4 * 1024 * 1024;
    if (file.size > maxFileSize) {
      setAvatarError('Image is too large. Please use a file under 4MB.');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarDraft(reader.result);
        setAvatarError('');
      }
    };

    reader.onerror = () => {
      setAvatarError('Unable to read this image. Please choose another file.');
    };

    reader.readAsDataURL(file);
  }, []);

  const handleAvatarSave = useCallback(() => {
    if (!auth.userId) {
      return;
    }

    const storageKey = `${AVATAR_STORAGE_PREFIX}:${auth.userId}`;

    if (avatarDraft) {
      localStorage.setItem(storageKey, avatarDraft);
      setAvatarUrl(avatarDraft);
    } else {
      localStorage.removeItem(storageKey);
      setAvatarUrl('');
    }

    setIsAvatarModalOpen(false);
    setAvatarError('');
  }, [auth.userId, avatarDraft]);

  const toggleAssessmentExpansion = useCallback((assessmentId) => {
    setExpandedAssessmentId((current) =>
      current === assessmentId ? '' : assessmentId
    );
  }, []);

  const contentVariants = useMemo(
    () =>
      prefersReducedMotion
        ? undefined
        : {
            hidden: { opacity: 1 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.08,
                delayChildren: 0.04,
              },
            },
          },
    [prefersReducedMotion]
  );

  const cardVariants = useMemo(
    () =>
      prefersReducedMotion
        ? undefined
        : {
            hidden: { opacity: 0, y: 14 },
            show: {
              opacity: 1,
              y: 0,
              transition: {
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
              },
            },
          },
    [prefersReducedMotion]
  );

  return (
    <main className="app-page intelligence-page" data-avatar-section="dashboard-main">
      <div className={`intelligence-shell ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
        <aside className="intel-sidebar" aria-label="Dashboard navigation">
          <div className="intel-sidebar__top">
            <div className="intel-brand">
              <span className="intel-brand__mark">AI</span>
              <div className="intel-brand__copy">
                <p>Personality Intelligence</p>
                <strong>Control Center</strong>
              </div>
            </div>

            <button
              type="button"
              className="intel-icon-button intel-icon-button--collapse"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <FiMenu />
            </button>
          </div>

          <nav className="intel-nav">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  className={`intel-nav__item ${isActive ? 'is-active' : ''}`}
                  onClick={() => handleNavSelection(item.key)}
                >
                  <Icon className="intel-nav__icon" />
                  <span className="intel-nav__label">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="intel-sidebar__footer">
            <button
              type="button"
              className="intel-sidebar__footer-button"
              onClick={handleStart}
              data-avatar-action="start-assessment"
              data-avatar-target="dashboard-primary-action"
              data-avatar-hint="Start a new adaptive assessment."
            >
              <FiZap />
              <span>Start Assessment</span>
            </button>
          </div>
        </aside>

        <section className="intel-main">
          <header className="intel-header">
            <form className="intel-search" onSubmit={handleSearchSubmit}>
              <FiSearch className="intel-search__icon" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search modules, traits, or assessment history"
                aria-label="Global dashboard search"
              />
            </form>

            <div className="intel-header__actions">
              <Button
                className="intel-header__cta"
                variant="secondary"
                onClick={handleStart}
                data-avatar-action="start-assessment"
                data-avatar-target="dashboard-primary-action"
                data-avatar-hint="Start Assessment opens a new adaptive session."
              >
                Start Assessment
              </Button>

              <div className="intel-popover-wrap" ref={notificationRef}>
                <button
                  type="button"
                  className="intel-icon-button"
                  aria-label="Notifications"
                  onClick={() => setIsNotificationOpen((current) => !current)}
                >
                  <FiBell />
                  <span className="intel-badge-dot">3</span>
                </button>

                {isNotificationOpen && (
                  <div className="intel-popover" role="dialog" aria-label="Notifications panel">
                    <p className="intel-popover__title">Notifications</p>
                    <div className="intel-notification-list">
                      {MOCK_NOTIFICATIONS.map((item) => (
                        <article key={item.id} className="intel-notification-item">
                          <h4>{item.title}</h4>
                          <p>{item.detail}</p>
                          <span>{item.time}</span>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="intel-popover-wrap" ref={userMenuRef}>
                <button
                  type="button"
                  className="intel-user-trigger"
                  aria-label="Profile menu"
                  onClick={() => setIsUserMenuOpen((current) => !current)}
                >
                  <span className="intel-avatar intel-avatar--small" aria-hidden="true">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="User avatar" />
                    ) : (
                      getInitials(auth.name || auth.email)
                    )}
                  </span>

                  <span className="intel-user-trigger__meta">
                    <strong>{auth.name || 'User'}</strong>
                    <small>{auth.email || 'No email'}</small>
                  </span>

                  <FiChevronDown className="intel-user-trigger__caret" />
                </button>

                {isUserMenuOpen && (
                  <div className="intel-popover intel-popover--menu" role="menu">
                    <button type="button" onClick={handleAvatarModalOpen}>
                      <FiUpload />
                      Upload profile image
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleStart();
                      }}
                      data-avatar-action="start-assessment"
                      data-avatar-target="dashboard-primary-action"
                      data-avatar-hint="Start Assessment begins your guided flow."
                    >
                      <FiZap />
                      Start assessment
                    </button>
                    <button type="button" onClick={handleLogout}>
                      <FiLogOut />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <motion.div
            className="intel-content-grid"
            variants={contentVariants}
            initial={prefersReducedMotion ? false : 'hidden'}
            animate={prefersReducedMotion ? false : 'show'}
          >
            <motion.div
              id="dashboard-overview"
              className="intel-grid__profile"
              variants={cardVariants}
              data-avatar-section="dashboard-overview"
              data-avatar-target="dashboard-profile"
            >
              <Card
                title="Profile Identity"
                subtitle="Authenticated user + personality identity layer"
                animated={false}
              >
                {historyQuery.isPending ? (
                  <div className="skeleton-stack">
                    <Skeleton height="88px" />
                    <Skeleton count={2} />
                    <Skeleton width="45%" />
                  </div>
                ) : (
                  <>
                    <div className="intel-profile">
                      <button
                        type="button"
                        className="intel-avatar intel-avatar--large"
                        onClick={handleAvatarModalOpen}
                        aria-label="Upload profile image"
                      >
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Profile" />
                        ) : (
                          getInitials(auth.name || auth.email)
                        )}
                      </button>

                      <div className="intel-profile__meta">
                        <h3>{auth.name || 'User'}</h3>
                        <p>{auth.email || 'No email available'}</p>

                        <div className="intel-profile__badges">
                          <span className="intel-pill intel-pill--personality">
                            {profile.name} · {latestAssessment?.dominantTrait || 'N/A'}
                          </span>
                          <span className="intel-pill">
                            <FiClock />
                            Last Assessment: {formatShortDate(latestAssessment?.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="intel-profile__hint">
                      Click the avatar to upload a profile image. The image is saved locally for this user profile.
                    </p>
                  </>
                )}
              </Card>
            </motion.div>

            <motion.div
              id="ai-reports"
              className="intel-grid__ai"
              variants={cardVariants}
              data-avatar-section="dashboard-reports"
            >
              <Card
                title="AI Insight Card"
                subtitle="Summary, dominant trait signal, and recommendation"
                className="intel-ai-card"
                animated={false}
              >
                {!latestAssessment && !historyQuery.isPending ? (
                  <p className="empty-state">
                    Complete your first assessment to unlock AI insight summaries.
                  </p>
                ) : reportQuery.isPending ? (
                  <div className="skeleton-stack">
                    <Skeleton width="50%" />
                    <Skeleton count={3} />
                    <Skeleton height="64px" />
                  </div>
                ) : (
                  <>
                    <p className="intel-ai-card__summary">{typedSummary}</p>

                    <article className="intel-ai-card__block">
                      <h4>Dominant Trait Explanation</h4>
                      <p>{dominantTraitExplanation}</p>
                    </article>

                    <article className="intel-ai-card__block">
                      <h4>Quick Recommendation</h4>
                      <p>{recommendationSnippet}</p>
                    </article>

                    {latestAssessmentId && (
                      <Link className="history-item__link" to={`/result/${latestAssessmentId}`}>
                        Open Full AI Report
                      </Link>
                    )}
                  </>
                )}
              </Card>
            </motion.div>

            <motion.div
              id="trait-analytics"
              className="intel-grid__analytics"
              variants={cardVariants}
              data-avatar-section="trait-analytics"
              data-avatar-target="dashboard-analytics"
            >
              <Card
                title="Trait Analytics"
                subtitle="Radar overview, progression trend, normalized comparison, and facet heatmap"
                animated={false}
              >
                {!latestAssessment && !historyQuery.isPending ? (
                  <p className="empty-state">
                    No assessment data available yet. Start an assessment to populate analytics.
                  </p>
                ) : (
                  <div className="intel-analytics-grid">
                    <article className="intel-chart-card">
                      <header>
                        <h4>Radar Chart</h4>
                        <p>OCEAN dominance snapshot</p>
                      </header>

                      <TraitRadarChart traits={latestTraits} compact={isMobile} height={280} />
                    </article>

                    <article className="intel-chart-card">
                      <header>
                        <h4>Trend Line</h4>
                        <p>Multi-assessment progression</p>
                      </header>

                      {trendsQuery.isPending ? (
                        <Skeleton height="280px" />
                      ) : trendsQuery.isError ? (
                        <p className="ui-message ui-message--error">{trendsQuery.error.message}</p>
                      ) : trendData.length === 0 ? (
                        <p className="empty-state">Trend data appears after your first completed run.</p>
                      ) : (
                        <TraitTrendsChart trends={trendData} compact={isMobile} height={280} />
                      )}
                    </article>

                    <article className="intel-chart-card">
                      <header>
                        <h4>Distribution Bars</h4>
                        <p>Latest vs normalized baseline</p>
                      </header>

                      <TraitDistributionChart
                        traits={latestTraits}
                        benchmarkTraits={benchmarkTraits}
                        compact={isMobile}
                        height={280}
                      />
                    </article>

                    <article className="intel-chart-card">
                      <header>
                        <h4>Insight Heatmap</h4>
                        <p>Facet-level intensity map</p>
                      </header>

                      {reportQuery.isPending ? (
                        <Skeleton height="280px" />
                      ) : reportQuery.isError ? (
                        <p className="ui-message ui-message--error">{reportQuery.error.message}</p>
                      ) : (
                        <InsightHeatmapChart
                          facetScores={reportQuery.data?.facetScores || {}}
                          compact={isMobile}
                        />
                      )}
                    </article>
                  </div>
                )}
              </Card>
            </motion.div>

            <motion.div
              id="assessment-history"
              className="intel-grid__history"
              variants={cardVariants}
              data-avatar-section="assessment-history"
              data-avatar-target="dashboard-history"
            >
              <Card
                title="Assessment Timeline"
                subtitle="Expandable history with compare actions"
                animated={false}
              >
                {historyQuery.isPending ? (
                  <div className="skeleton-stack">
                    <Skeleton height="72px" count={4} />
                  </div>
                ) : historyQuery.isError ? (
                  <p className="ui-message ui-message--error">{historyQuery.error.message}</p>
                ) : assessments.length === 0 ? (
                  <p className="empty-state">
                    No assessments yet. Start a new assessment to build your timeline.
                  </p>
                ) : filteredAssessments.length === 0 ? (
                  <p className="empty-state">
                    No timeline entries match “{searchQuery}”. Try another search term.
                  </p>
                ) : (
                  <div className="intel-timeline" role="list">
                    {filteredAssessments.map((assessment) => (
                      <DashboardTimelineItem
                        key={assessment.assessmentId}
                        assessment={assessment}
                        latestAssessmentId={latestAssessmentId}
                        isExpanded={expandedAssessmentId === assessment.assessmentId}
                        onToggle={toggleAssessmentExpansion}
                        onCompare={handleCompareFromTimeline}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>

            <motion.div className="intel-grid__insights" variants={cardVariants}>
              <Card
                title="Insights Widgets"
                subtitle="Session status and actionable highlights"
                animated={false}
              >
                <section className="intel-widget">
                  <h4>Session Continuity</h4>
                  {activeFlowSessionQuery.isPending ? (
                    <Skeleton height="54px" />
                  ) : hasResume ? (
                    <>
                      {hasServerResume ? (
                        <p className="ui-message ui-message--neutral">
                          Active adaptive session found. Stage:{' '}
                          {activeFlowSessionQuery.data?.session?.stage || 'questionnaire'} | Progress:{' '}
                          {activeFlowSessionQuery.data?.session?.currentQuestionIndex || 0} answers.
                        </p>
                      ) : (
                        <p className="ui-message ui-message--neutral">
                          Local draft found. Last saved: {formatDate(localDraft?.lastUpdatedAt)}
                        </p>
                      )}
                      <Button
                        size="sm"
                        onClick={handleResume}
                        data-avatar-action="resume-assessment"
                        data-avatar-target="dashboard-history"
                        data-avatar-hint="Resume continues your latest saved assessment."
                      >
                        Resume Assessment
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="empty-state">No unfinished session detected.</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleStart}
                        data-avatar-action="start-assessment"
                        data-avatar-target="dashboard-primary-action"
                        data-avatar-hint="Start your first session from here."
                      >
                        Start New Session
                      </Button>
                    </>
                  )}
                </section>

                <section className="intel-widget">
                  <h4>Dominant Trait Snapshot</h4>
                  {latestAssessment ? (
                    <>
                      <p>
                        <strong>{profile.traitName}</strong> is currently dominant with an average
                        trait intensity of <strong>{averageTraitScore(latestAssessment.traits)}%</strong>.
                      </p>
                      <div className="intel-trait-chip-list">
                        {TRAIT_ORDER.map((traitKey) => (
                          <span
                            key={`chip-${traitKey}`}
                            className={`intel-trait-chip intel-trait-chip--${traitKey.toLowerCase()}`}
                          >
                            {traitKey}: {latestTraits[traitKey]}%
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="empty-state">Trait snapshot appears after your first assessment.</p>
                  )}
                </section>

                <section className="intel-widget">
                  <h4>Immediate Focus</h4>
                  <ul className="intel-insight-list">
                    {spotlightInsights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </Card>
            </motion.div>

            <motion.div id="advanced-stats" className="intel-grid__stats" variants={cardVariants}>
              <Card
                title="Advanced Statistics"
                subtitle="Performance telemetry across your personality data"
                animated={false}
              >
                {historyQuery.isPending ? (
                  <Skeleton height="92px" count={4} />
                ) : (
                  <div className="intel-stats-grid">
                    {advancedStats.map((stat) => (
                      <article key={stat.key} className="intel-stat-card" title={stat.trend}>
                        <p className="intel-stat-card__label">{stat.label}</p>
                        <h3>
                          <AnimatedStatValue value={stat.value} />
                        </h3>
                        <p className="intel-stat-card__trend">{stat.trend}</p>
                      </article>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          </motion.div>
        </section>

        <nav className="intel-bottom-nav" aria-label="Mobile dashboard navigation">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activeNav;

            return (
              <button
                key={`mobile-${item.key}`}
                type="button"
                className={`intel-bottom-nav__item ${isActive ? 'is-active' : ''}`}
                onClick={() => handleNavSelection(item.key)}
              >
                <Icon />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {isAvatarModalOpen && (
        <div className="intel-modal-backdrop" role="presentation" onClick={handleAvatarModalClose}>
          <div
            className="intel-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Upload profile image"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="intel-modal__header">
              <h3>Upload Profile Image</h3>
              <button
                type="button"
                className="intel-icon-button"
                onClick={handleAvatarModalClose}
                aria-label="Close upload dialog"
              >
                <FiX />
              </button>
            </header>

            <div className="intel-modal__body">
              <div className="intel-avatar-preview">
                <span className="intel-avatar intel-avatar--preview" aria-hidden="true">
                  {avatarDraft ? (
                    <img src={avatarDraft} alt="Avatar preview" />
                  ) : (
                    <FiUser />
                  )}
                </span>
              </div>

              <label className="intel-upload-control">
                <FiUpload />
                Choose Image
                <input type="file" accept="image/*" onChange={handleAvatarFileChange} />
              </label>

              <button
                type="button"
                className="intel-upload-control intel-upload-control--ghost"
                onClick={() => {
                  setAvatarDraft('');
                  setAvatarError('');
                }}
              >
                Remove Image
              </button>

              {avatarError && <p className="ui-message ui-message--error">{avatarError}</p>}
            </div>

            <footer className="intel-modal__actions">
              <Button variant="ghost" onClick={handleAvatarModalClose}>
                Cancel
              </Button>
              <Button onClick={handleAvatarSave}>Save Photo</Button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
};

export default Dashboard;
