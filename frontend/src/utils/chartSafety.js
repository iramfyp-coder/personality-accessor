export const sanitizeChartValue = (value) => {
  let numeric = Number(value);

  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) {
    numeric = 0;
  }

  return Math.max(0, Math.min(100, numeric));
};

export const sanitizeScaleScore = (value, min = 1, max = 5, fallback = 3) => {
  let numeric = Number(value);
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) {
    numeric = fallback;
  }

  return Math.max(min, Math.min(max, numeric));
};

export const sanitizeSignedValue = (value, min = -100, max = 100) => {
  let numeric = Number(value);
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) {
    numeric = 0;
  }

  return Math.max(min, Math.min(max, numeric));
};

