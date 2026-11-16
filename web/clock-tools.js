// Native browser module. No build tools or external resources.
let hardware, controller, panel, latest, ports = [], busy = false, autoBusy = false, autoError = '', statusError = ''
let returnFocus
const selected = new Set(), rows = new Map()
const text = (el, value) => { if(el && el.textContent !== value) el.textContent = value ?? '—' }
const field = name => panel?.querySelector(`[data-field="${name}"]`)
async function api(path, body) {
 const owner = controller, ownerPanel = panel
 const response = await fetch('/api/field/'+path, {method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.any([owner.signal,AbortSignal.timeout(15000)])})
 const data = await response.json()
 if(owner!==controller || owner.signal.aborted || (ownerPanel && ownerPanel!==panel)) throw new DOMException('Stale settings','AbortError')
 if(!response.ok || !data.ok) throw Error(data.error || `HTTP ${response.status}`)
 return data
}
function notice(message, error=false) {
 const el=field('notice');text(el,message);el?.classList.toggle('error',error)
}
function deviceAt(port) { return Object.entries(latest?.atomics||{}).find(([,st])=>st.connected && st.port===port) }
function render() {
 const state=latest?.clockTools.auto
 if(!state || !hardware)return
 const checkbox=hardware.querySelector('[data-auto-system]')
 checkbox.checked=state.enabled
 checkbox.disabled=autoBusy || !!statusError || (!state.enabled && !latest.atomic.connected)
 const info=hardware.querySelector('[data-auto-status]')
 text(info, statusError || autoError || state.error || (state.enabled?'每 60 秒使用原子钟同步服务端系统时间':'原子钟 → 服务端系统时间'))
 info.classList.toggle('error',!!(statusError || autoError || state.error))
 if(!panel)return
 text(field('system'),latest.systemTime+' UTC')
 const available=[...new Set([...ports,...Object.values(latest.atomics||{}).filter(st=>st.connected).map(st=>st.port)])].sort()
 for(const [port,row]of rows)if(!available.includes(port)){row.remove();rows.delete(port);selected.delete(port)}
 for(const port of available){
  let row=rows.get(port)
  if(!row){
   row=document.createElement('label');row.className='clock-port-choice'
   const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label',port);input.onchange=()=>void selectPort(port,input.checked)
   const name=document.createElement('span');name.className='mono';text(name,port)
   const reading=document.createElement('span');reading.className='clock-port-time mono'
   row.append(input,name,reading);rows.set(port,row);field('ports').append(row)
  }
  const entry=deviceAt(port),st=entry?.[1],gps=latest.gps.connected&&latest.gps.port===port
  const input=row.querySelector('input');input.checked=selected.has(port);input.disabled=busy||gps
  text(row.lastChild,gps?'GPS 正在使用':st?(st.utcTime?`${st.utcTime}${st.stale?'（过期）':''}`:'等待时间回复')+(st.error?' · '+st.error:''):'未连接')
 }
 field('empty').hidden=available.length>0
 panel.querySelector('[data-batch]').disabled=busy||!!statusError||selected.size===0||state.enabled
 panel.querySelector('[data-refresh]').disabled=busy
 text(field('auto-hint'),state.enabled?'请先关闭自动同步系统时间，再进行初始对钟。':'')
}
async function action(fn) {
 if(busy)return
 const owner=panel,token=controller;busy=true;render()
 try{await fn()}catch(e){if(panel===owner&&e.name!=='AbortError')notice(e.message,true)}
 finally{if(panel===owner&&controller===token){busy=false;render()}}
}
async function selectPort(port, checked) {
 if(busy){render();return}
 const owner=panel
 if(checked)selected.add(port);else selected.delete(port)
 await action(async()=>{
  const entry=deviceAt(port)
  try{
   if(checked){
    if(!entry)await api('atomic-batch-open',{configs:[{device:'atomic',port,baudRate:57600,dataBits:8,stopBits:1,parity:'none',pollIntervalMs:1000}]})
   }else if(entry)await api('disconnect',{device:entry[0]})
  }catch(e){if(panel===owner){if(checked)selected.delete(port);else selected.add(port)}throw e}
  latest=await api('status');notice('')
 })
}
async function loadPorts(){ports=(await api('ports')).ports;latest=await api('status');render()}
function close(){
 if(!panel)return
 const previous=panel;panel=null;previous.close();previous.remove();rows.clear();selected.clear();busy=false;returnFocus?.focus()
}
function open(button){
 if(panel)return
 returnFocus=button;panel=document.createElement('dialog');panel.className='clock-tools';panel.setAttribute('aria-label','初始对钟')
 panel.innerHTML=`<header><h2>初始对钟</h2><button class="btn btn-compact" data-close>关闭</button></header>
 <p class="hint">服务端系统时间：<span data-field="system" class="mono">—</span></p>
 <p class="hint">勾选串口即连接并读取时间，取消勾选会断开。新连接使用 57600 / 8N1；已有连接沿用当前串口参数。关闭面板保留连接。</p>
 <section><div class="clock-list-head"><span>原子钟串口</span><span>当前原子钟时间 · UTC</span></div><div data-field="ports"></div><p class="hint" data-field="empty">尚未发现串口</p></section>
 <div class="clock-actions"><button class="btn" data-batch disabled>与系统对时</button><button class="btn btn-compact" data-refresh>刷新串口列表</button></div>
 <p class="hint">向全部已勾选原子钟发送同一个系统时间值，使用默认设置时间指令。发送后查看各台读回时间。</p>
 <p class="hint" data-field="auto-hint"></p><div data-field="result" aria-live="polite"></div><p data-field="notice" role="status"></p>`
 selected.clear();for(const st of Object.values(latest?.atomics||{}))if(st.connected)selected.add(st.port)
 document.body.append(panel);panel.querySelector('[data-close]').onclick=close
 panel.addEventListener('cancel',e=>{e.preventDefault();close()})
 panel.querySelector('[data-refresh]').onclick=()=>action(loadPorts)
 panel.querySelector('[data-batch]').onclick=()=>action(async()=>{
  const ids=[...selected].map(port=>deviceAt(port)?.[0])
  if(ids.some(id=>!id))throw Error('有选中串口已断开，请重新勾选连接。')
  notice('正在向选中原子钟发送共同系统时间…')
  const {result}=await api('atomic-batch-sync',{devices:ids})
  const box=field('result');if(!box)return
  box.replaceChildren();const summary=document.createElement('p')
  text(summary,`统一写入时间 ${result.targetUtcTime} · ${result.rows.filter(row=>!row.error).length}/${result.rows.length} 台指令写入完成`);box.append(summary)
  for(const row of result.rows){const p=document.createElement('p');text(p,`${row.port}：${row.error?'失败 '+row.error:'已发送，请核对读回时间'}`);box.append(p)}
  notice('')
 })
 panel.showModal();render();void action(loadPorts)
}
function attach(){
 const root=document.querySelector('.field-dialog[open]')
 if(hardware && hardware!==root){close();controller.abort();hardware=null;ports=[];autoBusy=false;autoError=''}
 if(!document.querySelector('.field-devices')){latest=null;statusError=''}
 if(!root)return
 const card=[...root.querySelectorAll('.serial-card')].find(el=>el.querySelector('h3')?.textContent==='原子钟')
 if(!card)return
 if(!card.querySelector('[data-clock-tools]')){
  const label=document.createElement('label');label.className='clock-auto-toggle'
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.autoSystem='';checkbox.disabled=true
  label.append(checkbox,document.createTextNode('自动同步系统时间'));card.querySelector('.serial-actions').append(label)
  const info=document.createElement('p');info.className='clock-auto-status';info.dataset.autoStatus='';info.setAttribute('role','status');card.append(info)
  checkbox.onchange=async()=>{
   if(autoBusy)return
   const enabled=checkbox.checked,token=controller;autoBusy=true;autoError='';checkbox.disabled=true
   try{latest=await api('atomic-auto',enabled?{enabled:true,device:'atomic',direction:'atomic-to-system',intervalSeconds:60,maxStepSeconds:60}:{enabled:false});render()}
   catch(e){if(e.name!=='AbortError')autoError=e.message}
   finally{if(controller===token){autoBusy=false;render()}}
  }
  const button=document.createElement('button');button.className='btn btn-compact';button.dataset.clockTools='';button.textContent='初始对钟';button.onclick=()=>open(button);card.append(button)
 }
 if(hardware!==root){hardware=root;controller=new AbortController();render()}
}
// Reuse the footer device component's existing status stream; no second poller.
document.addEventListener('aquasim:field-status',event=>{latest=event.detail;statusError='';render()})
document.addEventListener('aquasim:field-error',event=>{statusError=event.detail;render()})
new MutationObserver(attach).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});attach()
