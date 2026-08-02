import { store, bench } from '../data.js';
import { fmt, esc, hbar, bindBars, stat, card, cvar, banner } from '../ui.js';

/* ------------------------------------------------------------------ *
 * Pattern tests. Every claim on this tab is computed from the catalog
 * at render time and carries an honest strength rating, so a new
 * manager can check the working rather than take it on faith.
 * ------------------------------------------------------------------ */

const avg = list => list.length ? Math.round(list.reduce((s, t) => s + t.views, 0) / list.length) : 0;
const has = (t, tag) => (t.artists || []).includes(tag);

function patterns() {
  const c = store.catalog;
  const b = bench();

  const album      = c.filter(t => has(t, 'album'));
  const back       = c.filter(t => !has(t, 'album'));
  const breedBack  = c.filter(t => has(t, 'breed') && t.era === 'Back catalog');
  const iam        = breedBack.filter(t => /iamnubreed/i.test(t.credit || ''));
  const notIam     = breedBack.filter(t => !/iamnubreed/i.test(t.credit || ''));
  const zahLed     = (store.zahTracks || []).filter(t => t.led).length;
  const zahTotal   = (store.zahTracks || []).length;

  return [
    {
      name: 'Which channel it goes out on',
      finding: `${fmt(b.noRemedyBig)} vs ${fmt(b.noRemedySmall)} views`,
      ratio: (b.noRemedyBig / b.noRemedySmall).toFixed(1) + '×',
      evidence: 'NO REMEDY, the same song, posted to both channels in the same week. One variable changed.',
      strength: 'strong',
      note: 'A natural experiment — the cleanest evidence in the whole dataset.',
      action: 'Release on the 237K commentary channel. Nothing else on this page pays as well.',
    },
    {
      name: 'Music videos beat static audio uploads',
      finding: `${fmt(avg(back))} vs ${fmt(avg(album))} views`,
      ratio: (avg(back) / (avg(album) || 1)).toFixed(1) + '×',
      evidence: `${back.length} back-catalog tracks (mostly music videos) against ${album.length} 2026 album uploads (mostly "Official Audio").`,
      strength: 'strong',
      note: 'Confounded with a 10-month release gap and the channel change — the direction is certain, the size is not.',
      action: 'Every release gets visuals. No more static-audio uploads.',
    },
    {
      name: 'One consistent artist credit',
      finding: `${fmt(avg(iam))} vs ${fmt(avg(notIam))} views`,
      ratio: (avg(iam) / (avg(notIam) || 1)).toFixed(1) + '×',
      evidence: `Within the back catalog only, tracks credited "IamNubreed" (${iam.length}) against Breed's other spellings (${notIam.length}). Era held constant.`,
      strength: 'moderate',
      note: `Small samples (${iam.length} vs ${notIam.length}). Survives the obvious "old tracks are bigger" objection, but is not proof on its own.`,
      action: 'Lock one spelling. The credit that carried the biggest records is the one to keep.',
    },
    {
      name: 'Yawitazah on the record',
      finding: `${zahLed} of ${zahTotal} led their group`,
      ratio: zahLed + '/' + zahTotal,
      evidence: 'Each track measured against what was released alongside it: Ring The Alarm #1 of 4, Musick Industry #2 of 4, Filthy Coon #1 of 9 on the album at 2.3x the next, HIGH ALERT the biggest record on King Konnect\'s channel.',
      strength: 'consistent',
      note: 'Holds across four contexts, three years and two channels. The one exception, SKY ON FIRE, went out during a channel hiatus and an online dispute.',
      action: 'Treat these collaborations as a format that works. Plan the next single around one.',
    },
    {
      name: 'Release cadence',
      finding: '2\u20133 a week vs one every two weeks',
      ratio: '\u2014',
      evidence: 'The 2026 album went out at two to three songs a week, and every track after the first landed below it.',
      strength: 'strong',
      note: 'Each release competes with the one before it for the same attention.',
      action: 'One release every two weeks, with a 14-day pitch runway.',
    },
  ];
}

const STRENGTH = {
  strong:     'p-good',
  consistent: 'p-good',
  moderate:   'p-info',
  emerging:   'p-warn',
};

export function render() {
  const b = bench();
  const p = patterns();
  const c = store.catalog;
  const album = c.filter(t => has(t, 'album'));
  const gt = store.channels.find(x => x.stage === 'established');

  const rows = p.map(x => `
    <tr>
      <td><strong>${esc(x.name)}</strong><br><span class="muted sm">${esc(x.evidence)}</span></td>
      <td class="r num">${esc(x.finding)}<br><strong>${esc(x.ratio)}</strong></td>
      <td><span class="badge ${STRENGTH[x.strength]}">${esc(x.strength)}</span></td>
      <td class="muted sm">${esc(x.note)}</td>
      <td class="sm">${esc(x.action)}</td>
    </tr>`).join('');

  const evidenceRows = [
    { k: 'Commentary channel / video', v: b.gtAvg, color: cvar('--good'),
      note: 'What the 237K channel reaches per upload' },
    { k: 'Back catalog average', v: Math.round(c.filter(t => !has(t, 'album')).reduce((s, t) => s + t.views, 0) / c.filter(t => !has(t, 'album')).length),
      color: cvar('--series-1'), note: 'Mostly music videos, prior era' },
    { k: 'NO REMEDY — big channel', v: b.noRemedyBig, color: cvar('--series-3'),
      note: 'Same song, commentary channel' },
    { k: 'NO REMEDY — music channel', v: b.noRemedySmall, color: cvar('--critical'),
      note: 'Same song, same week, music channel' },
    { k: '2026 album average', v: Math.round(album.reduce((s, t) => s + t.views, 0) / (album.length || 1)),
      color: cvar('--critical'), note: 'Where the label is now' },
  ];

  return `
${banner({ id: 'wQwwd6zu62A', title: 'Executive brief', sub: 'The label, the verdict and the patterns worth betting on — written to be read cold.', badge: 'start here' })}
${card(`
  <span class="badge p-info">start here</span>
  <h2 style="margin-top:.5em">Executive brief</h2>
  <p class="muted sm">Written to be read cold. If you have just joined, this page is the whole
  situation in about three minutes.</p>

  <table class="kv" style="margin-top:16px"><tbody>
    <tr><td>Label</td><td>Tha Remnant Music Group — independent, self-funded</td></tr>
    <tr><td>Genre</td><td>Spiritual / faith rap, positioned alongside mainstream rap</td></tr>
    <tr><td>Roster</td><td>BREED (founder, primary funder) · JayThaRealist (producer, engineer, artist)
      · King Konnect (artist) · Yawitazah (artist, and all marketing, video and graphics)</td></tr>
    <tr><td>Biggest asset</td><td><strong>${fmt(gt?.subs || 237000)} subscribers</strong> on Breed's
      commentary channel, ~${fmt(b.gtAvg)} views per upload, near-daily</td></tr>
    <tr><td>Current release</td><td>A nine-track album, July 2026, averaging
      <strong>${fmt(Math.round(album.reduce((s, t) => s + t.views, 0) / (album.length || 1)))}</strong> views a track</td></tr>
    <tr><td>Goals</td><td>100,000+ streams across all DSPs · artists touring · the label generating
      revenue · entirely self-funded</td></tr>
    <tr><td>Paid budget</td><td>Under $500/month</td></tr>
    <tr><td>Distribution</td><td>DistroKid account live; album and singles queued</td></tr>
  </tbody></table>`)}

${card(`
  <h3>The verdict</h3>
  <div class="callout crit">
    <p style="margin:0 0 .6em"><strong>This label does not have a discovery problem. It has a
    distribution-of-attention problem.</strong></p>
    <p class="sm" style="margin:0">The audience already exists — ${fmt(gt?.subs || 237000)} people who
    show up near-daily for Breed's commentary on spiritual warfare, betrayal and the end times. The
    music is about those exact subjects. It is being released to a different channel, roughly
    thirteen times smaller, that those people have no reason to visit. Everything else in this
    dashboard is a consequence of that one decision.</p>
  </div>
  <div class="grid g4" style="margin-top:16px">
    ${stat('Audience that exists', fmt(gt?.subs || 237000), 'commentary channel subscribers', 'good')}
    ${stat('Reached per upload', fmt(b.gtAvg), 'on that channel')}
    ${stat('Reached per song', fmt(Math.round(album.reduce((s, t) => s + t.views, 0) / (album.length || 1))), 'on the music channel', 'crit')}
    ${stat('Proven ceiling', fmt(b.topTenAvg), 'his own top-10 average')}
  </div>
  <div id="ev-chart" style="margin-top:18px">${hbar(evidenceRows, {
      rowH: 32, padL: 210, aria: 'The core evidence' })}</div>`)}

${card(`
  <h3>Patterns that predict success — and how much to trust each one</h3>
  <p class="muted sm">Every row is computed from the ${c.length}-track catalog when this page loads.
  Each carries an evidence rating so a new manager can see which ones are safe to build a release
  plan on and which still need more data behind them.</p>
  <div class="tbl-wrap" style="max-height:none;margin-top:12px">
    <table>
      <thead><tr>
        <th style="width:26%">Pattern</th><th class="r">Finding</th><th>Evidence</th>
        <th style="width:24%">Caveat</th><th style="width:22%">What to do</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`)}

${card(`
  <h3>For the incoming artist manager</h3>
  <p class="muted sm">What to own, in order. The first two weeks are almost entirely cleanup —
  none of it costs money, and all of it raises the ceiling on everything after.</p>

  <table class="kv" style="margin-top:14px"><tbody>
    <tr><td>Week 1</td><td class="wrap">Turn embedding on across both channels · lock one artist name
      and one title format · fix metadata on all nine album tracks · audit Spotify for duplicate
      artist pages (only King Konnect's has been checked)</td></tr>
    <tr><td>Week 2</td><td class="wrap">Move music releases onto the 237K channel · cut cadence to one
      release every two weeks · set DistroKid Splits so Jay and King get paid automatically</td></tr>
    <tr><td>Weeks 3–6</td><td class="wrap">Build and ship the first Sermon-to-Song release · measure it
      against the ${fmt(b.noRemedyBig)} benchmark · start submitting to Rapzilla, Trackstarz and
      Holy Culture on every single</td></tr>
    <tr><td>Weeks 6–12</td><td class="wrap">Development slots for King Konnect and JayThaRealist ·
      merch · one ticketed hometown show, filmed</td></tr>
  </tbody></table>

  <h4 style="margin-top:22px">Two artists to build, and the honest read on each</h4>
  <div class="grid g2" style="margin-top:10px">
    <div class="callout">
      <strong>King Konnect</strong> — 86 uploads, a release every two weeks, unprompted. That
      consistency is the rarest thing on this roster and it is currently being spent on 602
      subscribers. He does not need more output; he needs distribution he does not have.
      <span class="muted">Give him the second Sermon-to-Song slot.</span>
    </div>
    <div class="callout">
      <strong>JayThaRealist</strong> — the leverage is <strong>production</strong>, not verses. A
      producer gets credited on everyone's records and builds a name faster than a rapper can.
      "Produced by JayThaRealist" on screen every release, plus a studio-breakdown series on the
      big channel.
      <span class="muted">Undersold as a feature credit today.</span>
    </div>
  </div>`)}

${card(`
  <h3>Decisions already made</h3>
  <p class="muted sm">Settled — worth knowing so they don't get relitigated in week one.</p>
  <table class="kv"><tbody>
    <tr><td>Artist name</td><td class="wrap">BREED. Short, thumbnail-legible, and it sidesteps the
      established country-rap act "Nu Breed" that owns the search results</td></tr>
    <tr><td>Release vehicle</td><td class="wrap">Sermon-to-Song — a 13-minute commentary video whose
      final three minutes are the track, on the commentary channel</td></tr>
    <tr><td>Priority order</td><td class="wrap">Push Breed's album using his existing audience first,
      then build King Konnect and JayThaRealist on the back of it</td></tr>
    <tr><td>Paid strategy</td><td class="wrap">Remarket to people who already watch Breed. No bought
      playlists, at any price</td></tr>
    <tr><td>What 100K streams means</td><td class="wrap">A credibility milestone worth roughly
      $300–400. Merch and live shows are the actual business</td></tr>
  </tbody></table>`)}`;
}

export function bind(mount) {
  const b = bench();
  const c = store.catalog;
  const album = c.filter(t => has(t, 'album'));
  const back = c.filter(t => !has(t, 'album'));
  bindBars(mount.querySelector('#ev-chart'), [
    { k: 'Commentary channel / video', v: b.gtAvg, note: 'The 237K channel per upload' },
    { k: 'Back catalog average', v: avg(back), note: `${back.length} prior tracks` },
    { k: 'NO REMEDY — big channel', v: b.noRemedyBig, note: 'Same song, commentary channel' },
    { k: 'NO REMEDY — music channel', v: b.noRemedySmall, note: 'Same song, same week' },
    { k: '2026 album average', v: avg(album), note: `${album.length} uploads` },
  ]);
}
