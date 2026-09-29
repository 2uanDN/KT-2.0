export class LinkMetaService {
  parseDomain(url: string): string {
    try {
      let formatted = url.trim();
      if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
        formatted = 'https://' + formatted;
      }
      const parsed = new URL(formatted);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    try {
      let formatted = url.trim();
      if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
        formatted = 'https://' + formatted;
      }
      const u = new URL(formatted);
      return Boolean(u.hostname && u.hostname.includes('.'));
    } catch {
      return false;
    }
  }

  normalizeUrl(url: string): string {
    let formatted = url.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'https://' + formatted;
    }
    return formatted;
  }
}

export const linkMetaService = new LinkMetaService();

