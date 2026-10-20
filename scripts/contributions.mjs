import {writeFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const DAY = 86400000;
const date = value => value.toISOString().slice(0,10);
const integer = n => Number.isSafeInteger(n) && n >= 0;

export function summarize(collection, start, end, ownerReadUser) {
  const calendar = collection.contributionCalendar;
  const days = calendar.weeks.flatMap(w=>w.contributionDays);
  const expected = Math.round((Date.parse(date(end))- +start)/DAY)+1;
  if (days.length !== expected || !integer(calendar.totalContributions) || !integer(collection.restrictedContributionsCount)) throw Error('Invalid calendar');
  const seen = new Set();
  const months = new Map();
  let total=0, last30=0;
  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !integer(day.contributionCount) || seen.has(day.date) || day.date < date(start) || day.date > date(end)) throw Error('Invalid day');
    seen.add(day.date);
    total+=day.contributionCount;
    if (day.date >= date(new Date(Date.parse(date(end))-29*DAY))) last30+=day.contributionCount;
    const month=day.date.slice(0,7);
    months.set(month,(months.get(month)||0)+day.contributionCount);
  }
  if (total !== calendar.totalContributions || collection.restrictedContributionsCount>total) throw Error('Inconsistent totals');
  for (let i=0;i<expected;i++) if (!seen.has(date(new Date(+start+i*DAY)))) throw Error('Missing day');
  return {from:date(start),to:date(end),total,last30,months:[...months].sort().map(([month,count])=>({month,count})),coverage:ownerReadUser?'Public + private contributions returned to owner (read:user)':collection.restrictedContributionsCount>0?'Public + shared private contributions':'API-visible contributions; private coverage unverified'};
}

export function render(stats, updated) {
  const xml = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const text = (x,y,s,size=15,color='#b6c8db')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${xml(s)}</text>`;
  const max=Math.max(1,...stats.months.map(m=>m.count));
  const width=960/stats.months.length;
  const bars=stats.months.map((m,i)=>{
    const x=90+i*width, h=m.count/max*125;
    const label=new Date(m.month+'-01T00:00:00Z').toLocaleString('en-US',{month:'short',timeZone:'UTC'});
    return `<rect x="${x}" y="${350-h}" width="${width-18}" height="${h}" rx="4" fill="#7de7cd"><title>${m.month}: ${m.count} contributions</title></rect>`+text(x,375,label,13)+text(x,392,m.month.slice(0,4),11)+text(x,Math.max(213,342-h),m.count,12);
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="490" viewBox="0 0 1120 490" role="img" aria-labelledby="title description">
<title id="title">GitHub contribution activity</title><desc id="description">${xml(stats.total)} contributions from ${stats.from} to ${stats.to}; ${stats.last30} in the last 30 calendar days. ${xml(stats.coverage)}. First and last months may be partial.</desc>
<rect x="1" y="1" width="1118" height="488" rx="18" fill="#0b1220" stroke="#294055"/>
<g font-family="Arial, Helvetica, sans-serif">${text(40,48,'GITHUB ACTIVITY',19,'#f2f6ff')}${text(40,78,stats.from+' - '+stats.to+' | 365 calendar days',14)}
${text(40,128,stats.total.toLocaleString('en-US'),38,'#7de7cd')}${text(40,155,'Contributions | 365 days')}
${text(450,128,stats.last30.toLocaleString('en-US'),38,'#7de7cd')}${text(450,155,'Contributions | last 30 days')}
${text(40,187,stats.coverage,14)}${bars}
${text(40,429,'Monthly totals | First / last months may be partial | Today is still in progress',13)}
${text(40,452,'GitHub contribution rules apply. Repository names and source code are never queried.',13)}
${text(40,475,'Updated '+updated.toISOString().slice(0,16).replace('T',' ')+' UTC | Snapshot; scheduled every 6 hours',12)}</g></svg>\n`;
}

async function main() {
  const token=process.env.CONTRIBUTIONS_TOKEN;
  if (!token) throw Error('Missing token');
  const ownerToken=process.env.OWNER_TOKEN==='true';
  const end=new Date();
  const start=new Date(Date.parse(date(end))-364*DAY);
  const query=`query($from:DateTime!,$to:DateTime!) {
    viewer { login }
    user(login:"skyfelongrock") { contributionsCollection(from:$from,to:$to) {
      restrictedContributionsCount
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    } }
  }`;
  const response=await fetch('https://api.github.com/graphql',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','User-Agent':'profile-contribution-calendar'},
    body:JSON.stringify({query,variables:{from:start.toISOString(),to:end.toISOString()}}),signal:AbortSignal.timeout(30000)
  });
  if (!response.ok) throw Error('GitHub request failed');
  const body=await response.json();
  if (body.errors?.length || !body.data?.user) throw Error('Incomplete GraphQL response');
  const scopes=(response.headers.get('x-oauth-scopes')||'').split(',').map(s=>s.trim());
  if (ownerToken && (body.data.viewer.login!=='skyfelongrock' || !scopes.some(s=>s==='read:user'||s==='user'))) throw Error('Owner read:user token required');
  const stats=summarize(body.data.user.contributionsCollection,start,end,ownerToken);
  await mkdir('assets',{recursive:true});
  // Only the aggregate SVG is persisted. No API payload, repo data, or credentials.
  await writeFile('assets/github-activity.svg',render(stats,end));
  console.log('Validated contribution calendar; generated aggregate SVG.');
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(()=>{console.error('Contribution update failed. Previous SVG retained. Check token permissions and profile contribution settings.');process.exitCode=1;});
}
