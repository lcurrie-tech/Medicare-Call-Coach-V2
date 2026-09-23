import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const logic=html.match(/<script id="celebration-logic">([\s\S]*?)<\/script>/)[1];
const Feed=vm.runInNewContext(logic+';CelebrationFeed');
const event=(id,agentName='Maritza Aparicio')=>({id,agentName});
const page=(cursor,events=[],hasMore=false)=>({cursor,events,hasMore});

test('all inline scripts parse',()=>{
  for(const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
});
test('opening and refreshing do not announce historical applications',()=>{
  const feed=new Feed();
  assert.equal(feed.accept(page(42,[event(41),event(42)])).length,0);
  assert.equal(feed.accept(page(42,[event(42)])).length,0);
  const fresh=new Feed();
  assert.equal(fresh.accept(page(43,[event(43)])).length,0);
});
test('every new application is queued once, including multiple for one agent',()=>{
  const feed=new Feed();feed.accept(page(42));
  const result=feed.accept(page(45,[event(45),event(44,'Fernando Carrillo'),event(43),event(43)]));
  assert.deepEqual(Array.from(result,e=>e.id),[43,44,45]);
  assert.equal(feed.accept(page(45,[event(43),event(44),event(45)])).length,0);
});
test('midnight and weekly resets cannot hide an application',()=>{
  const feed=new Feed();feed.accept(page(100));
  assert.equal(feed.accept(page(101,[event(101)])).length,1);
  assert.equal(feed.accept(page(102,[event(102)])).length,1);
});
test('pagination and reconnects keep a monotonic cursor',()=>{
  const feed=new Feed();feed.accept(page(10));
  assert.equal(feed.accept(page(60,[event(11),event(60)],true)).length,2);
  assert.equal(feed.accept(page(61,[event(61)])).length,1);
  assert.equal(feed.accept(page(20,[event(20)])).length,0);
  assert.equal(feed.cursor,61);
});
test('malformed feed cannot advance the cursor or render an unnamed shout-out',()=>{
  const feed=new Feed();feed.accept(page(10));
  assert.throws(()=>feed.accept({cursor:'11',events:[]}));
  assert.equal(feed.cursor,10);
  assert.equal(feed.accept(page(13,[event(11,''),event(12,null),event(99)])).length,0);
});
