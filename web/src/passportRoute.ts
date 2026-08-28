export const publicPassportPath = (token: string) => `/passport/${encodeURIComponent(token)}`;

export const publicPassportUrl = (token: string, origin = window.location.origin) => `${origin}${publicPassportPath(token)}`;

export const publicPassportTokenFromPath = (pathname: string) => {
  const match = pathname.match(/^\/passport\/([^/]+)\/?$/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]) || null; } catch { return null; }
};
