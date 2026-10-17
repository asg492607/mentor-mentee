// Firebase's browser SDK has been retired from authentication. These exports
// fail closed while data and realtime features are migrated to server APIs.
const removedClient = new Proxy({}, {
  get() {
    throw new Error('This feature is being migrated to the secure server API.');
  }
});

export const app = removedClient;
export const auth = removedClient;
export const db = removedClient;
export const storage = removedClient;
