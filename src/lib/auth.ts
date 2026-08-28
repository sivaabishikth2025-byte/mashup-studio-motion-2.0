const POOL = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "";
const CLIENT = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";
const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION || "us-east-1";
const ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`;

type Tokens = {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  email: string;
};

const KEY = "ims-auth";

async function cognito(target: string, body: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.__type || data.message) {
    const raw = String(data.message || data.__type || "Auth failed.");
    if (/clientId/i.test(raw) && /validation error/i.test(raw)) {
      throw new Error("Sign-in is not configured. Restart the app after Cognito is set.");
    }
    throw new Error(raw);
  }
  return data;
}

function decodeEmail(idToken: string) {
  const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  return String(payload.email || payload["cognito:username"] || "");
}

export function getSession(): Tokens | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tokens;
  } catch {
    return null;
  }
}

export function saveSession(tokens: Tokens) {
  localStorage.setItem(KEY, JSON.stringify(tokens));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}

export function signOut() {
  clearSession();
  if (typeof window !== "undefined") {
    window.location.replace("/?out=1");
  }
}

export function authHeaders(): Record<string, string> {
  const s = getSession();
  if (!s?.accessToken) return {};
  return {
    Authorization: `Bearer ${s.accessToken}`,
    "x-ims-access": s.accessToken,
    "x-id-token": s.idToken,
  };
}

export function authEnabled() {
  return Boolean(POOL && CLIENT);
}

export async function signUp(email: string, password: string) {
  if (!CLIENT) throw new Error("Cognito is not configured.");
  await cognito("SignUp", {
    ClientId: CLIENT,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });
}

export async function confirmSignUp(email: string, code: string) {
  await cognito("ConfirmSignUp", {
    ClientId: CLIENT,
    Username: email,
    ConfirmationCode: code,
  });
}

export async function signIn(email: string, password: string) {
  const data = await cognito("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  const result = data.AuthenticationResult;
  if (!result?.AccessToken) throw new Error("Sign-in did not return tokens.");
  const tokens: Tokens = {
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    refreshToken: result.RefreshToken,
    email: decodeEmail(result.IdToken),
  };
  saveSession(tokens);
  return tokens;
}
