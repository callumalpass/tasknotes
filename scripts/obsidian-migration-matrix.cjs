// Run inside the disposable test vault via Obsidian CLI eval. No live plugin
// settings are changed. Each service gets a real filesystem adapter confined
// to a new fixture directory, and cannot register watchers on the host vault.
(async () => {
 const live = app.plugins.plugins['tasknotes-migration-test'];
 if (typeof live?.mdbaseSpecService.reconcileMembershipKeys !== 'function') throw Error('Wrong candidate loaded');
 const base = '[test]-mdbase-upgrades-' + Date.now();
 const disk = app.vault.adapter;
 await disk.mkdir(base);
 const results = [];
 for (const scenario of ['fresh','empty-v02','custom-keys-v02','missing-keys-v03','empty-keys-v03','nested-provider','mixed-v02','duplicate-providers','interrupted-v02','actual-v4']) {
  const prefix = base + '/' + scenario;
  await disk.mkdir(prefix);
  const p = (path) => { if (path.startsWith('/') || path.split('/').includes('..')) throw Error('fixture escape'); return prefix + '/' + path; };
  const adapter = {
   exists: path => disk.exists(p(path)), read: path => disk.read(p(path)),
   write: (path,data) => disk.write(p(path),data), remove: path => disk.remove(p(path)),
   list: async path => { const r=await disk.list(p(path)); return {files:r.files.map(f=>f.slice(prefix.length+1)),folders:r.folders.map(f=>f.slice(prefix.length+1))}; }
  };
  const put = async (path,data) => { const parts=path.split('/'); parts.pop(); let dir=''; for(const part of parts){dir=dir?dir+'/'+part:part;if(!await adapter.exists(dir))await disk.mkdir(p(dir));} await adapter.write(path,data); };
  const vault = {adapter, createFolder:path=>disk.mkdir(p(path)), create:async(path,data)=>{if(await adapter.exists(path))throw Error('exists');await put(path,data);}, getAbstractFileByPath:()=>null, on:()=>null};
  const plugin = {settings:structuredClone(live.settings),fieldMapper:live.fieldMapper,app:{vault}, registerEvent:()=>{},emitter:{trigger:()=>{}},saveSettings:async()=>{}};
  if(scenario==='actual-v4') {
   const captured=require('fs').readFileSync('/tmp/tasknotes-v4-settings.txt','utf8');
   Object.assign(plugin.settings,JSON.parse(captured.split('=> ').pop()).settings);
  }
  plugin.settings.enableMdbaseSpec=true;
  const service=new live.mdbaseSpecService.constructor(plugin);
  const paper='---\ntype: article-journal\ntitle: Test paper\n---\nDo not change.\n';
  await put('paper.md',paper);
  const v03=service.buildTaskTypeDef('0.3.0');
  if(scenario!=='fresh') {
   const old=scenario.endsWith('v02');
   const keys=scenario==='custom-keys-v02'?'[record_kind]':'[]';
   await put('mdbase.yaml',`spec_version: "${old?'0.2.1':'0.3.0'}"\nsettings:\n  types_folder: _types\n${scenario==='missing-keys-v03'?'':`  explicit_type_keys: ${keys}\n`}  validation: warn\n`);
   await put(scenario==='nested-provider'?'_types/nested/task.md':'_types/task.md',old?service.buildTaskTypeDef('0.2.1'):v03);
   if(scenario==='mixed-v02') await put('_types/note.md','---\nname: note\nfields: {}\n---\n');
   if(scenario==='duplicate-providers') await put('_types/tasknotes-task.md',v03.replace('name: task\n','name: tasknotes-task\n'));
  }
  if(scenario==='actual-v4') {
   const captured=require('fs').readFileSync('/tmp/tasknotes-v4-generated.txt','utf8');
   const legacy=JSON.parse(captured.split('=> ').pop());
   await put('mdbase.yaml',legacy.config);
   await put('_types/task.md',legacy.type);
   await put('expected-v5-legacy.txt',service.buildTaskTypeDef('0.2.1'));
  }
  if(scenario==='interrupted-v02') {const write=adapter.write;let failed=false;adapter.write=async(path,data)=>{if(path==='mdbase.yaml'&&!failed){failed=true;throw Error('injected interruption');}return write(path,data);};}
  try {
   await service.initialize();
   await new live.mdbaseSpecService.constructor(plugin).initialize();
   const config=await adapter.read('mdbase.yaml');
   const types=await adapter.list('_types');
   results.push({scenario,paperPreserved:await adapter.read('paper.md')===paper,upgraded:config.includes('0.3.0'),membership:config.includes('mdbase_type')||config.includes('record_kind'),types:types.files});
  } catch(error) {results.push({scenario,error:String(error)});}
 }
 return JSON.stringify({base,results});
})()
