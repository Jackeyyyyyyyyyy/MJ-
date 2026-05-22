type DateParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLocalParts(value?: string): DateParts | null {
  const date = parseDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

export function formatLocalDateTime(value?: string, pattern: 'short' | 'date-time' | 'date-time-seconds' | 'time-seconds' = 'date-time') {
  const parts = getLocalParts(value);
  if (!parts) return '';

  if (pattern === 'short') return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
  if (pattern === 'time-seconds') return `${parts.hour}:${parts.minute}:${parts.second}`;
  if (pattern === 'date-time-seconds') return `${parts.year}.${parts.month}.${parts.day} // ${parts.hour}:${parts.minute}:${parts.second}`;
  return `${parts.year}.${parts.month}.${parts.day} // ${parts.hour}:${parts.minute}`;
}

export function formatLocalDate(value?: string) {
  const parts = getLocalParts(value);
  return parts ? `${parts.month}/${parts.day}` : '';
}

export function formatLocalTime(value?: string) {
  const parts = getLocalParts(value);
  return parts ? `${parts.hour}:${parts.minute}` : '';
}

export function isLocalToday(value?: string) {
  const date = parseDate(value);
  if (!date) return false;

  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}
