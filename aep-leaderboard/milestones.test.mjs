import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const logic=html.match(/<script id="milestone-logic">([\s\S]*?)<\/script>/)[1];
const milestoneFor=vm.runInNewContext(logic+';milestoneFor');

test('targets advance at the submitted threshold and restart progress',()=>{
  const cases=[
    [0,'Holiday Break',80,65,0], [1,'Holiday Break',80,65,1/80*100],
    [79,'Holiday Break',80,65,79/80*100],
    [80,'Aruba Trip',125,100,0], [81,'Aruba Trip',125,100,1/45*100],
    [124,'Aruba Trip',125,100,44/45*100],
    [125,'$1,000 Flight Credit',160,125,0], [126,'$1,000 Flight Credit',160,125,1/35*100],
    [159,'$1,000 Flight Credit',160,125,34/35*100],
    [160,'$2,000 Bonus',200,150,0], [161,'$2,000 Bonus',200,150,1/40*100],
    [199,'$2,000 Bonus',200,150,39/40*100],
    [200,'$2,000 Bonus',200,150,100], [240,'$2,000 Bonus',200,150,100]
  ];
  for(const [total,name,target,successful,percent] of cases){
    const m=milestoneFor(total);
    assert.equal(m.name,name,'reward at '+total);
    assert.equal(m.title,name+' — '+target+' submitted target');
    assert.equal(m.note,'Qualify with '+successful+' successful applications.');
    assert.ok(Math.abs(m.percent-percent)<1e-9,'progress at '+total);
  }
});

test('each submission advances progress within its current stage',()=>{
  for(const [low,high] of [[0,80],[80,125],[125,160],[160,200]]){
    for(let total=low;total<high-1;total++){
      assert.ok(milestoneFor(total+1).percent>milestoneFor(total).percent);
    }
  }
});

test('only the active milestone is rendered with its qualification and accessible progress',()=>{
  const helpers=html.slice(html.indexOf('function esc('),html.indexOf('async function load(){'));
  const render=vm.runInNewContext(logic+'\n'+helpers+';renderMilestone');
  for(const total of [0,80,125,160,200]){
    const m=milestoneFor(total), markup=render(total);
    assert.equal((markup.match(/class="milestone-title"/g)||[]).length,1);
    assert.ok(markup.includes('<strong class="milestone-title">'+m.title+'</strong>'));
    assert.ok(markup.includes('<em class="milestone-note">'+m.note+'</em>'));
    assert.ok(markup.includes('aria-valuenow="'+m.segmentApps+'"'));
    assert.ok(markup.includes('style="width:'+m.percent+'%"'));
  }
});

test('invalid or negative totals cannot create invalid progress',()=>{
  for(const value of [null,undefined,'invalid',-1,Infinity]){
    assert.equal(milestoneFor(value).percent,0);
    assert.equal(milestoneFor(value).target,80);
  }
});
