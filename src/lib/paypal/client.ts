// Small PayPal REST client. Every PayPal call goes through paypalRequest, so auth,
// idempotency and error handling live in one place.

type CachedToken = { value: string; expiresAt: number };

// Refresh the token a minute before PayPal says it expires, so a request
// never goes out with a token that dies mid-flight.
const EXPIRY_BUFFER_MS = 60_000;

let cachedToken: CachedToken | null = null;
let pendingToken: Promise<string> | null = null;

export class PayPalError extends Error {
  status: number;
  debugId?: string;
  details?: unknown;

  constructor(status: number, message: string, debugId?: string, details?: unknown) {
    super(message);
    this.name = "PayPalError";
    this.status = status;
    this.debugId = debugId;
    this.details = details;
  }
}

// Read env vars when a request is made, not when the file is imported,
// so the Next.js build doesn't fail on environments without them.
function getConfig() {
  const baseUrl = process.env.PAYPAL_API_BASE;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_API_BASE, PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET");
  }
  return { baseUrl, clientId, clientSecret };
}

// Turn a failed response into a PayPalError that keeps PayPal's debug ID,
// which PayPal support asks for when something goes wrong.
async function toPayPalError(res: Response): Promise<PayPalError> {
  const text = await res.text();
  let body: {
    name?: string;
    message?: string;
    error_description?: string;
    debug_id?: string;
    details?: unknown;
  } = {};

  try {
    body = JSON.parse(text);
  } catch {
    // Body wasn't JSON; fall back to the raw text below.
  }

  const message = body.message ?? body.error_description ?? (text || res.statusText);
  const debugId = body.debug_id ?? res.headers.get("paypal-debug-id") ?? undefined;
  return new PayPalError(res.status, `${body.name ?? "PAYPAL_ERROR"}: ${message}`, debugId, body.details);
}

async function fetchNewToken(): Promise<CachedToken> {
  const { baseUrl, clientId, clientSecret } = getConfig();

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw await toPayPalError(res);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - EXPIRY_BUFFER_MS) {
    return cachedToken.value;
  }

  // If several requests need a token at once, share one token request
  // instead of asking PayPal for a new token per request.
  if (!pendingToken) {
    pendingToken = fetchNewToken()
      .then((token) => {
        cachedToken = token;
        return token.value;
      })
      .finally(() => {
        pendingToken = null;
      });
  }
  return pendingToken;
}

type Method = "GET" | "POST" | "PATCH";

type RequestOptions = {
  method?: Method;
  body?: unknown;
  // An exact JSON string to send as-is, for when re-serialising would change the bytes.
  rawBody?: string;
  // Content type for rawBody when it isn't JSON (e.g. multipart/form-data).
  contentType?: string;
  idempotencyKey?: string;
};

async function send(
  pathOrUrl: string,
  method: Method,
  body: string | undefined,
  contentType: string,
  idempotencyKey?: string,
) {
  const { baseUrl } = getConfig();
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl}${pathOrUrl}`;

  // Pagination links come back as full URLs. Never send our token anywhere
  // except PayPal's API.
  if (!url.startsWith(baseUrl)) {
    throw new Error(`Refusing to call a non-PayPal URL: ${url}`);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${await getAccessToken()}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = contentType;
  if (idempotencyKey) headers["PayPal-Request-Id"] = idempotencyKey;

  return fetch(url, {
    method,
    headers,
    body,
  });
}

export async function paypalRequest<T>(pathOrUrl: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";

  // Writes carry an idempotency key: if the same request is sent twice,
  // PayPal applies it once and returns the original result.
  const idempotencyKey =
    method === "GET" ? undefined : (options.idempotencyKey ?? crypto.randomUUID());

  const body = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  const contentType = options.contentType ?? "application/json";

  let res = await send(pathOrUrl, method, body, contentType, idempotencyKey);

  // A 401 usually means the cached token went stale. Drop it and retry once,
  // with the same idempotency key so a write can't happen twice.
  if (res.status === 401) {
    cachedToken = null;
    res = await send(pathOrUrl, method, body, contentType, idempotencyKey);
  }

  if (!res.ok) throw await toPayPalError(res);

  // Some PayPal endpoints reply with an empty body (for example 204 No Content).
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
