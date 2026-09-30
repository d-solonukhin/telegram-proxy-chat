import { handleNetlifyEvent } from '../../server/greenProxy.mjs';

export async function handler(event) {
  return handleNetlifyEvent(event);
}
