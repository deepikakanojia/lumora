/* ============================================================================
   Onboarding Operations — Command Center
   ----------------------------------------------------------------------------
   Reads window.ONBOARDING_DATA (built by build_nho_data.py) and derives EVERYTHING —
   cohort counts, monthly roll-ups, every chart, the needs-attention queue — at
   render time from the single `hires` array. Nothing is pre-aggregated, so a
   change in the spreadsheet flows through the whole dashboard on rebuild.

   Two deliberate corrections to the behaviour of the dashboard this replaces:
     * All text reaches the DOM through textContent / createTextNode, never
       through innerHTML concatenation. Tracker cells are untrusted input.
     * "Today" is the dataset's own reference date, not the browser clock in
       UTC, so the past / active / upcoming boundaries cannot drift a day.
   ========================================================================== */
(function () {
'use strict';

var DATA  = window.ONBOARDING_DATA || {};
var HIRES = (DATA.hires || []).slice();
var TODAY = DATA.referenceDate || '2026-09-11';

/* ------------------------------------------------------------------ utils */

// Minimal DOM builder. Strings become text nodes, so nothing from the
// spreadsheet is ever parsed as markup.
function h(tag, props, kids) {
  var n = document.createElement(tag);
  if (props) {
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') throw new Error('html is not allowed — use text');
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else if (k === 'style') n.setAttribute('style', v);
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, v);
    });
  }
  (kids || []).forEach(function (c) {
    if (c === null || c === undefined || c === false) return;
    n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  });
  return n;
}
function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

var MONTHS_LONG  = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Parse at local noon: an ISO date string is a calendar date, not an instant,
// and midnight parsing shifts it by a day in negative-offset timezones.
function d(iso) {
  if (!iso) return null;
  var t = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return isNaN(t.getTime()) ? null : t;   // a truthy but unparseable cell -> null, never NaN
}
function ym(iso) { return iso ? iso.slice(0, 7) : ''; }
function addDays(iso, n) {
  var t = d(iso); t.setDate(t.getDate() + n);
  return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
}
function pad(n) { return (n < 10 ? '0' : '') + n; }
function fmtShort(iso) {           // "Mon, Sep 14"
  var t = d(iso); if (!t) return '—';
  return DOW[t.getDay()] + ', ' + MONTHS_SHORT[t.getMonth()] + ' ' + t.getDate();
}
function fmtDay(iso) {             // "Sep 14"
  var t = d(iso); if (!t) return '—';
  return MONTHS_SHORT[t.getMonth()] + ' ' + t.getDate();
}
function fmtLong(iso) {            // "Monday, September 14, 2026"
  var t = d(iso); if (!t) return '—';
  var dows = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return dows[t.getDay()] + ', ' + MONTHS_LONG[t.getMonth()] + ' ' + t.getDate() + ', ' + t.getFullYear();
}
function fmtMonth(key) {           // "September 2026"
  var p = String(key || '').split('-');
  var m = MONTHS_LONG[+p[1] - 1];
  return m ? m + ' ' + p[0] : 'No date';
}
function fmtMonthShort(key) {
  var p = String(key || '').split('-');
  var m = MONTHS_SHORT[+p[1] - 1];
  return m ? m + ' ' + p[0].slice(2) : 'No date';
}
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function initials(hire) {
  return ((hire.first || ' ')[0] + (hire.last || ' ')[0]).toUpperCase().trim() || '?';
}
function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
function byCountDesc(o) {
  return Object.keys(o).sort(function (a, b) { return o[b] - o[a] || a.localeCompare(b); });
}
function tally(list, keyFn) {
  var out = {};
  list.forEach(function (x) {
    var k = keyFn(x);
    (Array.isArray(k) ? k : [k]).forEach(function (kk) { out[kk] = (out[kk] || 0) + 1; });
  });
  return out;
}

/* ------------------------------------------------- derived hire attributes */

// The six onboarding steps the tracker actually records. System access only
// counts once the hire has started — before day 1 a blank cell is expected, not a gap.
// A column the tracker does not carry is not the same as a step left undone.
// fieldsPresent records which logical columns each source actually had, so an
// untracked step drops off the ladder instead of reading as permanently 0%.
var PRESENT = DATA.fieldsPresent || {};
// Per SOURCE, not unioned: the archive workbook carries a welcome-call column
// and the main tracker currently does not. Unioning them would flag every
// tracker hire as "welcome call not sent" for a column that never existed.
function trackedFor(field, source) {
  if (!field) return true;
  var cols = PRESENT[source];
  if (!cols || !cols.length) return true;          // unknown provenance -> assume tracked
  var col = field === 'googleGroupDone' ? 'googleGroup' : field;   // derived from the URL column
  return cols.indexOf(col) !== -1;
}
function stepsFor(hire) {
  return STEPS.filter(function (s) { return trackedFor(s.key, hire.source); });
}

var STEPS = [
  { key: 'managerEmailSent', label: 'Manager notified', icon: '✉' },
  { key: 'welcomeCallSent',  label: 'Welcome call',  icon: '☎' },
  { key: 'slack',            label: 'Team channel',  icon: '#' },
  { key: 'googleGroupDone',  label: 'Google group',  icon: '◎' },
  { key: 'kitOrdered',       label: 'Kit',           icon: '▣' },
  { key: 'deviceShipDate',   label: 'Device',        icon: '▭' }
];
function hasStarted(hire) { return !!hire.startDate && hire.startDate <= TODAY; }
function stepDone(hire, key) { return !!hire[key]; }
function readiness(hire) {
  var steps = stepsFor(hire), done = 0;
  steps.forEach(function (s) { if (stepDone(hire, s.key)) done++; });
  return { done: done, total: steps.length };
}
function groupReadiness(list) {
  if (!list.length) return 0;
  var done = 0, total = 0;
  list.forEach(function (x) { var r = readiness(x); done += r.done; total += r.total; });
  return total ? Math.round(done / total * 100) : 0;
}

// A hire's "operational date" — the day the team must be ready for. Off-cycle
// hires are anchored to their real joining date, not the cohort they roll into.
function opDate(hire) { return hire.offCycle ? hire.startDate : (hire.cohortDate || hire.startDate); }
// A hire with neither a cohort nor a joining date has no place on any month,
// so it would silently vanish from the cohort view while still counting in the
// totals. These are surfaced in their own section instead.
function isUndated(hire) { return !opDate(hire); }

/* ---------------------------------------------------------- status system */

function cohortStatus(cohortDate, nextCohortDate) {
  if (!cohortDate) return 'upcoming';
  var windowEnd = addDays(cohortDate, 13);
  if (cohortDate <= TODAY && TODAY <= windowEnd) return 'active';
  if (cohortDate < TODAY) return 'completed';
  if (cohortDate === nextCohortDate) return 'next';
  return 'upcoming';
}
var STATUS_META = {
  active:    { label: 'Active',    cls: 'st-active',    icon: '●' },
  next:      { label: 'Next up',   cls: 'st-next',      icon: '▸' },
  upcoming:  { label: 'Upcoming',  cls: 'st-upcoming',  icon: '○' },
  completed: { label: 'Completed', cls: 'st-completed', icon: '✓' },
  offcycle:  { label: 'Off-cycle', cls: 'st-offcycle',  icon: '◆' },
  attention: { label: 'Attention', cls: 'st-attention', icon: '!' }
};
function statusBadge(key) {
  var m = STATUS_META[key] || STATUS_META.upcoming;
  return h('span', { class: 'st ' + m.cls }, [
    h('span', { class: 'dot', 'aria-hidden': 'true' }), m.label
  ]);
}

// First cohort on or after the reference date — computed once, order-independent.
function nextCohortDate() {
  var dates = uniq(HIRES.filter(function (x) { return !x.offCycle && x.cohortDate; })
                        .map(function (x) { return x.cohortDate; })).sort();
  for (var i = 0; i < dates.length; i++) if (dates[i] >= TODAY) return dates[i];
  return null;
}
var NEXT_COHORT = nextCohortDate();

/* --------------------------------------------------------- needs attention */

// Each rule is a precise condition over one hire. `window` limits a rule to
// hires the team can still act on: everything from two weeks ago onward.
var ACTION_WINDOW_START = addDays(TODAY, -14);
function inActionWindow(hire) {
  var day = opDate(hire);
  // An undated hire is always actionable — having no date IS the problem.
  if (!day) return true;
  return day >= ACTION_WINDOW_START;
}
var ATTENTION_RULES = ([
  { id: 'welcome',  sev: 'serious',  icon: '☎', title: 'Welcome call not sent',
    hint: 'Invitation still outstanding for an upcoming or in-flight employee.',
    field: 'welcomeCallSent',
    test: function (x) { return !x.welcomeCallSent; } },
  { id: 'slack',    sev: 'serious',  icon: '#', title: 'Team channel not set up',
    hint: 'Cohort channel membership not recorded in the tracker.',
    field: 'slack',
    test: function (x) { return !x.slack; } },
  { id: 'mgrmail',  sev: 'serious',  icon: '✉', title: 'Manager not notified',
    hint: 'The manager has not been briefed for this employee yet.',
    field: 'managerEmailSent',
    test: function (x) { return !x.managerEmailSent; } },
  { id: 'group',    sev: 'warning',  icon: '◎', title: 'Google Group not created',
    hint: 'No group link recorded against the cohort.',
    field: 'googleGroupDone',
    test: function (x) { return !x.googleGroupDone; } },
  { id: 'device',   sev: 'warning',  icon: '▭', title: 'Device information missing',
    hint: 'No ship date recorded — IT cannot confirm day-1 hardware.',
    field: 'deviceShipDate',
    test: function (x) { return !x.deviceShipDate; } },
  { id: 'kit',      sev: 'warning',  icon: '▣', title: 'Welcome kit not ordered',
    field: 'kitOrdered',
    test: function (x) { return !x.kitOrdered; } },
  { id: 'okta',     sev: 'critical', icon: '⚿', title: 'IT setup pending after start',
    hint: 'Employee has already started but system access has not been activated.',
    field: 'oktaActivated',
    test: function (x) { return hasStarted(x) && !x.oktaActivated; } },
  { id: 'personal', sev: 'critical', icon: '✎', title: 'Personal email missing',
    hint: 'Pre-start communications cannot reach this employee.',
    field: 'personalEmail',
    test: function (x) { return !x.personalEmail; } },
  { id: 'manager',  sev: 'critical', icon: '☹', title: 'Manager information missing',
    hint: 'No manager name or email on the record.',
    field: 'managerName',
    test: function (x) { return !x.managerName || !x.managerEmail; } },
  { id: 'location', sev: 'warning',  icon: '⌖', title: 'Location missing',
    hint: 'Region routing and international handling cannot be determined.',
    field: 'location',
    test: function (x) { return !x.location; } },
  { id: 'nocohort', sev: 'critical', icon: '⊘', title: 'New employee not assigned to a cohort',
    hint: 'The employee would not appear on any cohort view.',
    field: 'cohortDate',
    test: function (x) { return !x.cohortDate; } }
]);
function attentionFor(list) {
  var pool = list.filter(inActionWindow);
  return ATTENTION_RULES.map(function (rule) {
    var hit = pool.filter(function (x) {
      return trackedFor(rule.field, x.source) && rule.test(x);
    });
    return { rule: rule, hires: hit, count: hit.length };
  }).filter(function (r) { return r.count > 0; });
}
function attentionCount(list) {
  return attentionFor(list).reduce(function (a, r) { return a + r.count; }, 0);
}
// A hire is "flagged" if any rule fires on it — used for the per-row indicator.
function hireFlags(hire) {
  if (!inActionWindow(hire)) return [];
  return ATTENTION_RULES.filter(function (r) {
    return trackedFor(r.field, hire.source) && r.test(hire);
  });
}

/* ------------------------------------------------------------------ state */

var state = {
  page: 'cohorts',
  month: null,            // 'YYYY-MM', or null for "all months"
  cohort: null,           // selected cohort/off-cycle date
  cohortKind: 'main',
  query: '',              // global search
  cohortQuery: '',        // search inside a cohort
  role: null,             // role chip inside a cohort
  sessionId: null,
  sessionTab: 'upcoming',
  sessionReq: '',
  attentionRule: null,
  sessionQuery: '',
  mgrSort: 'hires',
  mgrSortDir: 'desc',
  mgrQuery: '',
  fnTableSort: 'count',      // sort state for the "Employees by team / function" table
  fnTableSortDir: 'desc',
  regTableSort: 'count',     // sort state for the "Employees by region" table
  regTableSortDir: 'desc',
  filters: { kind: '', cohort: '', status: '', region: '', fn: '', dept: '', manager: '', recruiter: '', hrbp: '' }
};

function activeFilterCount() {
  return Object.keys(state.filters).filter(function (k) { return state.filters[k]; }).length;
}
// The filter row scopes every hire-derived number below it.
function applyFilters(list) {
  var f = state.filters;
  return list.filter(function (x) {
    if (f.kind === 'main' && x.offCycle) return false;
    if (f.kind === 'offcycle' && !x.offCycle) return false;
    if (f.kind === 'fast-track' && !x.pilot) return false;
    if (f.kind === 'nonus' && !x.nonUS) return false;
    if (f.cohort && x.cohortDate !== f.cohort) return false;
    if (f.status) {
      var s = x.offCycle ? 'offcycle' : cohortStatus(x.cohortDate, NEXT_COHORT);
      if (f.status === 'attention') { if (!hireFlags(x).length) return false; }
      else if (s !== f.status) return false;
    }
    if (f.region && x.region !== f.region) return false;
    if (f.fn && x.fn !== f.fn) return false;
    if (f.dept && (x.department || 'Not specified') !== f.dept) return false;
    if (f.manager && (x.managerName || 'No manager listed') !== f.manager) return false;
    if (f.recruiter && recruitersOf(x).indexOf(f.recruiter) === -1) return false;
    if (f.hrbp && (x.hrbp || 'Not assigned') !== f.hrbp) return false;
    return true;
  });
}
// One cell can credit several recruiters. Chart, filter and table all read it
// through here so a bar's count and its filtered result can never disagree.
function recruitersOf(hire) {
  var r = (hire.recruiter || '').trim();
  return r ? r.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : ['Not listed'];
}

function searchMatch(hire, q) {
  if (!q) return true;
  return [hire.name, hire.jobTitle, hire.managerName, hire.recruiter, hire.hrbp,
          hire.department, hire.fn, hire.location, hire.workEmail, hire.personalEmail,
          hire.region, hire.pilotTrack]
    .join(' ').toLowerCase().indexOf(q.toLowerCase()) !== -1;
}

/* ------------------------------------------------------------- month model */

function monthsPresent() {
  return uniq(HIRES.map(function (x) { return ym(opDate(x)); }).filter(Boolean)).sort();
}
var ALL_MONTHS = monthsPresent();
function currentMonthKey() {
  var t = ym(TODAY);
  if (ALL_MONTHS.indexOf(t) !== -1) return t;
  for (var i = 0; i < ALL_MONTHS.length; i++) if (ALL_MONTHS[i] >= t) return ALL_MONTHS[i];
  return ALL_MONTHS[ALL_MONTHS.length - 1] || t;
}
function hiresInMonth(key, list) {
  return (list || HIRES).filter(function (x) { return ym(opDate(x)) === key; });
}
// Main cohorts in a month, as {date, hires[]} sorted by date.
function mainCohortsIn(list) {
  var by = {};
  list.filter(function (x) { return !x.offCycle && x.cohortDate; })
      .forEach(function (x) { (by[x.cohortDate] = by[x.cohortDate] || []).push(x); });
  return Object.keys(by).sort().map(function (k) { return { date: k, hires: by[k] }; });
}
function offCycleIn(list) {
  var by = {};
  list.filter(function (x) { return x.offCycle; })
      .forEach(function (x) { (by[x.startDate] = by[x.startDate] || []).push(x); });
  return Object.keys(by).sort().map(function (k) { return { date: k, hires: by[k] }; });
}

/* ---------------------------------------------------------------- tooltip */

var tipEl = document.getElementById('tip');
function showTip(ev, value, label) {
  clear(tipEl);
  tipEl.appendChild(h('div', { class: 'tv', text: String(value) }));
  if (label) tipEl.appendChild(h('div', { class: 'tl', text: label }));
  tipEl.style.opacity = '1';
  tipEl.setAttribute('aria-hidden', 'false');
  moveTip(ev);
}
function moveTip(ev) {
  var x = ev.clientX + 14, y = ev.clientY + 14;
  var r = tipEl.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - 14;
  if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - 14;
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
}
function hideTip() {
  tipEl.style.opacity = '0';
  tipEl.setAttribute('aria-hidden', 'true');   // opacity alone keeps it announced
}
function attachTip(node, value, label) {
  node.addEventListener('pointerenter', function (e) { showTip(e, value, label); });
  node.addEventListener('pointermove', moveTip);
  node.addEventListener('pointerleave', hideTip);
  node.addEventListener('focus', function (e) {
    var r = node.getBoundingClientRect();
    showTip({ clientX: r.left + r.width / 2, clientY: r.top }, value, label);
  });
  node.addEventListener('blur', hideTip);
}

/* ----------------------------------------------------------------- charts */

// Horizontal bars: one series, one hue. Bars are scaled to the largest value,
// so length compares categories against the leader, not against a total.
function hbarChart(counts, opts) {
  opts = opts || {};
  var keys = byCountDesc(counts);
  if (opts.limit && keys.length > opts.limit) {
    var head = keys.slice(0, opts.limit);
    var tailSum = keys.slice(opts.limit).reduce(function (a, k) { return a + counts[k]; }, 0);
    counts = head.reduce(function (o, k) { o[k] = counts[k]; return o; }, {});
    var otherKey = tailSum ? 'Other (' + (keys.length - opts.limit) + ' more)' : null;
    keys = byCountDesc(counts);
    // The folded bucket is a remainder, not a category — it always sorts last,
    // however large it is, so it never reads as the leading category.
    if (otherKey) { counts[otherKey] = tailSum; keys.push(otherKey); }
  }
  var max = Math.max.apply(null, keys.map(function (k) { return counts[k]; }).concat([1]));
  var wrap = h('div', {});
  keys.forEach(function (k) {
    var pct = Math.max(1, Math.round(counts[k] / max * 100));
    var bar = h('div', { class: 'hbar', style: 'width:' + pct + '%' });
    var row = h('div', {
      class: 'hbar-row' + (opts.onPick ? ' clickable' : '') + (opts.selected === k ? ' sel' : ''),
      tabindex: opts.onPick ? '0' : null,
      role: opts.onPick ? 'button' : null
    }, [
      h('div', { class: 'hbar-label', title: k, text: k }),
      // The bar sits in its own bed so its width% resolves against the plot
      // area alone. Measuring against a flex row that also holds the value
      // label would shrink the longest bars and stop length encoding value.
      h('div', { class: 'hbar-track' }, [
        h('div', { class: 'hbar-bed' }, [bar]),
        h('span', { class: 'hbar-val', text: String(counts[k]) })
      ])
    ]);
    attachTip(row, counts[k] + ' ' + (counts[k] === 1 ? 'employee' : 'employees'), k);
    if (opts.onPick) {
      row.addEventListener('click', function () { opts.onPick(k); });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onPick(k); }
      });
    }
    wrap.appendChild(row);
  });
  if (!keys.length) wrap.appendChild(h('div', { class: 'empty', text: 'No data in the current selection.' }));
  return wrap;
}

// Columns over time — chronological, always ascending regardless of any
// other sort on the page.
function columnChart(counts, labelFn, emphasiseKey) {
  var keys = Object.keys(counts).sort();
  var max = Math.max.apply(null, keys.map(function (k) { return counts[k]; }).concat([1]));
  var chart = h('div', { class: 'col-chart' });
  keys.forEach(function (k) {
    // Emphasis, not a second series: one bar is picked out in the accent hue
    // and the rest share the primary. The emphasised bar is also named in the
    // caption, so the highlight is never the only thing saying which it is.
    var isNow = emphasiseKey && k === emphasiseKey;
    var bar = h('div', { class: 'col-bar' + (isNow ? ' now' : ''),
                         style: 'height:' + Math.max(2, Math.round(counts[k] / max * 130)) + 'px' });
    var item = h('div', { class: 'col-item' + (isNow ? ' now' : ''), tabindex: '0' }, [
      h('div', { class: 'col-num', text: String(counts[k]) }),
      h('div', { class: 'col-slot' }, [bar]),
      h('div', { class: 'col-lab', text: labelFn ? labelFn(k) : k })
    ]);
    attachTip(item, counts[k] + ' ' + (counts[k] === 1 ? 'employee' : 'employees'), labelFn ? labelFn(k) : k);
    chart.appendChild(item);
  });
  return h('div', {}, [chart, h('div', { class: 'chart-base' })]);
}

/* ----------------------------------------- Analytics-page KPI-row pictograms
   Scoped to the top stat row of renderAnalytics() only — see statTile() near
   kpi() below. h() above always calls document.createElement, which cannot
   produce real (namespaced) SVG nodes, so the pictograms/rings here get their
   own tiny namespaced builder rather than reusing h(). */
function svgEl(tag, attrs, kids) {
  var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      n.setAttribute(k, String(v));
    });
  }
  (kids || []).forEach(function (c) { n.appendChild(c); });
  return n;
}

// Solid, single-colour pictograms sized for the stat tiles. Each fill is
// currentColor, so .stat-icon's `color:var(--ink)` (CSS) is what actually
// paints them — no colour is set here.
function iconPeople() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: '28', height: '28', 'aria-hidden': 'true' }, [
    svgEl('circle', { cx: '8', cy: '7.4', r: '3.3' }),
    svgEl('circle', { cx: '17.2', cy: '8.6', r: '2.6' }),
    svgEl('path', { d: 'M1.6 20.6c0-3.9 2.9-6.9 6.4-6.9s6.4 3 6.4 6.9v.4H1.6v-.4z' }),
    svgEl('path', { d: 'M14.9 14.6c2.8.5 4.9 3 4.9 6v.4h-4.2v-1.1c0-1.9-.5-3.7-1.5-5.1.28-.1.55-.17.8-.2z' })
  ]);
}
// Grid-of-squares — reads as "teams / org structure" without a chart library,
// following the same hand-rolled convention as hbarChart/columnChart above.
function iconTeams() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: '28', height: '28', 'aria-hidden': 'true' }, [
    svgEl('rect', { x: '2',  y: '2',  width: '8.4', height: '8.4', rx: '1.6' }),
    svgEl('rect', { x: '13.6', y: '2',  width: '8.4', height: '8.4', rx: '1.6' }),
    svgEl('rect', { x: '2',  y: '13.6', width: '8.4', height: '8.4', rx: '1.6' }),
    svgEl('rect', { x: '13.6', y: '13.6', width: '8.4', height: '8.4', rx: '1.6' })
  ]);
}
// A single person + a chest badge — a deliberately different silhouette from
// iconPeople()'s two-person group, so "hiring managers" never reads as a
// duplicate of "total employees tracked".
function iconManager() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: '28', height: '28', 'aria-hidden': 'true' }, [
    svgEl('circle', { cx: '12', cy: '7', r: '4' }),
    svgEl('path', { d: 'M3.5 21c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5v.4h-17v-.4z' }),
    svgEl('rect', { x: '10.3', y: '15.4', width: '3.4', height: '4', rx: '.6' })
  ]);
}

// Hand-rolled ring meter — no chart library exists in this codebase (see
// hbarChart/columnChart above), so this is built the same way: plain SVG,
// derived at render time from numbers already computed by the caller.
// Track + arc are two stacked circles; stroke-dasharray/-dashoffset reveal
// `pct` of the arc, and rotating the whole SVG -90deg moves the start point
// from 3 o'clock to 12 o'clock, matching the reference screenshot. The
// percentage is placed as an absolutely-positioned HTML label (not SVG
// <text>) because SVG text is hard to make crisp/bold at this size.
function ring(pct, size) {
  size = size || 72;
  var stroke = 6;
  var r = size / 2 - stroke / 2 - 1;
  var c = 2 * Math.PI * r;
  var frac = Math.max(0, Math.min(100, pct)) / 100;
  var mid = size / 2;
  var svg = svgEl('svg', {
    width: size, height: size, viewBox: '0 0 ' + size + ' ' + size,
    style: 'display:block;transform:rotate(-90deg)'
  }, [
    svgEl('circle', { cx: mid, cy: mid, r: r, fill: 'none', stroke: 'var(--hairline)', 'stroke-width': stroke }),
    svgEl('circle', {
      cx: mid, cy: mid, r: r, fill: 'none', stroke: 'var(--accent)', 'stroke-width': stroke,
      'stroke-linecap': 'round', 'stroke-dasharray': c, 'stroke-dashoffset': c * (1 - frac)
    })
  ]);
  var label = h('div', { class: 'stat-ring-label mono-n', text: (Math.round(pct * 10) / 10) + '%' });
  return h('div', { class: 'stat-ring', style: 'width:' + size + 'px;height:' + size + 'px' }, [svg, label]);
}

// Every chart ships a table view: the values stay reachable without hovering.
function chartCard(title, sub, chartNode, counts, colLabel, labelFn, chronological) {
  var tableWrap = h('div', { class: 'hidden' });
  // The table view is the accessible equivalent of the chart, so it has to
  // carry the same ordering the chart uses — chronological for a time series.
  var order = chronological ? Object.keys(counts).sort() : byCountDesc(counts);
  var rows = order.map(function (k) {
    return h('tr', {}, [h('td', { text: labelFn ? labelFn(k) : k }),
                        h('td', { class: 'num', text: String(counts[k]) })]);
  });
  tableWrap.appendChild(h('table', { class: 'dtable' }, [
    h('thead', {}, [h('tr', {}, [h('th', { text: colLabel || 'Category' }), h('th', { class: 'num', text: 'Employees' })])]),
    h('tbody', {}, rows)
  ]));
  var toggle = h('button', { class: 'chart-toggle', text: 'Table view' });
  toggle.addEventListener('click', function () {
    var showTable = chartNode.classList.toggle('hidden');
    tableWrap.classList.toggle('hidden', !showTable);
    toggle.textContent = showTable ? 'Chart view' : 'Table view';
  });
  return h('section', { class: 'card' }, [
    h('div', { class: 'card-h' }, [h('h3', { text: title }), sub ? h('span', { class: 'sub', text: sub }) : null, toggle]),
    h('div', { class: 'card-b' }, [chartNode, tableWrap])
  ]);
}

/* -------------------------------------------------------------- navigation */

var PAGES = [
  { id: 'cohorts',   label: 'Cohorts',           icon: '👥' },
  { id: 'analytics', label: 'Analytics',         icon: '📊' },
  { id: 'sessions',  label: 'Mandatory Sessions', icon: '🗓' },
  { id: 'fast-track', label: 'Fast-Track Programme', icon: '🚀' }
];
function navCount(id) {
  if (id === 'cohorts')   return HIRES.length;
  if (id === 'sessions')  return (DATA.sessions || []).length;
  if (id === 'fast-track') return HIRES.filter(function (x) { return x.pilot; }).length;
  return null;
}
function renderNav() {
  var nav = document.getElementById('nav');
  clear(nav);
  nav.appendChild(h('div', { class: 'nav-label', text: 'Operations' }));
  PAGES.forEach(function (p, i) {
    if (i === 2) nav.appendChild(h('div', { class: 'nav-label', text: 'Programmes' }));
    var n = navCount(p.id);
    var btn = h('button', {
      class: 'nav-item', 'aria-current': state.page === p.id ? 'page' : null,
      onclick: function () { go(p.id); }
    }, [
      h('span', { class: 'ico', 'aria-hidden': 'true', text: p.icon }),
      h('span', { text: p.label }),
      n !== null ? h('span', { class: 'n', text: String(n) }) : null
    ]);
    nav.appendChild(btn);
  });
}
function go(page, opts) {
  state.page = page;
  opts = opts || {};
  var toggle = document.getElementById('nav-toggle');
  if (toggle && toggle.getAttribute('aria-expanded') === 'true') setDrawer(false);
  // Search results replace the whole view, so a stale query would swallow this
  // navigation and the app would look frozen while the URL changed underneath.
  if (state.query) {
    state.query = '';
    var gs = document.getElementById('global-search');
    if (gs) gs.value = '';
  }
  if (opts.reset !== false) { state.cohort = null; state.sessionId = null; }
  if (opts.month !== undefined) state.month = opts.month;
  syncHash();
  render();
  document.getElementById('view').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =========================================================== PAGE: COHORTS */

function monthBar() {
  var idx = ALL_MONTHS.indexOf(state.month);
  var prev = idx > 0 ? ALL_MONTHS[idx - 1] : null;
  var next = idx >= 0 && idx < ALL_MONTHS.length - 1 ? ALL_MONTHS[idx + 1] : null;
  var isAll = state.month === null;

  var bar = h('div', { class: 'month-bar' }, [
    h('button', {
      class: 'mo-btn', disabled: isAll || !prev, title: prev ? fmtMonth(prev) : '',
      onclick: function () { state.month = prev; render(); },
      'aria-label': 'Previous month'
    }, ['‹ ', prev ? MONTHS_SHORT[+prev.split('-')[1] - 1].toUpperCase() : '—']),
    h('div', { class: 'mo-current' }, isAll ? ['All months'] : [
      fmtMonth(state.month).split(' ')[0] + ' ',
      h('span', { class: 'yr', text: state.month.split('-')[0] })
    ]),
    h('button', {
      class: 'mo-btn', disabled: isAll || !next, title: next ? fmtMonth(next) : '',
      onclick: function () { state.month = next; render(); },
      'aria-label': 'Next month'
    }, [next ? MONTHS_SHORT[+next.split('-')[1] - 1].toUpperCase() : '—', ' ›']),
    h('div', { class: 'mo-spacer' }),
    h('button', {
      class: 'chip-btn' + (state.month === currentMonthKey() ? ' on' : ''),
      onclick: function () { state.month = currentMonthKey(); render(); },
      text: 'Current month'
    }),
    h('button', {
      class: 'chip-btn' + (isAll ? ' on' : ''),
      onclick: function () { state.month = isAll ? currentMonthKey() : null; render(); },
      text: 'All months'
    })
  ]);
  return bar;
}

function filterRow(scope) {
  var f = state.filters;
  function sel(key, label, options, allLabel) {
    var s = h('select', {
      'aria-label': label,
      onchange: function (e) { state.filters[key] = e.target.value; render(); }
    }, [h('option', { value: '', text: allLabel || ('All ' + label.toLowerCase()) })]
       .concat(options.map(function (o) {
         return h('option', { value: o, selected: f[key] === o ? true : null, text: o });
       })));
    return s;
  }
  var opts = function (fn, fallback) {
    return uniq(HIRES.map(function (x) { return fn(x) || fallback; }).filter(Boolean)).sort();
  };
  var row = h('div', { class: 'filters' }, [
    h('span', { class: 'fl', text: 'Filter' }),
    h('select', {
      'aria-label': 'Cohort type',
      onchange: function (e) { state.filters.kind = e.target.value; render(); }
    }, [
      h('option', { value: '', text: 'Main + off-cycle' }),
      h('option', { value: 'main',     selected: f.kind === 'main' ? true : null,     text: 'Main cohorts only' }),
      h('option', { value: 'offcycle', selected: f.kind === 'offcycle' ? true : null, text: 'Off-cycle only' }),
      h('option', { value: 'fast-track', selected: f.kind === 'fast-track' ? true : null, text: 'Fast-track programme only' }),
      h('option', { value: 'nonus',    selected: f.kind === 'nonus' ? true : null,    text: 'International only' })
    ]),
    h('select', {
      'aria-label': 'Cohort',
      onchange: function (e) { state.filters.cohort = e.target.value; render(); }
    }, [h('option', { value: '', text: 'All cohorts' })].concat(
      uniq(HIRES.map(function (x) { return x.cohortDate; }).filter(Boolean)).sort()
        .map(function (cd) {
          return h('option', { value: cd, selected: f.cohort === cd ? true : null,
                               text: fmtDay(cd) + ', ' + cd.slice(0, 4) });
        }))),
    h('select', {
      'aria-label': 'Status',
      onchange: function (e) { state.filters.status = e.target.value; render(); }
    }, [
      h('option', { value: '', text: 'Any status' })
    ].concat(['active','next','upcoming','completed','offcycle','attention'].map(function (s) {
      return h('option', { value: s, selected: f.status === s ? true : null,
                           text: (STATUS_META[s] || {}).label || s });
    }))),
    sel('region',    'Region',    opts(function (x) { return x.region; }, 'Unknown')),
    sel('fn',        'Team',      opts(function (x) { return x.fn; }, 'Other'), 'All teams'),
    sel('dept',      'Department', opts(function (x) { return x.department; }, 'Not specified')),
    sel('manager',   'Manager',   opts(function (x) { return x.managerName; }, 'No manager listed')),
    sel('recruiter', 'Recruiter', opts(function (x) { return x.recruiter; }, 'Not listed')),
    sel('hrbp',      'HRBP',      opts(function (x) { return x.hrbp; }, 'Not assigned'), 'All HRBPs'),
    h('span', { class: 'count', text: scope }),
    activeFilterCount() ? h('button', {
      class: 'clear', text: 'Clear ' + activeFilterCount() + ' filter' + (activeFilterCount() === 1 ? '' : 's'),
      onclick: function () {
        Object.keys(state.filters).forEach(function (k) { state.filters[k] = ''; });
        render();
      }
    }) : null
  ]);
  return row;
}

function kpi(value, label, detail, cls) {
  return h('div', { class: 'kpi' + (cls ? ' ' + cls : '') }, [
    h('div', { class: 'v mono-n', text: String(value) }),
    h('div', { class: 'l', text: label }),
    detail ? h('div', { class: 'd', text: detail }) : null
  ]);
}

// A pictogram/ring KPI treatment used ONLY for the top stat row on the
// Analytics page (see renderAnalytics()). Deliberately kept separate from
// kpi() above so every other KPI row in the app (cohorts, sessions, session
// detail, pilot) renders exactly as it did before this change. `body` is
// either statIconBody(...) or ring(...) — see the icon/ring builders above.
function statTile(label, body, caption) {
  return h('div', { class: 'stat-tile' }, [
    h('div', { class: 'stat-l', text: label }),
    body,
    caption ? h('div', { class: 'stat-c', text: caption }) : null
  ]);
}
function statIconBody(iconNode, value) {
  return h('div', { class: 'stat-icon-body' }, [
    h('div', { class: 'stat-icon' }, [iconNode]),
    h('div', { class: 'stat-v mono-n', text: String(value) })
  ]);
}

function cohortRow(entry, kind) {
  var status = kind === 'offcycle' ? 'offcycle' : cohortStatus(entry.date, NEXT_COHORT);
  var pct = groupReadiness(entry.hires);
  var flagged = entry.hires.filter(function (x) { return hireFlags(x).length; }).length;
  var t = d(entry.date);
  var meterCls = pct === 100 ? 'done' : (pct < 34 ? 'low' : '');

  var btn = h('button', {
    class: 'cohort-row',
    onclick: function () { state.cohort = entry.date; state.cohortKind = kind; state.cohortQuery = ''; state.role = null; go('cohorts', { reset: false }); }
  }, [
    h('div', {}, [
      h('div', { class: 'd-day', text: MONTHS_SHORT[t.getMonth()] + ' ' + t.getDate() }),
      h('div', { class: 'd-dow', text: DOW[t.getDay()] })
    ]),
    h('div', {}, [
      h('div', { class: 't-name', text: kind === 'offcycle' ? 'Off-cycle start' : 'Main onboarding cohort' }),
      h('div', { class: 't-meta', text: kind === 'offcycle'
        ? 'Rolls into ' + fmtDay(entry.hires[0].cohortDate) + ' cohort'
        : uniq(entry.hires.map(function (x) { return x.fn; })).slice(0, 3).join(' · ') })
    ]),
    h('div', { class: 'n-hires' }, [String(entry.hires.length), h('small', { text: entry.hires.length === 1 ? 'employee' : 'employees' })]),
    h('div', { class: 'c-status' }, [statusBadge(status),
      flagged ? h('div', { style: 'margin-top:4px' }, [
        h('span', { class: 'st st-attention' }, [h('span', { class: 'dot' }), plural(flagged, 'flag')])
      ]) : null
    ]),
    h('div', { class: 'meter' }, [
      h('div', { class: 'meter-track' }, [h('div', { class: 'meter-fill ' + meterCls, style: 'width:' + pct + '%' })]),
      h('span', { class: 'meter-val', text: pct + '%' })
    ]),
    h('div', { class: 'chev', text: '›' })
  ]);
  attachTip(btn, pct + '% onboarding steps complete',
            entry.hires.length + ' employees · ' + fmtLong(entry.date));
  var item = h('div', { class: 'tl-item is-' + status }, [btn]);
  return item;
}

function renderCohortsPage(view) {
  if (state.month === null && !ALL_MONTHS.length) state.month = ym(TODAY);
  var scoped = applyFilters(HIRES);
  var monthHires = state.month === null ? scoped : hiresInMonth(state.month, scoped);
  var mains = mainCohortsIn(monthHires);
  var offs  = offCycleIn(monthHires);
  var att   = attentionFor(monthHires);
  var attTotal = att.reduce(function (a, r) { return a + r.count; }, 0);

  view.appendChild(monthBar());
  view.appendChild(h('div', { class: 'kpi-row' }, [
    kpi(monthHires.length, 'New employees', state.month === null ? 'Across all months' : fmtMonth(state.month)),
    kpi(mains.length, 'Main cohorts', mains.length ? fmtDay(mains[0].date) + ' – ' + fmtDay(mains[mains.length - 1].date) : 'None scheduled'),
    kpi(offs.reduce(function (a, o) { return a + o.hires.length; }, 0), 'Off-cycle employees',
        offs.length ? plural(offs.length, 'separate date') : 'None'),
    kpi(attTotal, 'Actions pending', attTotal ? 'Across ' + plural(att.length, 'category', 'categories') : 'Nothing outstanding',
        attTotal ? 'attention' : null)
  ]));

  view.appendChild(filterRow(monthHires.length + ' of ' + HIRES.length + ' employees in view'));

  // Main cohorts
  view.appendChild(h('div', { class: 'sec-title' }, [
    'Main cohorts', h('span', { class: 'rule' }), h('span', { class: 'n', text: String(mains.length) })
  ]));
  if (mains.length) {
    var tl = h('div', { class: 'timeline' });
    mains.forEach(function (c) { tl.appendChild(cohortRow(c, 'main')); });
    view.appendChild(tl);
  } else {
    view.appendChild(h('div', { class: 'card' }, [h('div', { class: 'empty' }, [
      h('div', { class: 'big', text: 'No main cohort this month' }),
      'Use the month arrows or switch to All months.'
    ])]));
  }

  // Off-cycle — always its own section, never folded into the cohort list.
  view.appendChild(h('div', { class: 'sec-title' }, [
    'Off-cycle employees', h('span', { class: 'rule' }),
    h('span', { class: 'n', text: String(offs.reduce(function (a, o) { return a + o.hires.length; }, 0)) })
  ]));
  if (offs.length) {
    var grid = h('div', { class: 'oc-grid' });
    offs.forEach(function (o) {
      var b = h('button', {
        class: 'oc-item',
        onclick: function () { state.cohort = o.date; state.cohortKind = 'offcycle'; state.cohortQuery = ''; state.role = null; go('cohorts', { reset: false }); }
      }, [
        h('div', {}, [
          h('div', { class: 'd', text: fmtDay(o.date) }),
          h('div', { class: 'm', text: 'rolls into ' + fmtDay(o.hires[0].cohortDate) })
        ]),
        h('div', { class: 'c', text: String(o.hires.length) })
      ]);
      attachTip(b, plural(o.hires.length, 'off-cycle employee'), fmtLong(o.date));
      grid.appendChild(b);
    });
    view.appendChild(grid);
    view.appendChild(h('p', { class: 'muted', style: 'font-size:11.5px;margin-top:8px',
      text: 'Off-cycle employees join outside the two-week onboarding cadence. They are rolled into the next official cohort for sessions, but their day-1 readiness runs on their own joining date.' }));
  } else {
    view.appendChild(h('div', { class: 'card' }, [h('div', { class: 'empty', text: 'No off-cycle starts in this period.' })]));
  }

  // Hires with no date at all belong to no month, so they would never appear
  // on this page. They are shown regardless of the month selection.
  var undated = applyFilters(HIRES).filter(isUndated);
  if (undated.length) {
    view.appendChild(h('div', { class: 'sec-title' }, [
      'Not scheduled', h('span', { class: 'rule' }), h('span', { class: 'n', text: String(undated.length) })
    ]));
    view.appendChild(h('section', { class: 'card' }, [
      h('div', { class: 'card-h' }, [
        h('h3', { text: 'Employees with no joining or cohort date' }),
        h('span', { class: 'sub', text: 'Shown in every month — they belong to none' })
      ]),
      h('div', { class: 'card-b' }, [h('div', { class: 'hire-list' },
        undated.map(function (x) { return hireCard(x); }))])
    ]));
  }

  // Needs attention
  view.appendChild(h('div', { class: 'sec-title' }, [
    'Needs attention', h('span', { class: 'rule' }), h('span', { class: 'n', text: String(attTotal) })
  ]));
  var naCard = h('section', { class: 'card' }, [
    h('div', { class: 'card-h' }, [
      h('h3', { text: 'What needs doing' }),
      h('span', { class: 'sub', text: 'Employees joining from ' + fmtDay(ACTION_WINDOW_START) + ' onward' })
    ])
  ]);
  if (att.length) {
    var list = h('div', { class: 'na-list' });
    att.sort(function (a, b) {
      var order = { critical: 0, serious: 1, warning: 2 };
      return order[a.rule.sev] - order[b.rule.sev] || b.count - a.count;
    }).forEach(function (r) {
      var names = r.hires.slice(0, 6).map(function (x) { return x.name; }).join(', ')
                + (r.hires.length > 6 ? ' +' + (r.hires.length - 6) + ' more' : '');
      var open = state.attentionRule === r.rule.id;
      list.appendChild(h('button', {
        class: 'na-row sev-' + r.rule.sev + (open ? ' open' : ''),
        'aria-expanded': open ? 'true' : 'false',
        onclick: function () {
          state.attentionRule = open ? null : r.rule.id;
          render();
        }
      }, [
        h('div', { class: 'ic', 'aria-hidden': 'true', text: r.rule.icon }),
        h('div', { class: 'tx' }, [
          h('div', { class: 't' }, [
            r.rule.title,
            // Severity is stated, not only tinted — the glyph is rule-specific.
            h('span', { class: 'sev-tag sev-' + r.rule.sev, text: r.rule.sev })
          ]),
          r.rule.hint ? h('div', { class: 's', text: r.rule.hint }) : null,
          h('div', { class: 'who', text: open ? r.hires.map(function (x) { return x.name; }).join(', ') : names })
        ]),
        h('span', { class: 'ct', text: String(r.count) }),
        h('span', { class: 'chev', 'aria-hidden': 'true', text: open ? '⌃' : '⌄' })
      ]));
    });
    naCard.appendChild(list);
  } else {
    naCard.appendChild(h('div', { class: 'empty' }, [
      h('div', { class: 'big', text: 'Nothing outstanding' }),
      'Every tracked step is complete for employees in this window.'
    ]));
  }
  view.appendChild(naCard);

  // Automation status — informational only.
  view.appendChild(h('div', { class: 'sec-title' }, ['Process automation', h('span', { class: 'rule' })]));
  var a = DATA.automation || { manual: [], automated: [] };
  view.appendChild(h('section', { class: 'card' }, [
    h('div', { class: 'auto-grid' }, [
      h('div', { class: 'auto-col manual' }, [
        h('h4', {}, ['◐ Still manual']),
        h('ul', {}, a.manual.map(function (s) { return h('li', { text: s }); }))
      ]),
      h('div', { class: 'auto-col auto' }, [
        h('h4', {}, ['◉ Automated']),
        h('ul', {}, a.automated.map(function (s) { return h('li', { text: s }); }))
      ])
    ]),
    h('div', { class: 'auto-note',
      text: 'Reference only — this panel describes the process, it does not report live trigger health.' })
  ]));
}

/* ==================================================== PAGE: COHORT DETAIL */

function statusPill(on, label, value) {
  return h('span', { class: 'tag ' + (on ? 'on' : 'off') }, [
    h('span', { 'aria-hidden': 'true', text: on ? '✓' : '–' }),
    label + (value ? ' ' + value : '')
  ]);
}
function copyBtn(value) {
  var b = h('button', { class: 'copy', text: 'Copy', 'aria-label': 'Copy ' + value });
  b.addEventListener('click', function (e) {
    e.stopPropagation();
    var done = function () {
      b.textContent = 'Copied'; b.classList.add('ok');
      setTimeout(function () { b.textContent = 'Copy'; b.classList.remove('ok'); }, 1500);
    };
    var fail = function () {
      b.textContent = 'Press ⌘C'; setTimeout(function () { b.textContent = 'Copy'; }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(fail);
    } else { fail(); }
  });
  return b;
}
// Sheet cells reach the DOM as text everywhere else; href is the one place a
// cell would become a live URL, so the scheme is checked before it is used.
function safeUrl(v) {
  var s = String(v || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

function kvGroup(title, rows) {
  rows = (rows || []).filter(Boolean);
  if (!rows.length) return null;
  return h('div', { class: 'kv-group' }, [
    h('div', { class: 'kv-group-h', text: title }),
    h('div', { class: 'kv-list' }, rows)
  ]);
}
function kv(label, value, cls, extra) {
  return h('div', { class: 'kv' }, [
    h('div', { class: 'k', text: label }),
    h('div', { class: 'v' + (cls ? ' ' + cls : '') }, [value || '—', extra || null])
  ]);
}

function hireCard(hire) {
  var flags = hireFlags(hire);
  // Worst-severity flag drives the card's left-rail colour (critical beats
  // serious beats warning), so the rail is one unambiguous signal.
  var worst = flags.reduce(function (acc, f) {
    var rank = { critical: 3, serious: 2, warning: 1 };
    return (rank[f.sev] || 0) > (rank[acc] || 0) ? f.sev : acc;
  }, null);
  var card = h('div', { class: 'hire' + (worst ? ' flag-' + worst : '') });
  var head = h('button', {
    class: 'hire-h', 'aria-expanded': 'false',
    onclick: function () {
      var open = card.classList.toggle('open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }, [
    h('div', { class: 'avatar', 'aria-hidden': 'true', text: initials(hire) }),
    h('div', {}, [
      h('div', { class: 'nm' }, [
        hire.name,
        hire.pilot ? h('span', { class: 'tag pilot', text: 'FAST-TRACK' }) : null,
        hire.offCycle ? h('span', { class: 'tag warn', text: 'OFF-CYCLE' }) : null,
        flags.length ? h('span', { class: 'st st-attention' }, [h('span', { class: 'dot' }), plural(flags.length, 'flag')]) : null
      ]),
      h('div', { class: 'rl', text: hire.jobTitle || 'Role not recorded' })
    ]),
    h('div', { class: 'cl' }, [h('small', { text: 'Manager' }), hire.managerName || '—']),
    h('div', { class: 'cl hide-md' }, [h('small', { text: 'HRBP' }), hire.hrbp || 'Not assigned']),
    h('div', { class: 'cl loc' }, [h('small', { text: 'Location' }),
      hire.location ? (hire.nonUS ? '🌍 ' : '') + hire.location : 'Missing']),
    h('div', { class: 'pills' }, stepsFor(hire).slice(0, 4).map(function (s) {
      var done = stepDone(hire, s.key);
      // ✓ / – is the non-colour cue: the step glyph alone is identical in both
      // states, so green-vs-grey would be carrying the meaning by itself.
      return h('span', {
        class: 'tag ' + (done ? 'on' : 'off'), title: s.label + ': ' + (done ? 'done' : 'not done'),
        role: 'img', 'aria-label': s.label + ': ' + (done ? 'done' : 'not done')
      }, [h('span', { 'aria-hidden': 'true', text: s.icon + (done ? '✓' : '–') })]);
    })),
    h('div', { class: 'chev', 'aria-hidden': 'true', text: '⌄' })
  ]);
  card.appendChild(head);

  var body = h('div', { class: 'hire-b' }, [
    kvGroup('Role & team', [
      kv('Role', hire.jobTitle),
      kv('Department', hire.department || 'Not specified'),
      kv('Team / function', hire.fn)
    ]),
    kvGroup('People', [
      kv('Manager', hire.managerName, hire.managerName ? '' : 'missing',
         hire.managerEmail ? copyBtn(hire.managerEmail) : null),
      kv('Recruiter', hire.recruiter || 'Not listed'),
      kv('HRBP', hire.hrbp || 'Not assigned')
    ]),
    kvGroup('Location', [
      kv('Location', hire.location || 'Missing', hire.location ? '' : 'missing'),
      kv('Region', hire.region)
    ]),
    kvGroup('Contact', [
      kv('Personal email', hire.personalEmail || 'Missing', hire.personalEmail ? '' : 'missing',
         hire.personalEmail ? copyBtn(hire.personalEmail) : null),
      kv('Work email', hire.workEmail || 'Pending', hire.workEmail ? '' : 'pending',
         hire.workEmail ? copyBtn(hire.workEmail) : null)
    ]),
    // Same fields the collapsed header's icon pills summarise, spelled out in
    // full here -- this is the one place they are shown, so nothing repeats.
    kvGroup('Onboarding', [
      kv('Start date', fmtLong(hire.startDate)),
      kv('Onboarding cohort', hire.cohortDate ? fmtLong(hire.cohortDate) + (hire.offCycle ? ' (rolled in)' : '') : 'Not assigned',
         hire.cohortDate ? '' : 'missing'),
      kv('Onboarding task', hire.ctaStatus || 'Not set'),
      kv('System access', hire.oktaActivated ? fmtDay(hire.oktaActivated) : (hasStarted(hire) ? 'Pending' : 'Not due yet'),
         hire.oktaActivated ? '' : (hasStarted(hire) ? 'missing' : 'pending')),
      kv('Device ship date', hire.deviceShipDate ? fmtDay(hire.deviceShipDate) : 'Not recorded',
         hire.deviceShipDate ? '' : 'pending'),
      hire.pilot ? kv('Fast-track', hire.pilotTrack + (hire.pilotCoach ? ' · ' + hire.pilotCoach : '')) : null,
      safeUrl(hire.googleGroup) ? h('div', { class: 'kv' }, [
        h('div', { class: 'k', text: 'Google group' }),
        h('div', { class: 'v' }, [h('a', { href: safeUrl(hire.googleGroup), target: '_blank',
                                           rel: 'noopener noreferrer', text: 'Open group' })])
      ]) : null
    ])
  ]);
  card.appendChild(body);
  return card;
}

function renderCohortDetail(view) {
  var isOff = state.cohortKind === 'offcycle';
  var inCohort = function (x) {
    return isOff ? (x.offCycle && x.startDate === state.cohort)
                 : (!x.offCycle && x.cohortDate === state.cohort);
  };
  var cohortTotal = HIRES.filter(inCohort).length;
  var all = applyFilters(HIRES).filter(inCohort);
  var status = isOff ? 'offcycle' : cohortStatus(state.cohort, NEXT_COHORT);

  // role chips restore a filter the previous dashboard had lost
  var roles = byCountDesc(tally(all, function (x) { return x.jobTitle || 'Role not recorded'; })).slice(0, 8);
  var shown = all.filter(function (x) {
    if (state.role && (x.jobTitle || 'Role not recorded') !== state.role) return false;
    return searchMatch(x, state.cohortQuery);
  }).sort(function (a, b) { return a.name.localeCompare(b.name); });

  view.appendChild(h('button', {
    class: 'chip-btn', style: 'margin-bottom:16px',
    onclick: function () { state.cohort = null; syncHash(); render(); }
  }, ['‹ Back to ', state.month === null ? 'all months' : fmtMonth(state.month)]));

  var pct = groupReadiness(all);
  view.appendChild(h('div', { class: 'kpi-row' }, [
    kpi(all.length, isOff ? 'Off-cycle employees' : 'Employees in cohort', fmtLong(state.cohort)),
    kpi(pct + '%', 'Onboarding steps complete',
        plural(all.length ? stepsFor(all[0]).length : STEPS.length, 'tracked step')),
    kpi(all.filter(function (x) { return x.nonUS; }).length, 'International employees',
        uniq(all.filter(function (x) { return x.nonUS; }).map(function (x) { return x.country; })).join(', ') || 'All domestic'),
    kpi(attentionCount(all), 'Actions pending', 'In this cohort',
        attentionCount(all) ? 'attention' : null)
  ]));

  view.appendChild(h('div', { style: 'display:flex;align-items:center;gap:10px;margin:18px 0 4px;flex-wrap:wrap' }, [
    h('h3', { style: 'font-size:17px;font-weight:660;letter-spacing:-.3px',
              text: (isOff ? 'Off-cycle start · ' : 'Main onboarding cohort · ') + fmtLong(state.cohort) }),
    statusBadge(status)
  ]));
  // Filters set elsewhere still scope this page, so the control that set them
  // has to be visible here — otherwise the KPIs above quietly report a subset.
  if (activeFilterCount()) {
    view.appendChild(h('p', { class: 'muted', style: 'font-size:12px;margin:6px 0 0',
      text: 'Filters from the cohort view are still applied to this cohort.' }));
    view.appendChild(filterRow(all.length + ' of ' + cohortTotal + ' employees in this cohort'));
  }
  if (isOff && all.length) {
    view.appendChild(h('p', { class: 'muted', style: 'font-size:12px;margin-bottom:10px',
      text: 'These employees join outside the standard cadence and roll into the ' + fmtDay(all[0].cohortDate) + ' cohort for sessions.' }));
  }

  // Toolbar: search + role chips + expand all
  var listWrap = h('div', { class: 'hire-list' });
  var tb = h('div', { class: 'toolbar' }, [
    h('input', {
      type: 'text', id: 'cohort-search',
      placeholder: 'Search this cohort — name, role, manager, HRBP, recruiter…',
      value: state.cohortQuery, 'aria-label': 'Search within cohort',
      oninput: function (e) { state.cohortQuery = e.target.value; render(); }
    }),
    h('span', { class: 'count muted', style: 'font-size:12px',
                text: shown.length + ' of ' + all.length + ' shown' }),
    h('button', {
      class: 'chip-btn', text: 'Expand all',
      onclick: function () {
        listWrap.querySelectorAll('.hire').forEach(function (c) {
          c.classList.add('open');
          c.querySelector('.hire-h').setAttribute('aria-expanded', 'true');
        });
      }
    }),
    h('button', {
      class: 'chip-btn', text: 'Collapse all',
      onclick: function () {
        listWrap.querySelectorAll('.hire').forEach(function (c) {
          c.classList.remove('open');
          c.querySelector('.hire-h').setAttribute('aria-expanded', 'false');
        });
      }
    })
  ]);
  view.appendChild(tb);
  if (roles.length > 1) {
    view.appendChild(h('div', { class: 'role-chips', style: 'margin-bottom:14px' },
      [h('button', {
        class: 'chip-btn' + (state.role ? '' : ' on'), text: 'All roles',
        onclick: function () { state.role = null; render(); }
      })].concat(roles.map(function (r) {
        return h('button', {
          class: 'chip-btn' + (state.role === r ? ' on' : ''), text: r,
          onclick: function () { state.role = state.role === r ? null : r; render(); }
        });
      }))));
  }

  if (shown.length) shown.forEach(function (x) { listWrap.appendChild(hireCard(x)); });
  else listWrap.appendChild(h('div', { class: 'card' }, [h('div', { class: 'empty' }, [
    h('div', { class: 'big', text: 'No employees match' }), 'Clear the search or role filter to see the full cohort.'
  ])]));
  view.appendChild(listWrap);

  // Supporting sections carried over from the old detail view
  var nonUS = all.filter(function (x) { return x.nonUS; });
  var noDevice = all.filter(function (x) { return !x.deviceShipDate || !x.kitOrdered; });
  var mgrs = tally(all, function (x) { return x.managerName || 'No manager listed'; });

  var cols = h('div', { class: 'chart-grid', style: 'margin-top:22px' }, [
    h('section', { class: 'card' }, [
      h('div', { class: 'card-h' }, [h('h3', { text: 'International employees' }),
        h('span', { class: 'sub', text: nonUS.length + ' of ' + all.length })]),
      nonUS.length
        ? h('div', { class: 'card-b' }, [h('table', { class: 'dtable' }, [
            h('thead', {}, [h('tr', {}, [h('th', { text: 'Employee' }), h('th', { text: 'Location' }), h('th', { text: 'Region' })])]),
            h('tbody', {}, nonUS.map(function (x) {
              return h('tr', {}, [h('td', { text: x.name }), h('td', { text: x.location }), h('td', { text: x.region })]);
            }))
          ])])
        : h('div', { class: 'empty', text: 'Everyone in this cohort is based domestically.' })
    ]),
    h('section', { class: 'card' }, [
      h('div', { class: 'card-h' }, [h('h3', { text: 'Device / IT setup' }),
        h('span', { class: 'sub', text: noDevice.length + ' need follow-up' })]),
      h('div', { class: 'card-b' }, [h('table', { class: 'dtable' }, [
        h('thead', {}, [h('tr', {}, [h('th', { text: 'Employee' }), h('th', { text: 'Kit' }),
                                     h('th', { text: 'Ship date' }), h('th', { text: 'Access' })])]),
        h('tbody', {}, all.map(function (x) {
          return h('tr', {}, [
            h('td', { text: x.name }),
            h('td', { text: x.kitOrdered ? 'Ordered' : 'Not ordered' }),
            h('td', { text: x.deviceShipDate ? fmtDay(x.deviceShipDate) : '—' }),
            h('td', { text: x.oktaActivated ? fmtDay(x.oktaActivated) : (hasStarted(x) ? 'Pending' : '—') })
          ]);
        }))
      ])])
    ]),
    h('section', { class: 'card' }, [
      h('div', { class: 'card-h' }, [h('h3', { text: 'Hiring managers' }),
        h('span', { class: 'sub', text: plural(Object.keys(mgrs).length, 'manager') })]),
      h('div', { class: 'card-b' }, [hbarChart(mgrs)])
    ])
  ]);
  view.appendChild(cols);
}

/* ========================================================= PAGE: ANALYTICS */

function renderAnalytics(view) {
  var scoped = applyFilters(HIRES);
  var joined = scoped.filter(function (x) { return x.startDate && x.startDate <= TODAY; });
  var fns   = tally(scoped, function (x) { return x.fn || 'Other'; });
  var depts = tally(scoped, function (x) { return (x.department || '').trim() || 'Not specified'; });
  var regs  = tally(scoped, function (x) { return x.region || 'Unknown'; });
  // Same grouping as `fns` / `regs` above, but keeping the employee names
  // alongside each count for the two data tables below — the tally() helper
  // only returns counts, so this walks the scoped list once more.
  var fnGroups = {};
  scoped.forEach(function (x) {
    var k = x.fn || 'Other';
    (fnGroups[k] || (fnGroups[k] = [])).push(x.name);
  });
  var regGroups = {};
  scoped.forEach(function (x) {
    var k = x.region || 'Unknown';
    (regGroups[k] || (regGroups[k] = [])).push(x.name);
  });
  var hrbps = tally(scoped, function (x) { return (x.hrbp || '').trim() || 'Not assigned'; });
  // One hire can credit several recruiters, exactly as the current dashboard does.
  var recs  = tally(scoped, recruitersOf);
  var months = tally(scoped.filter(function (x) { return !isUndated(x); }),
                     function (x) { return ym(opDate(x)); });
  var mgrs = {};
  scoped.forEach(function (x) {
    var k = (x.managerName || '').trim() || 'No manager listed';
    var m = mgrs[k] || (mgrs[k] = { count: 0, hires: [], months: {} });
    m.count++; m.hires.push(x.name);
    var day = opDate(x);
    if (day) m.months[fmtMonthShort(day).replace(/(\d\d)$/, '20$1')] = true;
  });

  view.appendChild(h('div', { style: 'display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:16px' }, [
    h('h2', { style: 'font-size:22px;font-weight:680;letter-spacing:-.6px', text: 'Onboarding analytics' }),
    h('span', { class: 'muted', style: 'font-size:12px',
      text: 'Reference date ' + fmtLong(TODAY) + ' · ' + scoped.length + ' of ' + HIRES.length + ' employees in scope' })
  ]));

  // Reuses the existing .kpi-row grid (auto-fit, wraps on narrow screens) —
  // only the tile markup inside it is new. "Already joined" / "Starting soon"
  // are the same two counts used everywhere else on this page, just shown as
  // a share of `scoped` instead of a raw count. joinedPct/startingSoonPct are
  // computed as complements of each other (100 - x) rather than two
  // independent divisions, so the two rounded ring percentages always sum to
  // exactly 100 — never 99.9/100.1 from independent rounding.
  var joinedPct = scoped.length ? (joined.length / scoped.length * 100) : 0;
  var startingSoonPct = scoped.length ? (100 - joinedPct) : 0;
  view.appendChild(h('div', { class: 'kpi-row' }, [
    statTile('Total employees tracked', statIconBody(iconPeople(), scoped.length), 'Tracker + pre-May archive.'),
    statTile('Already joined', ring(joinedPct), 'On or before ' + fmtDay(TODAY) + '.'),
    statTile('Starting soon', ring(startingSoonPct), 'After ' + fmtDay(TODAY) + '.'),
    statTile('Teams / functions', statIconBody(iconTeams(), Object.keys(fns).length), 'Distinct teams tracked.'),
    statTile('Hiring managers', statIconBody(iconManager(), Object.keys(mgrs).length), 'Unique hiring managers.')
  ]));

  view.appendChild(filterRow(scoped.length + ' employees in scope'));

  view.appendChild(h('div', { class: 'sec-title' }, ['Hiring over time', h('span', { class: 'rule' })]));
  view.appendChild(chartCard('Employees by month',
    'By operational start month — off-cycle employees counted on their joining date · ' +
    fmtMonthShort(ym(TODAY)) + ' is the current month',
    columnChart(months, fmtMonthShort, ym(TODAY)), months, 'Month', fmtMonthShort, true));

  view.appendChild(h('div', { class: 'sec-title' }, ['Where the employees are', h('span', { class: 'rule' })]));
  view.appendChild(h('div', { class: 'chart-grid' }, [
    chartCard('Employees by team / function', 'Click a team to filter the cohort view',
      hbarChart(fns, {
        selected: state.filters.fn,
        onPick: function (k) { state.filters.fn = state.filters.fn === k ? '' : k; go('cohorts', { month: null }); }
      }), fns, 'Team / function'),
    chartCard('Employees by department', 'Tracker department column',
      hbarChart(depts, {
        limit: 14, selected: state.filters.dept,
        onPick: function (k) {
          if (k.indexOf('Other (') === 0) return;
          state.filters.dept = state.filters.dept === k ? '' : k; go('cohorts', { month: null });
        }
      }), depts, 'Department'),
    chartCard('Employees by region', null,
      hbarChart(regs, {
        selected: state.filters.region,
        onPick: function (k) { state.filters.region = state.filters.region === k ? '' : k; go('cohorts', { month: null }); }
      }), regs, 'Region'),
    chartCard('Employees by HRBP', 'Unassigned kept as its own category',
      hbarChart(hrbps, {
        selected: state.filters.hrbp,
        onPick: function (k) { state.filters.hrbp = state.filters.hrbp === k ? '' : k; go('cohorts', { month: null }); }
      }), hrbps, 'HRBP'),
    chartCard('Employees by recruiter', 'Not listed kept as its own category',
      hbarChart(recs, {
        selected: state.filters.recruiter,
        onPick: function (k) { state.filters.recruiter = state.filters.recruiter === k ? '' : k; go('cohorts', { month: null }); }
      }), recs, 'Recruiter')
  ]));

  // ------------------------------------------------------- manager table
  view.appendChild(h('div', { class: 'sec-title' }, ['Hiring managers', h('span', { class: 'rule' })]));
  var keys = Object.keys(mgrs).filter(function (k) {
    if (!state.mgrQuery) return true;
    var q = state.mgrQuery.toLowerCase();
    return (k + ' ' + mgrs[k].hires.join(' ')).toLowerCase().indexOf(q) !== -1;
  });
  keys.sort(function (a, b) {
    var dir = state.mgrSortDir === 'asc' ? 1 : -1;
    if (state.mgrSort === 'name')  return a.localeCompare(b) * dir;
    if (state.mgrSort === 'month') {
      var am = Object.keys(mgrs[a].months)[0] || '', bm = Object.keys(mgrs[b].months)[0] || '';
      return (d2(am) - d2(bm)) * dir || a.localeCompare(b);
    }
    return (mgrs[a].count - mgrs[b].count) * dir || a.localeCompare(b);
  });
  function d2(label) {           // "Sep 2026" -> sortable number
    var p = label.split(' '); if (p.length < 2) return 0;
    return (+p[1]) * 12 + MONTHS_SHORT.indexOf(p[0]);
  }
  function th(label, key, num) {
    return h('th', {
      class: 'sortable' + (num ? ' num' : ''),
      onclick: function () {
        if (state.mgrSort === key) state.mgrSortDir = state.mgrSortDir === 'asc' ? 'desc' : 'asc';
        else { state.mgrSort = key; state.mgrSortDir = key === 'name' ? 'asc' : 'desc'; }
        render();
      }
    }, [label, state.mgrSort === key ? h('span', { class: 'ar', text: state.mgrSortDir === 'asc' ? '▲' : '▼' }) : null]);
  }
  view.appendChild(h('section', { class: 'card' }, [
    h('div', { class: 'card-h' }, [
      h('h3', { text: 'Employees by manager' }),
      h('span', { class: 'sub', text: keys.length + ' of ' + Object.keys(mgrs).length })
    ]),
    h('div', { class: 'card-b' }, [
      h('div', { class: 'toolbar' }, [
        h('input', {
          type: 'text', id: 'mgr-search', value: state.mgrQuery, 'aria-label': 'Search manager or new employee',
          placeholder: 'Search manager or new employee name…',
          oninput: function (e) { state.mgrQuery = e.target.value; render(); }
        })
      ]),
      h('div', { class: 'mgr-wrap' }, [
        h('table', { class: 'mgr-table' }, [
          h('thead', {}, [h('tr', {}, [th('Manager', 'name'), th('Employees', 'hires', true),
                                       th('Months', 'month'), h('th', { text: 'New employees' })])]),
          h('tbody', {}, keys.length ? keys.map(function (k) {
            return h('tr', {}, [
              h('td', {}, [h('b', { text: k })]),
              h('td', { class: 'num', text: String(mgrs[k].count) }),
              h('td', { text: Object.keys(mgrs[k].months).join(', ') }),
              h('td', { class: 'names', text: mgrs[k].hires.join(', ') })
            ]);
          }) : [h('tr', {}, [h('td', { colspan: '4' }, [h('div', { class: 'empty', text: 'No manager or employee matches that search.' })])])])
        ])
      ])
    ])
  ]));

  // --------------------------------------------- team/function + region tables
  // Same th()/sort pattern as the manager table above, but each table gets
  // its own sort state (state.fnTableSort / state.regTableSort) so sorting
  // one never disturbs the other.
  function makeTh(sortField, dirField) {
    return function (label, key, num) {
      return h('th', {
        class: 'sortable' + (num ? ' num' : ''),
        onclick: function () {
          if (state[sortField] === key) state[dirField] = state[dirField] === 'asc' ? 'desc' : 'asc';
          else { state[sortField] = key; state[dirField] = key === 'name' ? 'asc' : 'desc'; }
          render();
        }
      }, [label, state[sortField] === key ? h('span', { class: 'ar', text: state[dirField] === 'asc' ? '▲' : '▼' }) : null]);
    };
  }
  function sortedKeys(counts, sortField, dirField) {
    var dir = state[dirField] === 'asc' ? 1 : -1;
    return Object.keys(counts).sort(function (a, b) {
      if (state[sortField] === 'name') return a.localeCompare(b) * dir;
      return (counts[a] - counts[b]) * dir || a.localeCompare(b);
    });
  }

  var thFn = makeTh('fnTableSort', 'fnTableSortDir');
  var fnKeys = sortedKeys(fns, 'fnTableSort', 'fnTableSortDir');
  // Tinted card header (--accent-050) separates this table from the chart
  // grid above it. --ink / --ink-3 keep the documented 17.06:1 / 5.19:1
  // contrast on this near-white tint, the same as they clear on --surface.
  view.appendChild(h('section', { class: 'card', style: 'margin-top:16px' }, [
    h('div', { class: 'card-h', style: 'background:var(--accent-050)' }, [
      h('h3', { text: 'Employees by team / function' }),
      h('span', { class: 'sub', text: plural(fnKeys.length, 'team / function') })
    ]),
    h('div', { class: 'card-b' }, [
      h('div', { class: 'mgr-wrap' }, [
        h('table', { class: 'mgr-table' }, [
          h('thead', {}, [h('tr', {}, [thFn('Team / function', 'name'), thFn('Count', 'count', true),
                                       h('th', { text: 'Employees' })])]),
          h('tbody', {}, fnKeys.length ? fnKeys.map(function (k) {
            return h('tr', {}, [
              h('td', {}, [h('b', { text: k })]),
              h('td', { class: 'num', text: String(fns[k]) }),
              h('td', { class: 'names', text: (fnGroups[k] || []).join(', ') })
            ]);
          }) : [h('tr', {}, [h('td', { colspan: '3' }, [h('div', { class: 'empty', text: 'No data in the current selection.' })])])])
        ])
      ])
    ])
  ]));

  var thReg = makeTh('regTableSort', 'regTableSortDir');
  var regKeys = sortedKeys(regs, 'regTableSort', 'regTableSortDir');
  // Second tint (--accent-2-050, the brand-soft cyan wash) so the eye can
  // tell the two new tables apart at a glance; text inside stays on --ink /
  // --ink-3 rather than the cyan ramp, so contrast is unaffected.
  view.appendChild(h('section', { class: 'card', style: 'margin-top:16px' }, [
    h('div', { class: 'card-h', style: 'background:var(--accent-2-050)' }, [
      h('h3', { text: 'Employees by region' }),
      h('span', { class: 'sub', text: plural(regKeys.length, 'region') })
    ]),
    h('div', { class: 'card-b' }, [
      h('div', { class: 'mgr-wrap' }, [
        h('table', { class: 'mgr-table' }, [
          h('thead', {}, [h('tr', {}, [thReg('Region', 'name'), thReg('Count', 'count', true),
                                       h('th', { text: 'Employees' })])]),
          h('tbody', {}, regKeys.length ? regKeys.map(function (k) {
            return h('tr', {}, [
              h('td', {}, [h('b', { text: k })]),
              h('td', { class: 'num', text: String(regs[k]) }),
              h('td', { class: 'names', text: (regGroups[k] || []).join(', ') })
            ]);
          }) : [h('tr', {}, [h('td', { colspan: '3' }, [h('div', { class: 'empty', text: 'No data in the current selection.' })])])])
        ])
      ])
    ])
  ]));
}

/* ========================================================== PAGE: SESSIONS */

function renderSessions(view) {
  var sessions = (DATA.sessions || []).slice();
  var attendance = DATA.attendance || [];
  if (!sessions.length) {
    view.appendChild(h('div', { class: 'card' }, [h('div', { class: 'empty' }, [
      h('div', { class: 'big', text: 'No session data' }),
      'Rebuild operations_data.js to include the Mandatory Sessions sheet.'
    ])]));
    return;
  }
  if (state.sessionId) return renderSessionDetail(view, sessions, attendance);

  var upcoming = sessions.filter(function (s) { return String(s.Date) >= TODAY; });
  var past     = sessions.filter(function (s) { return String(s.Date) < TODAY; });
  var mandatory = sessions.filter(function (s) { return s.Requirement === 'Mandatory'; });
  var attended = attendance.filter(function (a) { return a.Attendance === 'Attended'; }).length;
  var pastSeats = attendance.filter(function (a) {
    var s = sessions.filter(function (x) { return x['Session ID'] === a['Session ID']; })[0];
    return s && String(s.Date) < TODAY;
  }).length;

  view.appendChild(h('div', { class: 'kpi-row' }, [
    kpi(sessions.length, 'Sessions scheduled', plural(mandatory.length, 'mandatory session')),
    kpi(upcoming.length, 'Upcoming', 'From ' + fmtDay(TODAY), 'accent'),
    kpi(past.length, 'Delivered', 'Before ' + fmtDay(TODAY)),
    kpi(pastSeats ? Math.round(attended / pastSeats * 100) + '%' : '—', 'Attendance rate',
        pastSeats ? attended + ' of ' + pastSeats + ' seats' : 'No past sessions')
  ]));

  var tabs = h('div', { class: 'month-bar', style: 'margin-top:18px' }, [
    h('button', {
      class: 'chip-btn' + (state.sessionTab === 'upcoming' ? ' on' : ''), text: 'Upcoming (' + upcoming.length + ')',
      onclick: function () { state.sessionTab = 'upcoming'; render(); }
    }),
    h('button', {
      class: 'chip-btn' + (state.sessionTab === 'past' ? ' on' : ''), text: 'Past (' + past.length + ')',
      onclick: function () { state.sessionTab = 'past'; render(); }
    }),
    h('button', {
      class: 'chip-btn' + (state.sessionTab === 'all' ? ' on' : ''), text: 'All',
      onclick: function () { state.sessionTab = 'all'; render(); }
    })
  ]);
  view.appendChild(tabs);

  // The page is named for mandatory sessions but the catalogue also carries
  // recommended ones; the filter makes which is which an explicit choice.
  view.appendChild(h('div', { class: 'filters' }, [
    h('span', { class: 'fl', text: 'Requirement' }),
    h('select', {
      'aria-label': 'Requirement',
      onchange: function (e) { state.sessionReq = e.target.value; render(); }
    }, [
      h('option', { value: '', text: 'Mandatory + recommended' }),
      h('option', { value: 'Mandatory',   selected: state.sessionReq === 'Mandatory' ? true : null,   text: 'Mandatory only' }),
      h('option', { value: 'Recommended', selected: state.sessionReq === 'Recommended' ? true : null, text: 'Recommended only' })
    ]),
    h('input', {
      type: 'text', id: 'session-search', value: state.sessionQuery,
      style: 'flex:1;min-width:190px;max-width:320px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--r-sm)',
      placeholder: 'Search session or cohort…', 'aria-label': 'Search sessions',
      oninput: function (e) { state.sessionQuery = e.target.value; render(); }
    })
  ]));

  var list = state.sessionTab === 'upcoming' ? upcoming : state.sessionTab === 'past' ? past : sessions;
  list = list.filter(function (s) {
    if (state.sessionReq && s.Requirement !== state.sessionReq) return false;
    if (!state.sessionQuery) return true;
    var q = state.sessionQuery.toLowerCase();
    return (String(s['Session Name']) + ' ' + String(s.Cohort) + ' ' + String(s.Facilitator))
             .toLowerCase().indexOf(q) !== -1;
  });
  list = list.slice().sort(function (a, b) {
    return state.sessionTab === 'past' ? String(b.Date).localeCompare(String(a.Date))
                                       : String(a.Date).localeCompare(String(b.Date));
  });

  var card = h('section', { class: 'card' }, [
    h('div', { class: 'card-h' }, [
      h('h3', { text: 'Sessions' }),
      h('span', { class: 'sub', text: plural(list.length, 'session') })
    ])
  ]);
  var body = h('div', {});
  list.forEach(function (s) {
    var att = attendance.filter(function (a) { return a['Session ID'] === s['Session ID']; });
    var isPast = String(s.Date) < TODAY;
    var ok = att.filter(function (a) { return a.Attendance === 'Attended'; }).length;
    var reg = att.filter(function (a) { return a.Attendance === 'Registered'; }).length;
    body.appendChild(h('button', {
      class: 'sess-row',
      onclick: function () { state.sessionId = s['Session ID']; render(); }
    }, [
      h('div', {}, [h('div', { class: 'sd', text: fmtDay(String(s.Date)) }),
                    h('div', { class: 'st-time', text: String(s.Time || '') })]),
      h('div', {}, [h('div', { class: 'sn', text: String(s['Session Name']) }),
                    h('div', { class: 'sf', text: String(s.Facilitator || '') + ' · ' + String(s['Duration (min)'] || '') + ' min' })]),
      h('div', { class: 's-hide' }, [h('span', { class: 'tag' + (s.Requirement === 'Mandatory' ? ' warn' : ''), text: String(s.Requirement) })]),
      h('div', { class: 's-hide s-cohort muted', style: 'font-size:12px', text: 'Cohort ' + fmtDay(String(s.Cohort)) }),
      h('div', { class: 's-hide muted', style: 'font-size:12px',
                 text: isPast ? ok + ' / ' + att.length + ' attended' : reg + ' / ' + att.length + ' registered' }),
      h('div', {}, [statusBadge(isPast ? 'completed' : 'upcoming')])
    ]));
  });
  if (!list.length) body.appendChild(h('div', { class: 'empty', text: 'No sessions in this tab.' }));
  card.appendChild(body);
  view.appendChild(card);
}

function renderSessionDetail(view, sessions, attendance) {
  var s = sessions.filter(function (x) { return x['Session ID'] === state.sessionId; })[0];
  if (!s) { state.sessionId = null; return renderSessions(view); }
  // Derive the audience from cohort membership — the same hire array every
  // other page uses — then join the attendance sheet onto it. Reading the
  // attendance sheet alone would hide any hire that has no row in it.
  var rows = attendance.filter(function (a) { return a['Session ID'] === state.sessionId; });
  var byEmail = {};
  rows.forEach(function (a) { byEmail[String(a['Work Email']).toLowerCase()] = a; });
  var cohortHires = HIRES.filter(function (x) { return x.cohortDate === String(s.Cohort); });
  var att = cohortHires.map(function (x) {
    var a = byEmail[(x.workEmail || '').toLowerCase()];
    return { Attendee: x.name, 'Work Email': x.workEmail,
             Attendance: a ? String(a.Attendance) : 'No record', hire: x };
  });
  // Anyone in the attendance sheet who is not in the cohort is still shown.
  rows.forEach(function (a) {
    var e = String(a['Work Email']).toLowerCase();
    if (!cohortHires.some(function (x) { return (x.workEmail || '').toLowerCase() === e; })) {
      att.push({ Attendee: String(a.Attendee), 'Work Email': String(a['Work Email']),
                 Attendance: String(a.Attendance), hire: null });
    }
  });
  var isPast = String(s.Date) < TODAY;
  var counts = tally(att, function (a) { return String(a.Attendance); });

  view.appendChild(h('button', {
    class: 'chip-btn', style: 'margin-bottom:16px',
    onclick: function () { state.sessionId = null; syncHash(); render(); }
  }, ['‹ Back to sessions']));

  // The attendance sheet carries five states. Excused used to be counted in
  // "Invited" and nowhere else, so the KPI row did not add up.
  var okN   = isPast ? (counts.Attended || 0) : (counts.Registered || 0);
  var badN  = isPast ? (counts.Absent || 0)   : (counts['Not registered'] || 0);
  var exN   = counts.Excused || 0;
  var other = att.length - okN - badN - exN;
  view.appendChild(h('div', { class: 'kpi-row' }, [
    kpi(att.length, 'Invited', String(s['Session Name'])),
    kpi(okN, isPast ? 'Attended' : 'Registered', fmtLong(String(s.Date))),
    kpi(badN, isPast ? 'Absent' : 'Not registered', 'Needs follow-up', badN ? 'attention' : null),
    kpi(exN, 'Excused', other ? other + ' other / no record' : 'Approved absence')
  ]));
  view.appendChild(h('p', { class: 'muted', style: 'font-size:11.5px;margin:8px 0 0',
    text: String(s.Requirement) + ' · ' + String(s.Facilitator || 'No facilitator recorded') +
          ' · ' + String(s['Duration (min)'] || '?') + ' min' }));

  view.appendChild(h('div', { style: 'display:flex;align-items:center;gap:10px;margin:18px 0 12px;flex-wrap:wrap' }, [
    h('h3', { style: 'font-size:17px;font-weight:660;letter-spacing:-.3px', text: String(s['Session Name']) }),
    statusBadge(isPast ? 'completed' : 'upcoming'),
    safeUrl(s['Join Link']) ? h('a', { href: safeUrl(s['Join Link']), target: '_blank',
                                       rel: 'noopener noreferrer',
                                       style: 'font-size:12px', text: 'Join link ↗' }) : null
  ]));

  view.appendChild(h('section', { class: 'card' }, [
    h('div', { class: 'card-h' }, [h('h3', { text: 'Who needs to attend' }),
      h('span', { class: 'sub', text: 'Cohort ' + fmtLong(String(s.Cohort)) })]),
    h('div', { class: 'card-b' }, [h('table', { class: 'dtable' }, [
      h('thead', {}, [h('tr', {}, [h('th', { text: 'Attendee' }), h('th', { text: 'Work email' }), h('th', { text: 'Status' })])]),
      h('tbody', {}, att.map(function (a) {
        var good = a.Attendance === 'Attended' || a.Attendance === 'Registered';
        return h('tr', {}, [
          h('td', { text: String(a.Attendee) + (a.hire ? '' : ' (not in cohort)') }),
          h('td', { text: String(a['Work Email'] || '—') }),
          h('td', {}, [h('span', { class: 'tag ' + (good ? 'on' : 'warn') }, [
            h('span', { 'aria-hidden': 'true', text: good ? '✓' : '!' }), String(a.Attendance)])])
        ]);
      }))
    ])])
  ]));
}

/* ========================================================= PAGE: Fast-Track */

function renderFastTrack(view) {
  var members = HIRES.filter(function (x) { return x.pilot; });
  if (!members.length) {
    view.appendChild(h('div', { class: 'card' }, [h('div', { class: 'empty' }, [
      h('div', { class: 'big', text: 'No fast-track members' }),
      'No employee in the tracker matched the fast-track membership sheet.'
    ])]));
    return;
  }
  var joined = members.filter(function (x) { return x.startDate && x.startDate <= TODAY; });
  var tracks = tally(members, function (x) { return x.pilotTrack || 'Unassigned'; });
  var coaches = tally(members, function (x) { return x.pilotCoach || 'Unassigned'; });

  view.appendChild(h('div', { style: 'display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:6px' }, [
    h('h2', { style: 'font-size:22px;font-weight:680;letter-spacing:-.6px', text: 'Fast-Track Programme' }),
    h('span', { class: 'tag pilot', text: 'SEPARATE PROGRAMME' })
  ]));
  view.appendChild(h('p', { class: 'muted', style: 'font-size:12.5px;margin-bottom:18px',
    text: 'A separate programme running alongside the standard onboarding cadence. Membership is tracked on its own sheet and matched to employees by work email.' }));

  view.appendChild(h('div', { class: 'kpi-row' }, [
    kpi(members.length, 'Members'),
    kpi(joined.length, 'Joined', 'On or before ' + fmtDay(TODAY)),
    kpi(members.length - joined.length, 'Upcoming', 'Yet to start'),
    kpi(Object.keys(tracks).length, 'Tracks', Object.keys(tracks).join(' · '))
  ]));

  view.appendChild(h('div', { class: 'sec-title' }, ['Programme shape', h('span', { class: 'rule' })]));
  view.appendChild(h('div', { class: 'chart-grid' }, [
    chartCard('Members by track', null, hbarChart(tracks), tracks, 'Track'),
    chartCard('Members by coach', null, hbarChart(coaches), coaches, 'Coach'),
    chartCard('Members by team / function', null,
      hbarChart(tally(members, function (x) { return x.fn; })),
      tally(members, function (x) { return x.fn; }), 'Team')
  ]));

  view.appendChild(h('div', { class: 'sec-title' }, [
    'Members', h('span', { class: 'rule' }), h('span', { class: 'n', text: String(members.length) })
  ]));
  view.appendChild(h('section', { class: 'card' }, [
    h('div', { class: 'card-b' }, [h('div', { class: 'mgr-wrap' }, [
      h('table', { class: 'mgr-table' }, [
        h('thead', {}, [h('tr', {}, [h('th', { text: 'Member' }), h('th', { text: 'Role' }),
                                     h('th', { text: 'Track' }), h('th', { text: 'Coach' }),
                                     h('th', { text: 'Started' }), h('th', { text: 'Status' })])]),
        h('tbody', {}, members.slice().sort(function (a, b) {
          return a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name);
        }).map(function (x) {
          return h('tr', {}, [
            h('td', {}, [h('b', { text: x.name })]),
            h('td', { class: 'names', text: x.jobTitle }),
            h('td', { text: x.pilotTrack || '—' }),
            h('td', { text: x.pilotCoach || '—' }),
            h('td', { text: fmtDay(x.startDate) }),
            h('td', {}, [h('span', { class: 'tag ' + (x.pilotStatus === 'Completed' ? 'on' : ''), text: x.pilotStatus || '—' })])
          ]);
        }))
      ])
    ])])
  ]));

  view.appendChild(h('div', { style: 'margin-top:16px' }, [
    h('button', {
      class: 'chip-btn on', text: 'View fast-track members in the cohort view →',
      onclick: function () { state.filters.kind = 'fast-track'; go('cohorts', { month: null }); }
    })
  ]));
}

/* ===================================================== PAGE: SEARCH RESULTS */

function renderSearch(view) {
  var q = state.query.trim();
  var hits = HIRES.filter(function (x) { return searchMatch(x, q); });
  view.appendChild(h('div', { style: 'margin-bottom:14px' }, [
    h('h2', { style: 'font-size:20px;font-weight:670;letter-spacing:-.5px', text: 'Results for “' + q + '”' }),
    h('span', { class: 'muted', style: 'font-size:12.5px', text: plural(hits.length, 'matching employee') })
  ]));
  if (!hits.length) {
    view.appendChild(h('div', { class: 'card' }, [h('div', { class: 'empty' }, [
      h('div', { class: 'big', text: 'Nothing found' }),
      'Search covers employee, manager, recruiter, HRBP, role, department, location and email.'
    ])]));
    return;
  }
  // Also surface which people-fields matched, so a search for a manager reads
  // as "this manager's hires" rather than an unexplained list.
  ['managerName', 'recruiter', 'hrbp'].forEach(function (field) {
    var names = uniq(hits.map(function (x) { return x[field]; }).filter(function (v) {
      return v && v.toLowerCase().indexOf(q.toLowerCase()) !== -1;
    }));
    if (!names.length) return;
    var lbl = field === 'managerName' ? 'Manager' : field === 'recruiter' ? 'Recruiter' : 'HRBP';
    view.appendChild(h('div', { class: 'sec-title' }, [lbl + ' match', h('span', { class: 'rule' })]));
    names.forEach(function (n) {
      var own = HIRES.filter(function (x) { return x[field] === n; });
      var fkey = field === 'managerName' ? 'manager' : field;
      view.appendChild(h('button', {
        class: 'sr-item',
        onclick: function () {
          Object.keys(state.filters).forEach(function (k) { state.filters[k] = ''; });
          state.filters[fkey] = n;
          go('cohorts', { month: null });
        }
      }, [
        h('div', {}, [h('div', { class: 'nm', text: n }), h('div', { class: 'mt', text: lbl })]),
        h('div', { class: 'rt', text: plural(own.length, 'employee') + '  ›' })
      ]));
    });
  });

  view.appendChild(h('div', { class: 'sec-title' }, ['Employees', h('span', { class: 'rule' }),
    h('span', { class: 'n', text: String(hits.length) })]));
  var list = h('div', { class: 'hire-list' });
  hits.slice().sort(function (a, b) { return (a.startDate || '').localeCompare(b.startDate || ''); })
      .forEach(function (x) { list.appendChild(hireCard(x)); });
  view.appendChild(list);
}

/* --------------------------------------------------------------- routing */
// The hash keeps a view shareable and survives a reload. It is written on
// navigation and read on load / back-button, never in the middle of a render.
var muteHash = false;
function syncHash() {
  if (muteHash) return;
  var parts = ['#', state.page];
  if (state.page === 'cohorts' && state.cohort) parts.push(state.cohortKind, state.cohort);
  if (state.page === 'sessions' && state.sessionId) parts.push(state.sessionId);
  var next = parts.join('/').replace('#/', '#');
  if (location.hash !== next) {
    muteHash = true;
    location.hash = next;
    setTimeout(function () { muteHash = false; }, 0);
  }
}
function readHash() {
  var raw = (location.hash || '').replace(/^#\/?/, '');
  if (!raw) return false;
  var p = raw.split('/').filter(Boolean);
  var page = p[0];
  if (['cohorts', 'analytics', 'sessions', 'fast-track'].indexOf(page) === -1) return false;
  state.page = page;
  state.cohort = null; state.sessionId = null;
  if (page === 'cohorts' && p[2]) {
    state.cohortKind = p[1] === 'offcycle' ? 'offcycle' : 'main';
    state.cohort = p[2];
    state.month = ym(p[2]);
  }
  if (page === 'sessions' && p[1]) state.sessionId = p[1];
  return true;
}

/* ============================================================ render / init */

function render() {
  // render() rebuilds #view wholesale, which destroys the element the user is
  // typing into. Remember where the caret was and put it back afterwards,
  // otherwise every keystroke in a search box drops focus to <body>.
  var active = document.activeElement;
  var focusId = active && active.id && active.id !== 'global-search' ? active.id : null;
  var caret = null;
  if (focusId) { try { caret = active.selectionStart; } catch (e) { caret = null; } }

  renderNav();
  var view = document.getElementById('view');
  clear(view);

  var titles = { cohorts: 'Cohorts', analytics: 'Analytics', sessions: 'Mandatory Sessions', 'fast-track': 'Fast-Track Programme' };
  var crumbs = {
    cohorts: 'Who is joining, and what needs attention',
    analytics: 'Trends across the whole hiring population',
    sessions: 'Scheduled sessions, audiences and attendance',
    'fast-track': 'A separate fast-track programme'
  };

  if (state.query.trim()) {
    document.getElementById('page-title').textContent = 'Search';
    document.getElementById('page-crumb').textContent = 'Across every employee in the tracker';
    renderSearch(view);
    return;
  }
  document.getElementById('page-title').textContent =
    state.page === 'cohorts' && state.cohort ? 'Cohort detail' : titles[state.page];
  document.getElementById('page-crumb').textContent =
    state.page === 'cohorts' && state.cohort ? fmtLong(state.cohort) : crumbs[state.page];

  if (state.page === 'cohorts')        state.cohort ? renderCohortDetail(view) : renderCohortsPage(view);
  else if (state.page === 'analytics') renderAnalytics(view);
  else if (state.page === 'sessions')  renderSessions(view);
  else if (state.page === 'fast-track') renderFastTrack(view);

  restoreFocus(focusId, caret);
}

function restoreFocus(focusId, caret) {
  if (!focusId) return;
  var n = document.getElementById(focusId);
  if (!n) return;
  n.focus();
  if (caret !== null && n.setSelectionRange) {
    try { n.setSelectionRange(caret, caret); } catch (e) { /* not a text input */ }
  }
}

// The five brand colours can be overridden from demo_config.json, which flows
// through the build into the payload. Only these five are overridable; every
// derived step — hover tints, ink levels, the cyan ramp — stays in the
// stylesheet so a bad override cannot quietly break contrast everywhere.
var THEME_VARS = {
  primary: '--brand-primary', accent: '--brand-accent', deep: '--brand-deep',
  background: '--brand-bg', soft: '--brand-soft'
};
function applyTheme(theme) {
  if (!theme) return;
  var root = document.documentElement;
  Object.keys(THEME_VARS).forEach(function (k) {
    var v = theme[k];
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) {
      root.style.setProperty(THEME_VARS[k], v);
    }
  });
}

/* Nav drawer: closed by default, opens on demand (toggle, or Escape/scrim to
   close) rather than sitting permanently on screen. */
function setDrawer(open) {
  var sidebar = document.getElementById('sidebar');
  var scrim = document.getElementById('scrim');
  var toggle = document.getElementById('nav-toggle');
  sidebar.classList.toggle('open', open);
  scrim.classList.toggle('show', open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    var first = sidebar.querySelector('.nav-item');
    if (first) first.focus();
  } else {
    toggle.focus();
  }
}
function initDrawer() {
  var toggle = document.getElementById('nav-toggle');
  var scrim = document.getElementById('scrim');
  toggle.addEventListener('click', function () {
    setDrawer(toggle.getAttribute('aria-expanded') !== 'true');
  });
  scrim.addEventListener('click', function () { setDrawer(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setDrawer(false);
  });
}
function init() {
  applyTheme(DATA.theme);
  initDrawer();
  if (!HIRES.length) {
    document.getElementById('view').appendChild(h('div', { class: 'card' }, [h('div', { class: 'empty' }, [
      h('div', { class: 'big', text: 'No data loaded' }),
      'operations_data.js is missing or empty. Run: python3 build_nho_data.py'
    ])]));
    return;
  }
  state.month = currentMonthKey();
  readHash();
  window.addEventListener('hashchange', function () {
    if (muteHash) return;
    if (readHash()) render();
  });
  document.getElementById('foot-ref').textContent = fmtDay(TODAY) + ', ' + TODAY.slice(0, 4);
  document.getElementById('foot-src').textContent = HIRES.length + ' employees · ' + (DATA.sessions || []).length + ' sessions';
  document.getElementById('ref-chip').textContent = 'Reference date · ' + fmtLong(TODAY);

  var gs = document.getElementById('global-search');
  var t;
  gs.addEventListener('input', function (e) {
    clearTimeout(t);
    var v = e.target.value;
    t = setTimeout(function () { state.query = v; render(); }, 140);
  });
  gs.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.target.value = ''; state.query = ''; render(); }
  });
  render();
}
document.addEventListener('DOMContentLoaded', init);

// Test hook: the pure rules are exported when this file is required from Node
// (see test_dashboard_logic.js). Browsers have no `module`, so this is inert there.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { addDays, ym, fmtDay, fmtMonthShort, cohortStatus, searchMatch,
                     tally, byCountDesc, readiness, groupReadiness, opDate,
                     trackedFor, hireFlags, attentionFor, ATTENTION_RULES, STEPS };
}
})();
