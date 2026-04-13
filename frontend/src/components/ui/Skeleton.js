import React from 'react';

const Skeleton = ({
  width = '100%',
  height = '1rem',
  count = 1,
  className = '',
  style,
}) => {
  const lines = Array.from({ length: Math.max(1, count) });

  return (
    <div className={`ui-skeleton-stack ${className}`.trim()}>
      {lines.map((_, index) => (
        <span
          key={index}
          className="ui-skeleton"
          style={{
            width,
            height,
            ...style,
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
};

export default Skeleton;
