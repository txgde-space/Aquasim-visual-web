// Native browser module. No bundler, Node runtime or external resources.
const defaults = {query:'!T?',set:'!TA{unix}',ending:'crlf'}
let panel, timer, controller, returnFocus, latest, sending = false
const q = name => panel.querySelector(`[data-field="${name}"]`)
const text = (el, value) => { el.textContent = value ?? '—' }
async function api(path, body) {
 const owner=controller
 const response = await fetch('/api/field/'+path, {method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.any([owner.signal,AbortSignal.timeout(15000)])})
 const data = await response.json(); if(owner!==controller||owner.signal.aborted)throw new DOMException('Stale dialog','AbortError'); if(!response.ok || !data.ok) throw Error(data.error || `HTTP ${response.status}`); return data
}
function notice(message, error=false){if(!panel)return;const el=q('notice');text(el,message);el.classList.toggle('error',error)}
async function action(fn){if(sending)return;const owner=panel;sending=true;panel.querySelectorAll('button[data-action]').forEach(x=>x.disabled=true);try{await fn()}catch(e){if(panel===owner&&e.name!=='AbortError')notice(e.message,true)}finally{if(panel===owner){sending=false;panel.querySelectorAll('button[data-action]').forEach(x=>x.disabled=false)}}}
function options(select, values){for(const [value,label]of values){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option)}}
function addPort(value=''){
 const row=document.createElement('div');row.className='clock-port-row';row.innerHTML=`<input class="select" aria-label="原子钟串口" placeholder="/dev/ttyUSB0 或 COM3" list="clock-port-list"><input class="select" aria-label="原子钟波特率" type="number" value="57600" min="300" max="4000000"><select class="select" aria-label="原子钟数据位"></select><select class="select" aria-label="原子钟停止位"></select><select class="select" aria-label="原子钟校验位"></select><button class="btn btn-compact" aria-label="移除此串口">移除</button>`
 const inputs=row.querySelectorAll('input');inputs[0].value=value
 const selects=row.querySelectorAll('select');options(selects[0],['5','6','7','8'].map(x=>[x,x+' 位']));selects[0].value='8';options(selects[1],[['1','1 停止位'],['2','2 停止位']]);options(selects[2],[['none','无校验'],['even','偶校验'],['odd','奇校验']]);row.querySelector('button').onclick=()=>row.remove();q('ports').append(row)
}
function connectionRows(states){
 const box=q('connected');const checked=new Set([...box.querySelectorAll('input:checked')].map(x=>x.value));const known=new Set([...box.querySelectorAll('input')].map(x=>x.value));box.replaceChildren()
 for(const [id,st]of Object.entries(states||{})){
  if(!st.connected)continue
  const row=document.createElement('label');row.className='clock-connected';const select=document.createElement('input');select.type='checkbox';select.value=id;select.checked=checked.has(id)||!known.has(id);row.append(select)
  const desc=document.createElement('span');text(desc,`${st.port} · ${st.baudRate} baud · UTC ${st.utcTime||'未取得'}${st.stale?'（过期）':''}${st.error?' · '+st.error:''}`);row.append(desc);box.append(row)
 }
 if(!box.children.length){const p=document.createElement('p');p.textContent='尚未连接原子钟。';box.append(p)}
}
async function refresh(first=false){
 const owner=panel, token=controller
 try{const data=await api('status');if(!panel)return;latest=data;connectionRows(data.atomics)
  if(first){for(const key of ['query','set','ending'])q(key).value=data.clockTools.commands[key]}
  text(q('system'),data.systemTime+' UTC')
  updateAuto(data.clockTools.auto)
 }catch(e){if(e.name!=='AbortError')notice(e.message,true)}
 finally{if(panel===owner&&controller===token&&!token.signal.aborted)timer=setTimeout(()=>refresh(),1000)}
}
function updateAuto(state){
 const select=q('auto-device'), value=state.enabled?state.device:select.value
 const ids=Object.entries(latest.atomics||{}).filter(([,st])=>st.connected)
 const signature=JSON.stringify(ids.map(([id,st])=>[id,st.port]))
 if(select.dataset.signature!==signature){select.replaceChildren();options(select,[['','请选择原子钟'],...ids.map(([id,st])=>[id,st.port])]);select.dataset.signature=signature;select.value=value}
 if(state.enabled){q('auto-direction').value=state.direction;select.value=state.device;q('auto-interval').value=state.intervalSeconds;q('auto-max').value=state.maxStepSeconds}
 for(const key of ['auto-device','auto-direction','auto-interval','auto-max'])q(key).disabled=state.enabled
 const outcome={'within-resolution':'整数秒分辨率内，未改系统时间','system-set':'已设置系统时间','atomic-command-sent':'已发送原子钟指令'}[state.lastAction]||''
 text(q('auto-state'),`${state.enabled?'自动同步运行中':'自动同步已关闭'}${state.lastAt?' · 最近检查 '+state.lastAt:''}${outcome?' · '+outcome:''}${state.error?' · '+state.error:''}`)
 q('auto-state').classList.toggle('error',!!state.error)
}
function close(){if(!panel)return;clearTimeout(timer);controller.abort();panel.close();panel.remove();panel=null;sending=false;returnFocus?.focus()}
async function open(button){
 if(panel)return;returnFocus=button;controller=new AbortController();panel=document.createElement('dialog');panel.className='clock-tools';panel.setAttribute('aria-label','原子钟同步与初始对钟')
 panel.innerHTML=`<header><h2>原子钟同步与初始对钟</h2><button class="btn btn-compact" data-close>关闭</button></header>
 <p class="hint">本机指运行 Go 服务的机器。当前系统时间：<span data-field="system" class="mono">—</span></p>
 <section><h3>校时指令</h3><p class="hint">默认查询 !T?，设置 !TA{unix}，结束符 CRLF。自定义指令不会调用系统命令；回复仍须为纯 Unix 整数秒。</p><div class="clock-command-grid">
 <label>查询指令<input class="select mono" data-field="query" aria-label="查询指令"></label><label>设置指令<input class="select mono" data-field="set" aria-label="设置指令"></label><label>结束符<select class="select" data-field="ending" aria-label="指令结束符"><option value="crlf">CRLF</option><option value="lf">LF</option><option value="cr">CR</option><option value="none">无</option></select></label></div>
 <p class="hint">占位符：{unix} 秒、{unix_ms} 毫秒、{iso} UTC 日期。请按设备实际支持格式填写，不能借更细的格式提高设备精度。</p><div class="clock-actions"><button class="btn btn-compact" data-default>恢复默认指令</button><button class="btn btn-compact" data-action="commands">应用指令</button></div></section>
 <section data-field="auto-section"></section>
 <section><h3>初始对钟 · 多台原子钟</h3><p class="hint">目标是让选中的原子钟使用同一个时间基准，不要求这个时间与真实 UTC 一致。程序只取一次本机时间，生成同一条设时指令，再并发发送给全部设备。默认 57600 / 8N1，可逐台修改。</p>
 <div class="clock-actions"><button class="btn btn-compact" data-add>添加串口</button><button class="btn btn-compact" data-action="ports">刷新串口列表</button><button class="btn btn-compact" data-action="open">打开以上串口</button></div><datalist id="clock-port-list"></datalist><div data-field="ports"></div>
 <h4>参与对钟的已连接设备</h4><div data-field="connected"></div><div class="clock-actions"><button class="btn" data-action="batch">与当前本机系统时间统一对钟</button><button class="btn btn-compact" data-action="disconnect">断开选中设备</button></div>
 <p class="hint">本机时间在这里仅作共同起点，不必先用 GPS 或网络校准。逐台查看后续读数；同一时间值已发送不等于已确认各台时钟完全对齐。</p><div data-field="result" aria-live="polite"></div></section><p data-field="notice" role="status"></p>`
 document.body.append(panel);panel.querySelector('[data-close]').onclick=close;panel.addEventListener('cancel',e=>{e.preventDefault();close()});panel.querySelector('[data-add]').onclick=()=>addPort();panel.querySelector('[data-default]').onclick=()=>{for(const key of ['query','set','ending'])q(key).value=defaults[key];notice('默认指令已填入，点击“应用指令”生效。')}
 panel.querySelector('[data-action="commands"]').onclick=()=>action(async()=>{await api('atomic-commands',Object.fromEntries(['query','set','ending'].map(k=>[k,q(k).value])));notice('指令已应用到本次服务会话。')})
 panel.querySelector('[data-action="ports"]').onclick=()=>action(async()=>{const data=await api('ports');const list=panel.querySelector('datalist');list.replaceChildren();for(const port of data.ports){const option=document.createElement('option');option.value=port;list.append(option)};notice(`发现 ${data.ports.length} 个串口，可手动输入。`)})
 panel.querySelector('[data-action="open"]').onclick=()=>action(async()=>{const configs=[...q('ports').children].map(row=>{const [port,baud]=row.querySelectorAll('input');const [bits,stop,parity]=row.querySelectorAll('select');return{device:'atomic',port:port.value,baudRate:Number(baud.value),dataBits:Number(bits.value),stopBits:Number(stop.value),parity:parity.value,pollIntervalMs:1000}});const data=await api('atomic-batch-open',{configs});notice(`已打开 ${data.result.devices.length} 个串口。请选择参与对钟的设备。`)})
 const selected=()=>[...q('connected').querySelectorAll('input:checked')].map(x=>x.value)
 panel.querySelector('[data-action="disconnect"]').onclick=()=>action(async()=>{for(const device of selected())await api('disconnect',{device});notice('选中设备已断开。')})
 panel.querySelector('[data-action="batch"]').onclick=()=>action(async()=>{notice('正在等待共同整秒并下发指令…');const data=await api('atomic-batch-sync',{devices:selected()});const result=data.result;const box=q('result');box.replaceChildren();const summary=document.createElement('p');const sent=result.rows.filter(row=>!row.error).length;summary.textContent=`统一写入时间 ${result.targetUtcTime} · ${sent}/${result.rows.length} 台指令写入完成`;box.append(summary);for(const row of result.rows){const p=document.createElement('p');text(p,`${row.port}：${row.error?'失败 '+row.error:'同一时间值已发送，等待核对读回'}`);box.append(p)};const details=document.createElement('details');const title=document.createElement('summary');title.textContent='查看发送时序';details.append(title);const timing=document.createElement('p');timing.textContent=`主机调用发送时间差 ${result.dispatchSpreadMs.toFixed(3)} ms（不是设备间时间误差）`;details.append(timing);for(const row of result.rows){const p=document.createElement('p');text(p,`${row.port}：${row.sentAt||'未发送'} · 理论串口传输约 ${row.estimatedWireMs.toFixed(2)} ms`);details.append(p)};box.append(details);notice('共同时间值已下发，请核对各台设备后续读数。')})
 for(const key of ['query','set','ending'])q(key).value=defaults[key]
 addPort();setupAuto();panel.showModal();void refresh(true)
}
function setupAuto(){
 q('auto-section').innerHTML=`<h3>自动同步</h3><p class="hint">默认关闭，重启服务后需重新启用。选择明确方向；启用后在第一个周期执行，切换页面仍继续。</p><div class="clock-auto-grid"><label>同步方向<select class="select" data-field="auto-direction" aria-label="自动同步方向"><option value="">请选择方向</option><option value="atomic-to-system">原子钟 → 本机系统时间</option><option value="system-to-atomic">本机系统时间 → 原子钟</option></select></label><label>原子钟<select class="select" data-field="auto-device" aria-label="自动同步原子钟"></select></label><label>同步间隔（秒）<input class="select" data-field="auto-interval" type="number" min="5" max="86400" value="60" aria-label="自动同步间隔"></label><label>允许的最大系统校时差（秒）<input class="select" data-field="auto-max" type="number" min="1" max="86400" value="60" aria-label="最大系统校时差"></label></div><p class="hint">原子钟 → 系统需要设置系统时间的权限，且属于直接设置，可能造成时间跳变；不要与其他自动校时服务同时控制系统时钟。整数秒串口读数不等同于 PPS 授时；差值小于 1 秒时仅检查，不改系统时间，无法保证毫秒级误差。数据过期、断线、权限不足或超过允许时间差时自动关闭。</p><div class="clock-actions"><button class="btn btn-compact" data-action="auto-enable">启用自动同步</button><button class="btn btn-compact" data-action="auto-disable">关闭自动同步</button></div><p data-field="auto-state" role="status"></p>`
 panel.querySelector('[data-action="auto-enable"]').onclick=()=>action(async()=>{const direction=q('auto-direction').value;if(!direction)throw Error('请先明确选择自动同步方向');const data=await api('atomic-auto',{enabled:true,direction,device:q('auto-device').value,intervalSeconds:Number(q('auto-interval').value),maxStepSeconds:Number(q('auto-max').value)});latest=data;updateAuto(data.clockTools.auto);notice('自动同步已启用，将在所设间隔后执行。')})
 panel.querySelector('[data-action="auto-disable"]').onclick=()=>action(async()=>{const data=await api('atomic-auto',{enabled:false});latest=data;updateAuto(data.clockTools.auto);notice('自动同步已关闭。')})
}
function attach(){
 if(panel&&!document.querySelector('.field-devices'))close()
 const root=document.querySelector('.field-dialog');if(!root||root.querySelector('[data-clock-tools]'))return
 const card=[...root.querySelectorAll('.serial-card')].find(el=>el.querySelector('h3')?.textContent==='原子钟');if(!card)return
 const button=document.createElement('button');button.className='btn btn-compact';button.dataset.clockTools='';button.textContent='同步设置 / 初始对钟';button.onclick=()=>open(button);card.append(button)
}
new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});attach()
