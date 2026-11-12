/**
 * Format duration in minutes to human-readable 'Xh Ym' string.
 * @param {number} minutes
 * @returns {string} e.g. '2h 28m'
 */
export const formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) return 'N/A';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

/**
 * Format ISO date string into readable calendar date.
 * @param {string|Date} dateStr
 * @returns {string} e.g. 'Jul 16, 2010'
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return 'TBA';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'TBA';
  }
};

/** Default cinema poster placeholder */
export const FALLBACK_POSTER =
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80';

