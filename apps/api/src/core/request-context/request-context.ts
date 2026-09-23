import { AsyncLocalStorage } from 'node:async_hooks';

/** Per-request state shared with services without threading it through every call. */
export interface RequestStore {
  /** Set by the authentication guard when the request carries a valid login token. */
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestStore>();

export const requestContext = {
  run<T>(store: RequestStore, fn: () => T): T {
    return storage.run(store, fn);
  },
  store(): RequestStore | undefined {
    return storage.getStore();
  },
  /** The logged-in user of the current request, or undefined (anonymous / no request). */
  currentUserId(): string | undefined {
    return storage.getStore()?.userId;
  },
};
