import React, { useState } from 'react';

const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  onClick,
  className = '',
}) => {
  const [ripples, setRipples] = useState([]);

  const createRipple = (event) => {
    if (disabled || loading) {
      return;
    }

    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const diameter = Math.max(rect.width, rect.height) * 1.35;
    const radius = diameter / 2;
    const source = event.touches?.[0] || event;

    const nextRipple = {
      key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      x: source.clientX - rect.left - radius,
      y: source.clientY - rect.top - radius,
      size: diameter,
    };

    setRipples((current) => [...current, nextRipple].slice(-4));

    window.setTimeout(() => {
      setRipples((current) => current.filter((item) => item.key !== nextRipple.key));
    }, 680);
  };

  const classes = [
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    block ? 'ui-button--block' : '',
    loading ? 'is-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      onMouseDown={createRipple}
      onTouchStart={createRipple}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      <span className="ui-button__content">{loading ? 'Please wait...' : children}</span>
      <span className="ui-button__ripple-container" aria-hidden="true">
        {ripples.map((ripple) => (
          <span
            key={ripple.key}
            className="ui-button__ripple"
            style={{
              width: ripple.size,
              height: ripple.size,
              left: ripple.x,
              top: ripple.y,
            }}
          />
        ))}
      </span>
    </button>
  );
};

export default Button;
