const SECRET_PATTERNS = [
  [/\b(sk-[A-Za-z0-9_-]{12,})\b/g, '[REDACTED_API_KEY]'],
  [/\b(gh[pousr]_[A-Za-z0-9]{20,})\b/g, '[REDACTED_GITHUB_TOKEN]'],
  [/\b(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, '$1[REDACTED_TOKEN]'],
  [/((?:password|passwd|secret|api[_-]?key|token)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]'],
  [/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/g, '$1[REDACTED]@']
];

export function redact(value) {
  let text = String(value ?? '');
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  for (const home of [process.env.USERPROFILE, process.env.HOME].filter(Boolean)) {
    text = text.replaceAll(home, '~');
    text = text.replaceAll(home.replaceAll('\\', '/'), '~');
  }
  return text;
}
