/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Strips all Vietnamese diacritical marks and converts 'đ'/'Đ' to 'd'/'D'.
 * Supports both NFC and NFD strings.
 *
 * Examples:
 * - "Kiến trúc Blueprint" -> "Kien truc Blueprint"
 * - "Khởi đầu & Hộp chờ" -> "Khoi dau & Hop cho"
 * - "Dữ liệu tri thức" -> "Du lieu tri thuc"
 */
export function removeVietnameseAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove combining diacritical marks
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFC');
}

/**
 * Normalizes title for case-folding, whitespace variation, and accent folding.
 * Used for fast, accent-insensitive search and title comparisons.
 *
 * Examples:
 * - "Kiến trúc Blueprint" -> "kien truc blueprint"
 * - "  Chào   mừng   bạn  " -> "chao mung ban"
 */
export function normalizeTitle(title: string): string {
  if (!title || typeof title !== 'string') return '';
  return removeVietnameseAccents(title.toLowerCase().trim().replace(/\s+/g, ' '));
}

/**
 * Tokenizes text for Vietnamese search indexing and querying in MiniSearch.
 * Uses Unicode property escapes (\p{L} for letters in any language, \p{N} for digits).
 * For words containing Vietnamese diacritics, it emits BOTH the accented token
 * (for exact/high-precision matching) AND the unaccented folded token
 * (for accent-insensitive matching).
 *
 * Example:
 * "Kiến trúc PWA #2026"
 * -> ['kiến', 'kien', 'trúc', 'truc', 'pwa', '2026']
 */
export function tokenizeVietnamese(text: string): string[] {
  if (!text) return [];

  // Normalize to NFC first to handle various Unicode input sources consistently
  const normalized = text.normalize('NFC');

  // Split on all non-letter and non-number characters (Unicode aware)
  const rawWords = normalized.split(/[^\p{L}\p{N}]+/gu);
  const tokenSet = new Set<string>();

  for (const raw of rawWords) {
    if (!raw) continue;
    const lower = raw.toLowerCase();
    tokenSet.add(lower);

    const unaccented = removeVietnameseAccents(lower);
    if (unaccented !== lower) {
      tokenSet.add(unaccented);
    }
  }

  return Array.from(tokenSet);
}

/**
 * Cleans and bounds Markdown text before indexing into MiniSearch:
 * 1. Strips base64 data URIs (preventing token explosions & huge memory spikes)
 * 2. Strips markdown images ![alt](url)
 * 3. Strips HTML tags and code block backtick fences
 * 4. Collapses whitespace
 * 5. Bounds length to maxLength characters to protect RAM on mobile devices
 */
export function cleanMarkdownForSearch(markdown: string, maxLength = 3000): string {
  if (!markdown) return '';

  return markdown
    // 1. Remove base64 data URIs (e.g. data:image/png;base64,...)
    .replace(/data:[^)\s]+base64,[A-Za-z0-9+/=]+/gi, ' ')
    // 2. Remove markdown images: ![alt](url)
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    // 3. Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // 4. Remove code block fences and inline code backticks
    .replace(/```[a-z0-9_-]*/gi, ' ')
    .replace(/`([^`]+)`/g, '$1')
    // 5. Collapse multiple spaces and newlines
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
