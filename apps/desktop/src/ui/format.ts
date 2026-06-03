export function formatTeamName(value: string): string {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace('University', '')
    .trim();
}

export function formatTeamShort(value: string): string {
  return formatTeamName(value).split(' ').slice(0, 2).join(' ');
}
