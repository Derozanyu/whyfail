import { parseUser } from './parser.mjs';

export function loadUser(payload) {
  return parseUser(payload);
}
