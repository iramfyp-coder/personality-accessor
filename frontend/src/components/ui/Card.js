import React from 'react';
import SlideUp from '../motion/SlideUp';

const Card = ({
  title,
  subtitle,
  action,
  children,
  className = '',
  animated = true,
  animationDelay = 0,
}) => {
  const cardClassName = `ui-card ${className}`.trim();

  const content = (
    <>
      {(title || subtitle || action) && (
        <header className="ui-card__header">
          <div>
            {title && <h3 className="ui-card__title">{title}</h3>}
            {subtitle && <p className="ui-card__subtitle">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </header>
      )}
      <div className="ui-card__body">{children}</div>
    </>
  );

  if (!animated) {
    return <section className={cardClassName}>{content}</section>;
  }

  return (
    <SlideUp as="section" className={cardClassName} delay={animationDelay}>
      {content}
    </SlideUp>
  );
};

export default Card;
