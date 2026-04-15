import React, { useEffect, useRef } from 'react';
import { FiBriefcase, FiCheck, FiUser, FiUsers } from 'react-icons/fi';
import { gsap } from 'gsap';
import Button from '../../ui/Button';

const ICON_BY_ROLE = {
  student: FiUser,
  graduate: FiUsers,
  professional: FiBriefcase,
};

const StepRole = ({
  roleOptions = [],
  selectedRole = '',
  onSelectRole,
  onNext,
  isNextDisabled,
}) => {
  const cardRefs = useRef([]);

  useEffect(() => {
    const cards = cardRefs.current.filter(Boolean);
    if (!cards.length) {
      return () => {};
    }

    const timeline = gsap.timeline();
    timeline.fromTo(
      cards,
      { autoAlpha: 0, y: 18, scale: 0.98 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.38, stagger: 0.08, ease: 'power2.out' }
    );

    return () => timeline.kill();
  }, []);

  return (
    <section className="assessment-step" aria-labelledby="wizard-role-title">
      <header className="assessment-step__header">
        <p className="assessment-step__eyebrow">Step 1</p>
        <h2 id="wizard-role-title" className="assessment-step__title">
          Choose your profile type
        </h2>
        <p className="assessment-step__subtitle">
          This helps calibrate tone and difficulty for your assessment experience.
        </p>
      </header>

      <div className="wizard-role-grid" role="radiogroup" aria-label="Select role">
        {roleOptions.map((role, index) => {
          const RoleIcon = ICON_BY_ROLE[role.value] || FiUser;
          const isActive = selectedRole === role.value;

          return (
            <button
              key={role.value}
              type="button"
              className={`wizard-role-card ${isActive ? 'is-active' : ''}`}
              onClick={() => onSelectRole?.(role.value)}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              onMouseEnter={() => {
                const node = cardRefs.current[index];
                if (!node || isActive) {
                  return;
                }

                gsap.to(node, {
                  y: -5,
                  duration: 0.22,
                  ease: 'power2.out',
                });
              }}
              onMouseLeave={() => {
                const node = cardRefs.current[index];
                if (!node || isActive) {
                  return;
                }

                gsap.to(node, {
                  y: 0,
                  duration: 0.22,
                  ease: 'power2.out',
                });
              }}
            >
              <span className="wizard-role-card__icon" aria-hidden="true">
                <RoleIcon />
              </span>
              <div className="wizard-role-card__copy">
                <strong>{role.label}</strong>
                <span>{role.description}</span>
              </div>
              {isActive ? (
                <span className="wizard-role-card__check" aria-hidden="true">
                  <FiCheck />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <footer className="assessment-step__actions">
        <div />
        <Button
          onClick={onNext}
          disabled={isNextDisabled}
          data-avatar-action="wizard-next-role"
          data-avatar-target="start-assessment-cta"
          data-avatar-hint="Continue to CV analysis."
        >
          Next
        </Button>
      </footer>
    </section>
  );
};

export default StepRole;
