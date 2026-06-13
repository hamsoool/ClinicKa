export function formatOperationDetailsForDisplay(value?: string | null) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  const parsed = parseOperationDetails(rawValue);
  if (parsed.nature && parsed.date) return `${parsed.nature} last ${formatOperationDateForDisplay(parsed.date)}`;
  if (parsed.nature) return parsed.nature;

  return rawValue;
}

function formatOperationDateForDisplay(value: string) {
  const rawValue = value.trim();
  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return rawValue;

  const [, rawYear, rawMonth, rawDay] = isoMatch;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isValidDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day;

  if (!isValidDate) return rawValue;
  const monthName = date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  return `${monthName} ${String(day).padStart(2, '0')}, ${year}`;
}

function parseOperationDetails(value: string) {
  const parsed = {
    nature: '',
    date: '',
  };

  const directMatch = value.match(/^(.*?)\s+last\s+(.+)$/i);
  if (directMatch) {
    parsed.nature = directMatch[1].trim();
    parsed.date = directMatch[2].trim();
    return parsed;
  }

  const segments = value.split('|').map((segment) => segment.trim()).filter(Boolean);
  for (const segment of segments) {
    const [rawLabel = '', ...rest] = segment.split(':');
    const label = rawLabel.trim().toLowerCase();
    const text = rest.join(':').trim();
    if (!text) continue;

    if (label === 'procedure' || label === 'surgery' || label === 'operation' || label === 'nature') {
      parsed.nature = text;
    } else if (label === 'date' || label === 'operation date' || label === 'surgery date') {
      parsed.date = text;
    }
  }

  return parsed;
}
