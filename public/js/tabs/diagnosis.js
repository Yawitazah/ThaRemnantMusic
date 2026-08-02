import { store, bench, catalogStats } from '../data.js';
import { fmt, esc, hbar, bindBars, stat, card, cvar } from '../ui.js';

export function render() {
  const b = bench();
  const s = catalogStats();
  const lift = (b.noRemedyBig / b.noRemedySmall).toFixed(1);
  const drop = Math.round((1 - b.musicAvg / b.topTenAvg) * 100);

  const abRows = [
    { k: 'NO REMEDY — Global Truth (237K)', v: b.noRemedyBig, color: cvar('--good'),
      note: 'Same song, same week, commentary channel' },
    { k: 'NO REMEDY — Universal (18.4K)',   v: b.noRemedySmall, color: cvar('--critical'),
      note: 'Same song, same week, music channel' },
  ];

  const ceilingRows = s.top10.slice(0, 10).map(t => ({
    k: t.title.length > 24 ? t.title.slice(0, 23) + '…' : t.title,
    v: t.views, color: cvar('--series-1'), note: t.credit,
  }));

  const zt = store.zahTracks || [];
  const led = zt.filter(t => t.led).length;

  const priorRows = store.prior.map(p => ({
    k: p.title.length > 26 ? p.title.slice(0, 25) + '…' : p.title,
    v: p.views, color: cvar('--series-2'), note: `${p.age} · ${p.format}`,
  }));
  const priorAvg = store.prior.length
    ? Math.round(store.prior.reduce((s, p) => s + p.views, 0) / store.prior.length)
    : b.priorAvg;
  const clearsQuarter = store.album.filter(a => a.yt_views >= priorAvg / 4).length;

  return `
${card(`
  <h2>The core finding</h2>
  <p><strong>There is no discovery problem. There is a distribution-of-attention problem.</strong></p>
  <p class="muted">Breed owns a 237,000-subscriber channel doing ~17,000 views per video, near-daily.
  It is a spiritual / end-times commentary channel. The music goes out on a different,
  18,400-subscriber channel doing ~1,400 views per song.</p>
  <div class="grid g4" style="margin-top:14px">
    ${stat('Commentary channel', fmt(b.gtAvg), '237K subs · avg views/video')}
    ${stat('Music channel', fmt(b.musicAvg), '18.4K subs · avg views/song', 'crit')}
    ${stat('Proven ceiling', fmt(b.topTenAvg), 'top-10 catalog average')}
    ${stat('Collapse', drop + '%', 'below his own ceiling', 'crit')}
  </div>`)}

${card(`
  <h3>1 — The A/B test already ran, accidentally</h3>
  <p class="muted sm">The only variable was which channel it went out on. YouTube does not transfer
  algorithmic authority between channels — a second channel starts from zero no matter who owns it.</p>
  <div id="ab-chart">${hbar(abRows, { rowH: 34, padL: 220, aria: 'NO REMEDY on both channels' })}</div>
  <div class="callout good" style="margin-top:12px">
    <strong>${lift}× lift</strong> from changing nothing but the door it walked through.
    This is the proof of concept for the whole plan.
  </div>`)}

${card(`
  <h3>2 — This is a collapse, not a cold start</h3>
  <p class="muted sm">Breed's own catalog on the same music channel. Dashed line is the
  current album average.</p>
  <div id="ceiling-chart">${hbar(ceilingRows, {
      rowH: 27, padL: 190, ref: b.musicAvg, refLabel: 'album avg ' + fmt(b.musicAvg),
      aria: 'Top catalog performance versus current album' })}</div>
  <p class="sm muted" style="margin-top:12px">What changed: a ~10-month gap with no music ·
  a shift from music videos to static "Official Audio" uploads · drama and callout content mixed
  into the music feed · 2–3 releases a week so every song cannibalises the last · and the big
  records were <em>collaborations</em> credited <strong>IamNubreed</strong>, while this album is
  almost entirely solo and credited five different ways.</p>`)}

${card(`
  <h3>Prior catalog — 2024–2025</h3>
  <p class="muted sm">The music videos immediately before this album. Dashed line is their average
  of ${fmt(priorAvg)} views.</p>
  <div id="prior-chart">${hbar(priorRows, {
      rowH: 28, padL: 210, ref: priorAvg, refLabel: 'prior average ' + fmt(priorAvg),
      aria: 'Prior catalog performance' })}</div>
  <div class="callout crit" style="margin-top:12px">
    Only <strong>${clearsQuarter}</strong> of the ${store.album.length} album tracks clears even a
    quarter of that average. The drop is not gradual — it is a cliff, and it lines up exactly with
    the switch from music videos to static audio uploads on the smaller channel.
  </div>`)}

${card(`
  <h3>The Yawitazah collaborations</h3>
  <p class="muted sm">Measured against what was released alongside each one — the only comparison
  that means anything, since a track from two years ago has had two years to accumulate views and a
  track from last month has had a month.</p>

  <div class="grid g4" style="margin-top:16px">
    ${stat('Led their release group', `${led}\u2009/\u2009${zt.length}`, 'of the tracks he appears on', 'good')}
    ${stat('Ring The Alarm', fmt(21233), '#1 of its group')}
    ${stat('Musick Industry', fmt(20145), '#2 of the same group')}
    ${stat('Filthy Coon', fmt(3471), 'best on the 2026 album')}
  </div>

  <div class="tbl-wrap" style="max-height:none;margin-top:18px">
    <table>
      <thead><tr>
        <th>Track</th><th class="r">Views</th><th>Released against</th>
        <th class="r">Placed</th><th style="width:34%">What happened</th>
      </tr></thead>
      <tbody>
        ${zt.map(t => `
          <tr${t.led ? ' style="background:var(--surface-2)"' : ''}>
            <td><strong>${esc(t.title)}</strong><br>
                <span class="muted sm">${esc(t.credit || '')} · ${esc(t.released || '')}</span></td>
            <td class="r num"><strong>${fmt(t.views)}</strong></td>
            <td class="muted sm">${esc(t.cohort)}<br>
                <span class="sm">${t.cohort_size} tracks · avg ${fmt(t.cohort_avg)}</span></td>
            <td class="r"><span class="badge ${t.led ? 'p-good' : 'p-mute'}">#${t.rank_in_cohort}
                of ${t.cohort_size}</span></td>
            <td class="muted sm">${esc(t.headline || '')}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="callout good" style="margin-top:14px">
    <strong>${led} of the ${zt.length} records finished first or second in the group they came out
    with.</strong> Ring The Alarm and Musick Industry took both top spots in their release window.
    Filthy Coon is the strongest track on the 2026 album at more than double the next one. HIGH ALERT
    is the biggest record on King Konnect's own channel. That is a consistent result across four
    different contexts, three different years and two different channels.
  </div>
  <p class="sm muted">SKY ON FIRE is the exception, and it has an explanation rather than a mystery:
  it went out while Yawitazah's channel was dormant following a hiatus, during a period when Breed
  was in a public online dispute. Neither condition applied to the other four.</p>`)}

${card(`
  <h3>3 — Embedding is disabled on every video</h3>
  <span class="badge p-crit">critical</span> <span class="badge p-mute">$0 · 1 hour</span>
  <p style="margin-top:10px">Loading any label track in an external player returns
  <code>Error 153 — Video player configuration error</code>. <strong>"Allow embedding" is OFF.</strong></p>
  <p class="muted sm">Consequence: no blog, no Rapzilla feature, no fan site, no Reddit or Discord
  preview, no EPK, no artist page can display the music. Every off-platform share is a dead grey box.</p>
  <p class="sm"><strong>Fix:</strong> YouTube Studio → Content → select all music videos → Edit →
  More options → <strong>Allow embedding: ON</strong>. Bulk across both channels, then set as
  default under Settings → Upload defaults → Advanced.</p>`)}

${card(`
  <h3>4 — Four duplicate Spotify artist pages</h3>
  <span class="badge p-crit">high</span> <span class="badge p-mute">$0 · ~5 days</span>
  <p style="margin-top:10px">A Spotify artist search returns <strong>four distinct "King Konnect"
  profiles</strong>. Each splits the follower count — and follower count drives Release Radar,
  the only algorithmic placement the label is documented-guaranteed.</p>
  <ol class="sm muted">
    <li>Identify the page holding his oldest legitimate release — that is canonical.</li>
    <li>DistroKid → Goodies → <strong>Spotify URI Looker Upper</strong> → grab that URI.</li>
    <li>Claim it in <strong>Spotify for Artists</strong> first.</li>
    <li>File one request per stray release at <a href="https://distrokid.com/fixer" target="_blank" rel="noopener">distrokid.com/fixer</a>.</li>
    <li>Repeat the audit for Breed and JayThaRealist before the next release.</li>
  </ol>`)}

${card(`
  <h3>5 — Name collision and metadata chaos</h3>
  <span class="badge p-crit">high</span>
  <ul class="sm" style="margin-top:10px">
    <li><strong>"Nu Breed"</strong> is an established country-rap act. <em>Ride or Die</em> alone has
    1.8M views; they own the Spotify search result for the name.</li>
    <li>Own branding is split <strong>six</strong> ways: Nubreed, NuBreed, Nu Breed, IamNubreed,
    Breed, Nubreed Universal — and <strong>IamNubreed</strong> is the credit on the biggest records.</li>
    <li>Features credited four ways: JayThaRealist / JayTheRealest / Jay the Realist; and
    Yawitazah / Yawitizah / Yahwitizah.</li>
    <li>The same song sits on three channels under three titles, splitting one view count three ways
    instead of compounding it.</li>
  </ul>
  <div class="callout crit">
    <strong>Fix:</strong> lock <strong>BREED</strong> — short, thumbnail-legible, sidesteps the
    country act. One spelling per artist. Title format every time:
    <code>BREED – Song Name (feat. X)</code>
  </div>`)}

${card(`
  <h3>The strategy — Sermon-to-Song</h3>
  <p><strong>Stop marketing the music as music.</strong> The 237K audience did not subscribe for rap.
  They subscribed for a man telling them the truth about spiritual warfare, betrayal and the end
  times — which is exactly what the songs are about.</p>
  <p class="callout">The unit of release is not a song upload. It is a 13-minute commentary video
  whose final three minutes are the track.</p>
  <ul class="sm muted">
    <li><strong>0–10 min</strong> — Breed does what he already does: commentary on the song's exact
    theme. Title and thumbnail in the channel's proven style. No music branding.</li>
    <li><strong>~10 min</strong> — "I wrote a record about this. Here it is." Hard cut.</li>
    <li><strong>10–13 min</strong> — the track, with visuals.</li>
    <li><strong>End screen</strong> — channel element to the music channel. HyperFollow link pinned
    in the top comment and description line 1.</li>
  </ul>
  <p class="sm muted">YouTube's recommendation model clusters on watch history and penalises videos
  that end sessions. A bare song ends the session. A teaching that resolves into a song holds the
  audience it was built for — and the song rides along.</p>`)}

${card(`
  <h3>Where these numbers came from</h3>
  <p class="muted sm">Worth knowing which figures are solid and which are directional, before
  anyone quotes them in a meeting.</p>

  <table class="sm" style="margin-top:10px">
    <thead><tr><th>Figure</th><th>Confidence</th><th>Source</th></tr></thead>
    <tbody>
      <tr><td>Channel subs, views, all catalog counts</td>
          <td><span class="badge p-good">verified</span></td>
          <td class="muted">Scraped live from YouTube, 2 Aug 2026</td></tr>
      <tr><td>Embedding disabled (error 153)</td>
          <td><span class="badge p-good">verified</span></td>
          <td class="muted">Reproduced in-browser on every track tested</td></tr>
      <tr><td>Four duplicate King Konnect Spotify pages</td>
          <td><span class="badge p-good">verified</span></td>
          <td class="muted">Spotify artist search, 2 Aug 2026</td></tr>
      <tr><td>Ad CPM / cost-per-view benchmarks</td>
          <td><span class="badge p-warn">directional</span></td>
          <td class="muted">Third-party industry sources, not vendor docs</td></tr>
      <tr><td>SubmitHub / Groover conversion rates</td>
          <td><span class="badge p-warn">directional</span></td>
          <td class="muted">Third-party industry sources</td></tr>
      <tr><td>Playlist retention percentages</td>
          <td><span class="badge p-warn">directional</span></td>
          <td class="muted">Third-party industry sources</td></tr>
      <tr><td>Holy Culture Radio submission terms</td>
          <td><span class="badge p-crit">unconfirmed</span></td>
          <td class="muted">Not verified — check before relying on it</td></tr>
      <tr><td>All DSP stream counts</td>
          <td><span class="badge p-crit">not pulled</span></td>
          <td class="muted">Log them in Album Ledger and Weekly Tracker</td></tr>
    </tbody>
  </table>

  <h4 style="margin-top:20px">Still not audited</h4>
  <ul class="sm muted">
    <li>Breed's and JayThaRealist's Spotify pages have <strong>not</strong> been checked for
    duplicates — only King Konnect's four-way split was confirmed. Do this before the next release.</li>
    <li>Merch, the live show and DistroKid Ultimate are recommendations, not decisions.</li>
    <li>Re-pull any YouTube figure older than a couple of weeks before quoting it.</li>
  </ul>

  <h4 style="margin-top:20px">Sources</h4>
  <div class="grid g2">
    <div>
      <p class="sm muted" style="margin-bottom:4px"><strong>Channels</strong></p>
      <ul class="sm">
        <li><a href="https://www.youtube.com/@NubreedGlobalTruth77" target="_blank" rel="noopener">Nubreed Global Truth</a></li>
        <li><a href="https://www.youtube.com/@NubreedUniversal" target="_blank" rel="noopener">Nubreed Universal Ent.</a></li>
        <li><a href="https://www.youtube.com/@kingkonnect7524" target="_blank" rel="noopener">King Konnect</a></li>
        <li><a href="https://www.youtube.com/@undergroundnation9151" target="_blank" rel="noopener">UNDERGROUND NATION</a></li>
      </ul>
    </div>
    <div>
      <p class="sm muted" style="margin-bottom:4px"><strong>Platform mechanics</strong></p>
      <ul class="sm">
        <li><a href="https://support.distrokid.com/hc/en-us/articles/360015182574-My-Music-is-Mixed-Up-With-Another-Artist-s-Music" target="_blank" rel="noopener">DistroKid — mixed-up artist pages / Fixer</a></li>
        <li><a href="https://support.distrokid.com/hc/en-us/articles/360013534394-Using-Splits-To-Pay-Your-Collaborators-Automatically" target="_blank" rel="noopener">DistroKid — Splits</a></li>
        <li><a href="https://support.distrokid.com/hc/en-us/articles/360049542553-Eligibility-for-YouTube-Content-ID-Through-The-Social-Media-Pack-Extra" target="_blank" rel="noopener">DistroKid — Content ID eligibility</a></li>
        <li><a href="https://support.spotify.com/us/artists/article/pitching-music-and-videos-to-playlist-editors/" target="_blank" rel="noopener">Spotify — editorial pitching</a></li>
        <li><a href="https://support.spotify.com/us/artists/article/getting-music-on-release-radar/" target="_blank" rel="noopener">Spotify — Release Radar</a></li>
        <li><a href="https://rapzilla.com/submit/" target="_blank" rel="noopener">Rapzilla submissions</a></li>
      </ul>
    </div>
  </div>`)}
`;
}

export function bind(mount) {
  const b = bench(), s = catalogStats();
  bindBars(mount.querySelector('#ab-chart'), [
    { k: 'NO REMEDY — Global Truth (237K)', v: b.noRemedyBig, note: 'Commentary channel' },
    { k: 'NO REMEDY — Universal (18.4K)',   v: b.noRemedySmall, note: 'Music channel' },
  ]);
  bindBars(mount.querySelector('#ceiling-chart'),
    s.top10.map(t => ({ k: t.title, v: t.views, note: t.credit })));
  bindBars(mount.querySelector('#prior-chart'),
    store.prior.map(p => ({ k: p.title, v: p.views, note: `${p.age} · ${p.format}` })));
}
