export default function handler(request, response) {
  response.status(200).json({
    ok: true,
    since: request.query?.since ?? null,
    events: [],
    checkedAt: new Date().toISOString()
  });
}
