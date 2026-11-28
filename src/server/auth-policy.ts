export function demoAllowed(
  startedOnLoopback: boolean,
  enabled: boolean,
  host: string | null,
  forwarded: string | null,
  hosted: boolean,
) {
  const loop = (h: string | null) =>
    !!h && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(h);
  return (
    startedOnLoopback &&
    enabled &&
    !hosted &&
    loop(host) &&
    (!forwarded || loop(forwarded))
  );
}
