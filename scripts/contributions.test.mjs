import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarize, render} from './contributions.mjs';

const start = new Date('2025-10-21T00:00:00Z');
const end = new Date('2026-10-20T14:00:00Z');
const days = Array.from({length:365}, (_, i) => ({date:new Date(+start+i*86400000).toISOString().slice(0,10), contributionCount:i===335?7:1}));
const collection = () => ({restrictedContributionsCount:200, contributionCalendar:{totalContributions:371,weeks:[{contributionDays:structuredClone(days)}]}});

test('uses the calendar once, including restricted counts, and exactly 30 dates', () => {
  const stats = summarize(collection(), start, end, false);
  assert.equal(stats.total,371);
  assert.equal(stats.last30,36);
  assert.equal(stats.months.reduce((sum,m)=>sum+m.count,0),371);
  assert.match(stats.coverage,/shared private/);
  assert.match(render(stats,end),/371/);
});
test('rejects inconsistent, incomplete, duplicate, and negative calendars', () => {
  for (const mutate of [c=>c.contributionCalendar.totalContributions++,c=>c.contributionCalendar.weeks[0].contributionDays.pop(),c=>c.contributionCalendar.weeks[0].contributionDays.push(days[0]),c=>c.contributionCalendar.weeks[0].contributionDays[0].contributionCount=-1]) {
    const c=collection(); mutate(c); assert.throws(()=>summarize(c,start,end,false));
  }
});
test('does not claim private coverage from zero restricted contributions', () => {
  const c=collection(); c.restrictedContributionsCount=0;
  assert.match(summarize(c,start,end,false).coverage,/unverified/);
  assert.match(summarize(c,start,end,true).coverage,/read:user/);
});
