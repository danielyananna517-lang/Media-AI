function domainOf(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

const trustedPatterns = [
  /\.gov$/i, /\.edu$/i, /who\.int$/i, /un\.org$/i, /nature\.com$/i, /sciencedirect\.com$/i,
  /pubmed\.ncbi\.nlm\.nih\.gov$/i, /reuters\.com$/i, /apnews\.com$/i
];

export function compareSources(research = {}) {
  const results = Array.isArray(research.results) ? research.results : [];
  const seenDomains = new Set();
  const compared = results.map((r, index) => {
    const domain = domainOf(r.url);
    const independent = domain && !seenDomains.has(domain);
    if (domain) seenDomains.add(domain);
    const trusted = trustedPatterns.some(p => p.test(domain));
    const highlights = Array.isArray(r.highlights) ? r.highlights : [];
    const score = (trusted ? 2 : 0) + (independent ? 1 : 0) + (highlights.length ? 1 : 0);
    const evidenceGrade = score >= 4 ? 'A' : score >= 3 ? 'B' : score >= 2 ? 'C' : 'D';
    return { rank: index + 1, title: r.title || domain || `Source ${index + 1}`, url: r.url || '', domain, evidenceGrade, independentDomain: Boolean(independent), highlights };
  });
  return {
    total: compared.length,
    uniqueDomains: new Set(compared.map(x => x.domain).filter(Boolean)).size,
    recommendation: compared.length >= 2 ? 'Cross-check important claims across independent sources.' : 'Use at least two independent sources before factual publication.',
    sources: compared
  };
}

export function buildProductionPlan({ topic = '', script = {}, adaptations = [] } = {}) {
  const title = script.title || topic || 'Untitled content';
  const body = Array.isArray(script.body) ? script.body : [];
  const segments = [
    { id: 1, type: 'hook', seconds: 6, text: script.hook || `Why should you care about ${topic}?` },
    ...body.map((text, i) => ({ id: i + 2, type: 'body', seconds: 10, text })),
    { id: body.length + 2, type: 'cta', seconds: 6, text: script.cta || 'Watch the next video.' }
  ];
  let cursor = 0;
  const subtitles = segments.map(s => {
    const start = cursor;
    cursor += s.seconds;
    return { ...s, start, end: cursor };
  });
  return {
    title,
    format: adaptations[0]?.platform || 'youtube',
    totalDurationSeconds: cursor,
    shotList: segments.map(s => ({ id: s.id, visual: s.type === 'hook' ? 'Attention-grabbing visual matching the hook' : s.type === 'cta' ? 'End card / next-video cue' : 'Supporting visual for the point', narration: s.text, seconds: s.seconds })),
    subtitles,
    assetChecklist: ['Voice track', 'Background/scene visuals', 'On-screen text', 'Thumbnail', 'Final QA pass'],
    publishGate: 'Manual approval required'
  };
}

export function toSrt(subtitles = []) {
  const stamp = seconds => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},000`;
  };
  return subtitles.map((s, i) => `${i + 1}\n${stamp(s.start)} --> ${stamp(s.end)}\n${String(s.text).trim()}\n`).join('\n');
}

export function analyzeLearning(metrics = {}, previous = []) {
  const views = Number(metrics.views || 0);
  const likes = Number(metrics.likes || 0);
  const comments = Number(metrics.comments || 0);
  const shares = Number(metrics.shares || 0);
  const ctr = Number(metrics.ctr || 0);
  const avgViewPercent = Number(metrics.avgViewPercent || 0);
  const engagementRate = views ? ((likes + comments + shares) / views) * 100 : 0;
  const lessons = [];
  if (ctr && ctr < 3) lessons.push('Test a clearer promise in title/thumbnail.');
  if (ctr >= 5) lessons.push('Packaging is generating healthy click interest; document the hook/title pattern.');
  if (avgViewPercent && avgViewPercent < 30) lessons.push('Strengthen the first 15–30 seconds and reduce slow setup.');
  if (avgViewPercent >= 50) lessons.push('Retention is comparatively strong; preserve the structure and pacing.');
  if (engagementRate >= 2) lessons.push('Conversation/share signals are useful; retain an explicit audience prompt.');
  if (!lessons.length) lessons.push('Collect comparable results before changing the format.');
  const comparable = previous.filter(x => x?.metrics?.views > 0);
  return { ...metrics, engagementRate: Number(engagementRate.toFixed(2)), comparableCount: comparable.length, lessons };
}


export function buildResearchBrief(research = {}, comparison = {}) {
  const sources = Array.isArray(comparison.sources) ? comparison.sources : [];
  const snippets = [];
  for (const s of sources) {
    for (const h of (s.highlights || []).slice(0, 2)) {
      const text = String(h).replace(/\s+/g, ' ').trim();
      if (text) snippets.push({ source: s.title, url: s.url, text: text.slice(0, 500), evidenceGrade: s.evidenceGrade });
    }
  }
  return {
    topic: research.query || '',
    provider: research.provider || 'unknown',
    sourceCount: sources.length,
    uniqueDomains: comparison.uniqueDomains || 0,
    crossCheckRequired: (comparison.uniqueDomains || 0) < 2,
    evidenceNotes: snippets.slice(0, 12)
  };
}
