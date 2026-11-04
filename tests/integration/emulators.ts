import { randomUUID } from 'node:crypto';

// Talks to the Firebase emulators over their REST APIs, the same way the web SDK does.
const PROJECT = 'demo-casepilot';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FUNCTIONS = `http://127.0.0.1:5001/${PROJECT}/asia-south1`;
const FIRESTORE = `http://127.0.0.1:8180/v1/projects/${PROJECT}/databases/(default)/documents`;

export type TestUser = { uid: string; email: string; password: string; token: string };

async function post(url: string, body: unknown, bearer?: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(110_000),
  });
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, any> };
}

export async function createUser(label: string, { verified = true } = {}): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@example.test`;
  const password = randomUUID();
  const { body } = await post(`${AUTH}/accounts:signUp?key=demo`, {
    email,
    password,
    displayName: label,
    returnSecureToken: true,
  });
  const user = { uid: body.localId as string, email, password, token: body.idToken as string };
  if (verified) await verifyEmail(user);
  return user;
}

/** Marks the email verified (emulator admin call) and refreshes the user's ID token. */
export async function verifyEmail(user: TestUser): Promise<void> {
  await post(`${AUTH}/projects/${PROJECT}/accounts:update`, { localId: user.uid, emailVerified: true }, 'owner');
  const { body } = await post(`${AUTH}/accounts:signInWithPassword?key=demo`, {
    email: user.email,
    password: user.password,
    returnSecureToken: true,
  });
  user.token = body.idToken as string;
}

export type CallResult = { result?: any; error?: { status: string; message: string } };

/** Calls a callable function using the callable HTTP protocol. */
export async function call(name: string, data: unknown, user?: TestUser): Promise<CallResult> {
  const { body } = await post(`${FUNCTIONS}/${name}`, { data }, user?.token);
  return body as CallResult;
}

/** Reads a Firestore document as `user`, so Security Rules apply. Returns the HTTP status. */
export async function readStatus(path: string, user: TestUser): Promise<number> {
  const response = await fetch(`${FIRESTORE}/${path}`, {
    headers: { authorization: `Bearer ${user.token}` },
  });
  return response.status;
}

/** Reads a Firestore document as `user` and returns its fields as plain values. */
export async function readDoc(path: string, user: TestUser): Promise<Record<string, unknown>> {
  const response = await fetch(`${FIRESTORE}/${path}`, {
    headers: { authorization: `Bearer ${user.token}` },
  });
  const body = (await response.json()) as { fields?: Record<string, any> };
  return Object.fromEntries(Object.entries(body.fields ?? {}).map(([k, v]) => [k, plain(v)]));
}

function plain(value: Record<string, any>): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(plain);
  if ('mapValue' in value) {
    return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([k, v]) => [k, plain(v as any)]));
  }
  return value;
}

/** Starts each function's worker before the tests, retrying while the emulator spins it up. */
export async function warmUp(names: string[]): Promise<void> {
  for (const name of names) {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await call(name, {});
        // Any structured reply means the worker is up.
        if (response.error?.status || response.result) break;
      } catch {
        // Worker still starting.
      }
      if (attempt >= 6) throw new Error(`Function ${name} did not start`);
    }
  }
}

const STORAGE = 'http://127.0.0.1:9199/v0/b/demo-casepilot.appspot.com/o';

/** Uploads like the web SDK does, so Storage rules apply. Returns the HTTP status. */
export async function uploadObject(
  path: string,
  bytes: Uint8Array,
  contentType: string,
  user: TestUser,
): Promise<number> {
  const response = await fetch(`${STORAGE}?uploadType=media&name=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { authorization: `Firebase ${user.token}`, 'content-type': contentType },
    body: bytes,
  });
  return response.status;
}

/** Downloads an object as `user`. Returns the HTTP status. */
export async function downloadStatus(path: string, user: TestUser): Promise<number> {
  const response = await fetch(`${STORAGE}/${encodeURIComponent(path)}?alt=media`, {
    headers: { authorization: `Firebase ${user.token}` },
  });
  return response.status;
}

/** Polls a Firestore document until `done` accepts it. */
export async function waitForDoc(
  path: string,
  user: TestUser,
  done: (doc: Record<string, unknown>) => boolean,
  timeoutMs = 240_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const doc = await readDoc(path, user);
    if (done(doc)) return doc;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${path}: ${JSON.stringify(doc)}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

/** Checks an object with the emulator's admin bypass (Security Rules skipped). Returns the HTTP status. */
export async function adminObjectStatus(path: string): Promise<number> {
  const response = await fetch(`${STORAGE}/${encodeURIComponent(path)}`, {
    headers: { authorization: 'Bearer owner' },
  });
  return response.status;
}
