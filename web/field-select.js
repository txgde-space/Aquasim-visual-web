// Hardware form controls share the bundled Vue runtime; no build dependency.
import {at as ref, T as h, R as nextTick} from './assets/sceneAssetGeometry-YBcFkxAK.js'
let nextId=0
export default {
 name:'FieldSelect',
 props:{modelValue:[String,Number],options:{type:Array,default:()=>[]},label:String,placeholder:String,editable:Boolean,disabled:Boolean},
 emits:['update:modelValue'],
 setup(props,{emit}){
  const opened=ref(false),active=ref(-1),filtering=ref(false),control=ref(null),list=ref(null)
  const id=`field-select-${++nextId}`
  const options=()=>props.options.map(item=>typeof item==='object'?item:{value:item,label:String(item)})
  const choices=()=>options().filter(item=>!props.editable||!filtering.value||item.label.toLowerCase().includes(String(props.modelValue||'').toLowerCase()))
  const close=()=>{opened.value=false;filtering.value=false;active.value=-1}
  const show=()=>{if(props.disabled)return;filtering.value=false;opened.value=true;active.value=choices().findIndex(item=>item.value===props.modelValue)}
  const reveal=()=>nextTick(()=>list.value?.querySelector('[data-active="true"]')?.scrollIntoView({block:'nearest'}))
  const choose=item=>{if(!item||props.disabled)return;emit('update:modelValue',item.value);close();control.value?.focus()}
  const keydown=event=>{
   if(event.isComposing||props.disabled)return
   if(event.key==='Escape'&&opened.value){event.preventDefault();event.stopPropagation();close()}
   else if(event.key==='Tab')close()
   else if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();event.stopPropagation();if(!opened.value)show()
    const items=choices(),step=event.key==='ArrowDown'?1:-1
    active.value=items.length?(active.value<0?(step>0?0:items.length-1):(active.value+step+items.length)%items.length):-1;reveal()
   }else if(event.key==='Enter'||(event.key===' '&&!props.editable)){
    event.preventDefault();event.stopPropagation();if(opened.value){const item=choices()[active.value];if(item)choose(item);else close()}else show()
   }
  }
  return()=>{
   const items=choices(),isOpen=opened.value&&!props.disabled
   const common={ref:control,class:'select field-select-control',role:'combobox','aria-label':props.label,'aria-expanded':isOpen,'aria-controls':id,'aria-haspopup':'listbox','aria-activedescendant':isOpen&&active.value>=0?`${id}-${active.value}`:undefined,disabled:props.disabled,onKeydown:keydown}
   const selected=options().find(item=>item.value===props.modelValue)
   return h('div',{class:'field-select',onFocusout:event=>{if(!event.currentTarget.contains(event.relatedTarget))close()}},[
    props.editable?h('input',{...common,value:props.modelValue??'',placeholder:props.placeholder,autocomplete:'off',spellcheck:false,'aria-autocomplete':'list',onClick:()=>{if(!opened.value)show()},onInput:event=>{emit('update:modelValue',event.target.value);filtering.value=true;active.value=-1;opened.value=true}}):h('button',{...common,type:'button',onClick:()=>isOpen?close():show()},selected?.label||props.placeholder||'请选择'),
    h('span',{class:'field-select-arrow','aria-hidden':'true'}),
    isOpen?h('div',{id,ref:list,class:'field-select-menu',role:'listbox','aria-label':props.label},items.length?items.map((item,index)=>h('div',{key:String(item.value),id:`${id}-${index}`,class:'field-select-option',role:'option','aria-selected':item.value===props.modelValue,'data-active':index===active.value,onPointerdown:event=>{event.preventDefault();choose(item)},onClick:()=>choose(item)},item.label)):[h('div',{class:'field-select-empty'},'无匹配串口，可直接输入路径')]):null
   ])
  }
 }
}
