import { Agent } from 'undici';

export const noTimeoutFetch = (input: string | URL | globalThis.Request, init?: RequestInit) => {
  const someInit = init || {}

  return fetch(input, { ...someInit, dispatcher: new Agent({ headersTimeout: 2700000, bodyTimeout: 2700000, connectTimeout: 2700000 }) } as any)
}
