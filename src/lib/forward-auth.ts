export function forwardAuth(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of ["authorization", "x-id-token", "x-ims-access"]) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}
