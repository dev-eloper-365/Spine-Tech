// Cloudflare Pages Function for /work/*: Pages static assets ignore the HTTP Range header,
// and Safari (macOS and iOS) only plays <video> when the server answers byte ranges with 206.
// This serves the same asset and slices it for range requests. Vercel handles ranges itself.
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const asset = await env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }));
  if (!asset.ok || !url.pathname.endsWith('.mp4')) return asset;

  const headers = new Headers(asset.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=86400');
  const range = request.headers.get('Range');
  if (!range) return new Response(request.method === 'HEAD' ? null : asset.body, { status: 200, headers });

  const body = await asset.arrayBuffer();
  const size = body.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start = m && m[1] !== '' ? Number(m[1]) : NaN;
  let end = m && m[2] !== '' ? Number(m[2]) : size - 1;
  if (m && m[1] === '' && m[2] !== '') { start = Math.max(0, size - Number(m[2])); end = size - 1; } // suffix range: last N bytes
  if (!m || Number.isNaN(start) || start >= size || end < start) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' } });
  }
  end = Math.min(end, size - 1);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(request.method === 'HEAD' ? null : body.slice(start, end + 1), { status: 206, headers });
}
