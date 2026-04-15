import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import LoginPage from './pages/Auth/LoginPage';
import SignupPage from './pages/Auth/SignupPage';
import DashboardPage from './pages/Dashboard';
import AssessmentPage from './pages/Assessment';
import ResultPage from './pages/Result';
import StartAssessmentFlowPage from './pages/AssessmentFlow/StartPage';
import AdaptiveAssessmentTestPage from './pages/AssessmentFlow/TestPage';
import BehaviorAssessmentPage from './pages/AssessmentFlow/BehaviorPage';
import AssessmentFlowResultPage from './pages/AssessmentFlow/ResultPage';
import ProtectedRoute from './components/ui/ProtectedRoute';
import AnimatedBackground from './components/ui/AnimatedBackground';
import PageTransition from './components/motion/PageTransition';
import { useAuth } from './hooks/useAuth';
import AvatarController from './components/avatar/AvatarController';
import { AvatarEventProvider } from './components/avatar/AvatarEvents';

gsap.registerPlugin(ScrollTrigger);

const HomeRedirect = () => {
  const auth = useAuth();
  return <Navigate to={auth.isAuthenticated ? '/dashboard' : '/login'} replace />;
};

const AppRoutes = () => {
  const auth = useAuth();
  const location = useLocation();

  const withTransition = (element) => <PageTransition>{element}</PageTransition>;

  useEffect(() => {
    let isMounted = true;
    let cleanup = () => {};

    import('@barba/core')
      .then(({ default: barba }) => {
        if (!isMounted || window.__barbaInitDone) {
          return;
        }

        try {
          barba.init({
            preventRunning: true,
            sync: true,
            // React Router controls navigation; Barba transition modes are mirrored in PageTransition.
            prevent: () => true,
            transitions: [],
          });
          window.__barbaInitDone = true;

          cleanup = () => {
            try {
              barba.destroy();
            } catch (error) {
              // no-op
            }
            window.__barbaInitDone = false;
          };
        } catch (error) {
          // no-op
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('[data-scroll-reveal]'));
    const animations = [];

    nodes.forEach((node, index) => {
      animations.push(
        gsap.fromTo(
          node,
          { autoAlpha: 0, y: 26 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.56,
            ease: 'power3.out',
            delay: Math.min(index * 0.04, 0.2),
            scrollTrigger: {
              trigger: node,
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            },
          }
        )
      );
    });

    return () => {
      animations.forEach((animation) => {
        animation.scrollTrigger?.kill();
        animation.kill();
      });
    };
  }, [location.pathname]);

  return (
    <>
      <AnimatedBackground />
      <AvatarController />
      <div data-barba="wrapper">
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={`${location.pathname}${location.search}`}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={withTransition(<LoginPage />)} />
            <Route path="/signup" element={withTransition(<SignupPage />)} />

            <Route
              path="/dashboard"
              element={withTransition(
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/assessment"
              element={withTransition(
                <ProtectedRoute>
                  {/* Deprecated legacy questionnaire route retained for backward compatibility. */}
                  <AssessmentPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/assessment/start"
              element={withTransition(
                <ProtectedRoute>
                  <StartAssessmentFlowPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/assessment/test"
              element={withTransition(
                <ProtectedRoute>
                  <AdaptiveAssessmentTestPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/assessment/behavior"
              element={withTransition(
                <ProtectedRoute>
                  <BehaviorAssessmentPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/assessment/result"
              element={withTransition(
                <ProtectedRoute>
                  <AssessmentFlowResultPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/results"
              element={withTransition(
                <ProtectedRoute>
                  <Navigate to="/assessment/result" replace />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/reports"
              element={withTransition(
                <ProtectedRoute>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/result/:assessmentId"
              element={withTransition(
                <ProtectedRoute>
                  <ResultPage />
                </ProtectedRoute>
              )}
            />

            <Route
              path="*"
              element={<Navigate to={auth.isAuthenticated ? '/dashboard' : '/login'} replace />}
            />
          </Routes>
        </AnimatePresence>
      </div>
    </>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AvatarEventProvider>
        <AppRoutes />
      </AvatarEventProvider>
    </BrowserRouter>
  );
};

export default App;
