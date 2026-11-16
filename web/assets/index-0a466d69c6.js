const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/ReplayPage-BtOt03An.js","assets/sceneAssetGeometry-YBcFkxAK.js","assets/preload-helper-rov5CBGT.js","assets/logSafety-D3QUwWPL.js","assets/logSafety-CU7orN2x.css","assets/seabedTerrain-D0Ve6D59.js","assets/ReplayPage-DYZFYRea.css"])))=>i.map(i=>d[i]);
import{$ as e,A as t,C as n,D as r,E as i,F as a,G as o,H as s,K as c,M as l,O as u,P as d,Q as f,R as p,S as m,T as h,U as g,V as _,W as v,Z as y,_ as b,at as x,b as S,ct as C,dt as w,ft as T,h as E,it as D,j as O,lt as k,m as A,ot as j,p as M,q as N,rt as P,st as ee,tt as te,u as F,v as I,w as L,x as R,y as ne,z}from"./sceneAssetGeometry-YBcFkxAK.js";import{C as B,_ as re,b as ie,d as ae,f as oe,g as V,h as se,m as ce,n as le,p as ue,u as de,v as fe,y as pe}from"./logSafety-D3QUwWPL.js";import{t as me}from"./preload-helper-rov5CBGT.js";(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var he=x(`dark`);try{let e=localStorage.getItem(B.uiTheme);(e===`dark`||e===`light`)&&(he.value=e)}catch{}y(he,e=>{document.documentElement.dataset.theme=e;try{localStorage.setItem(B.uiTheme,e)}catch{}},{immediate:!0});function ge(){return{theme:he,toggleTheme:()=>{he.value=he.value===`dark`?`light`:`dark`}}}var _e={class:`app-shell`},ve={class:`topbar`},ye={class:`page-tabs`,"aria-label":`页面`},be={class:`topbar-actions`},xe=[`aria-label`,`title`],Se={key:0,viewBox:`0 0 24 24`,"aria-hidden":`true`,fill:`none`,stroke:`currentColor`,"stroke-width":`1.8`,"stroke-linecap":`round`},Ce={key:1,viewBox:`0 0 24 24`,"aria-hidden":`true`,fill:`none`,stroke:`currentColor`,"stroke-width":`1.8`,"stroke-linecap":`round`,"stroke-linejoin":`round`},we={class:`app-main`},Te=l({__name:`App`,setup(e){let{theme:n,toggleTheme:r}=ge(),a=L(()=>n.value===`dark`?`切换到亮色主题`:`切换到暗色主题`);return(e,o)=>{let l=c(`router-link`),d=c(`router-view`);return s(),u(`div`,_e,[h(`header`,ve,[O(l,{class:`brand`,to:`/`},{default:f(()=>[...o[1]||=[h(`span`,{class:`brand-mark`,"aria-hidden":`true`},null,-1),h(`span`,{class:`brand-name`},`AQUASIM`,-1),h(`span`,{class:`brand-sub`},`水声网络仿真`,-1)]]),_:1}),h(`nav`,ye,[O(l,{class:`page-tab`,to:`/`},{default:f(()=>[...o[2]||=[t(`仿真试验`,-1)]]),_:1}),O(l,{class:`page-tab`,to:`/field`},{default:f(()=>[...o[3]||=[t(`真实试验`,-1)]]),_:1}),O(l,{class:`page-tab`,to:`/replay`},{default:f(()=>[...o[4]||=[t(`回放`,-1)]]),_:1})]),h(`div`,be,[h(`button`,{class:`theme-toggle`,type:`button`,"aria-label":a.value,title:a.value,onClick:o[0]||=(...e)=>C(r)&&C(r)(...e)},[C(n)===`dark`?(s(),u(`svg`,Se,[...o[5]||=[h(`circle`,{cx:`12`,cy:`12`,r:`4`},null,-1),h(`path`,{d:`M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19`},null,-1)]])):(s(),u(`svg`,Ce,[...o[6]||=[h(`path`,{d:`M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6a8.5 8.5 0 1 0 10.6 10.6Z`},null,-1)]]))],8,xe)])]),h(`main`,we,[O(d,null,{default:f(({Component:t})=>[O(A,{name:`page`},{default:f(()=>[(s(),i(N(t),{key:e.$route.name}))]),_:2},1024)]),_:1})])])}}}),Ee=typeof document<`u`;function De(e){return typeof e==`object`||`displayName`in e||`props`in e||`__vccOpts`in e}function Oe(e){return e.__esModule||e[Symbol.toStringTag]===`Module`||e.default&&De(e.default)}var H=Object.assign;function ke(e,t){let n={};for(let r in t){let i=t[r];n[r]=U(i)?i.map(e):e(i)}return n}var Ae=()=>{},U=Array.isArray;function je(e,t){let n={};for(let r in e)n[r]=r in t?t[r]:e[r];return n}var Me=/#/g,Ne=/&/g,Pe=/\//g,Fe=/=/g,Ie=/\?/g,Le=/\+/g,Re=/%5B/g,ze=/%5D/g,Be=/%5E/g,Ve=/%60/g,He=/%7B/g,Ue=/%7C/g,W=/%7D/g,We=/%20/g;function Ge(e){return e==null?``:encodeURI(``+e).replace(Ue,`|`).replace(Re,`[`).replace(ze,`]`)}function Ke(e){return Ge(e).replace(He,`{`).replace(W,`}`).replace(Be,`^`)}function qe(e){return Ge(e).replace(Le,`%2B`).replace(We,`+`).replace(Me,`%23`).replace(Ne,`%26`).replace(Ve,"`").replace(He,`{`).replace(W,`}`).replace(Be,`^`)}function Je(e){return qe(e).replace(Fe,`%3D`)}function Ye(e){return Ge(e).replace(Me,`%23`).replace(Ie,`%3F`)}function Xe(e){return Ye(e).replace(Pe,`%2F`)}function Ze(e){if(e==null)return null;try{return decodeURIComponent(``+e)}catch{}return``+e}var Qe=/\/$/,$e=e=>e.replace(Qe,``);function et(e,t,n=`/`){let r,i={},a=``,o=``,s=t.indexOf(`#`),c=t.indexOf(`?`);return c=s>=0&&c>s?-1:c,c>=0&&(r=t.slice(0,c),a=t.slice(c,s>0?s:t.length),i=e(a.slice(1))),s>=0&&(r||=t.slice(0,s),o=t.slice(s,t.length)),r=st(r??t,n),{fullPath:r+a+o,path:r,query:i,hash:Ze(o)}}function tt(e,t){let n=t.query?e(t.query):``;return t.path+(n&&`?`)+n+(t.hash||``)}function G(e,t){return!t||!e.toLowerCase().startsWith(t.toLowerCase())?e:e.slice(t.length)||`/`}function nt(e,t,n){let r=t.matched.length-1,i=n.matched.length-1;return r>-1&&r===i&&rt(t.matched[r],n.matched[i])&&it(t.params,n.params)&&e(t.query)===e(n.query)&&t.hash===n.hash}function rt(e,t){return(e.aliasOf||e)===(t.aliasOf||t)}function it(e,t){if(Object.keys(e).length!==Object.keys(t).length)return!1;for(var n in e)if(!at(e[n],t[n]))return!1;return!0}function at(e,t){return U(e)?ot(e,t):U(t)?ot(t,e):e?.valueOf()===t?.valueOf()}function ot(e,t){return U(t)?e.length===t.length&&e.every((e,n)=>e===t[n]):e.length===1&&e[0]===t}function st(e,t){if(e.startsWith(`/`))return e;if(!e)return t;let n=t.split(`/`),r=e.split(`/`),i=r[r.length-1];(i===`..`||i===`.`)&&r.push(``);let a=n.length-1,o,s;for(o=0;o<r.length;o++)if(s=r[o],s!==`.`)if(s===`..`)a>1&&a--;else break;return n.slice(0,a).join(`/`)+`/`+r.slice(o).join(`/`)}var ct={path:`/`,name:void 0,params:{},query:{},hash:``,fullPath:`/`,matched:[],meta:{},redirectedFrom:void 0},lt=function(e){return e.pop=`pop`,e.push=`push`,e}({}),ut=function(e){return e.back=`back`,e.forward=`forward`,e.unknown=``,e}({});function dt(e){if(!e)if(Ee){let t=document.querySelector(`base`);e=t&&t.getAttribute(`href`)||`/`,e=e.replace(/^\w+:\/\/[^\/]+/,``)}else e=`/`;return e[0]!==`/`&&e[0]!==`#`&&(e=`/`+e),$e(e)}var ft=/^[^#]+#/;function pt(e,t){return e.replace(ft,`#`)+t}function mt(e,t){let n=document.documentElement.getBoundingClientRect(),r=e.getBoundingClientRect();return{behavior:t.behavior,left:r.left-n.left-(t.left||0),top:r.top-n.top-(t.top||0)}}var ht=()=>({left:window.scrollX,top:window.scrollY});function gt(e){let t;if(`el`in e){let n=e.el,r=typeof n==`string`&&n.startsWith(`#`),i=typeof n==`string`?r?document.getElementById(n.slice(1)):document.querySelector(n):n;if(!i)return;t=mt(i,e)}else t=e;`scrollBehavior`in document.documentElement.style?window.scrollTo(t):window.scrollTo(t.left==null?window.scrollX:t.left,t.top==null?window.scrollY:t.top)}function _t(e,t){return(history.state?history.state.position-t:-1)+e}var vt=new Map;function yt(e,t){vt.set(e,t)}function bt(e){let t=vt.get(e);return vt.delete(e),t}function xt(e){return typeof e==`string`||e&&typeof e==`object`}function St(e){return typeof e==`string`||typeof e==`symbol`}var K=function(e){return e[e.MATCHER_NOT_FOUND=1]=`MATCHER_NOT_FOUND`,e[e.NAVIGATION_GUARD_REDIRECT=2]=`NAVIGATION_GUARD_REDIRECT`,e[e.NAVIGATION_ABORTED=4]=`NAVIGATION_ABORTED`,e[e.NAVIGATION_CANCELLED=8]=`NAVIGATION_CANCELLED`,e[e.NAVIGATION_DUPLICATED=16]=`NAVIGATION_DUPLICATED`,e}({}),Ct=Symbol(``);K.MATCHER_NOT_FOUND,K.NAVIGATION_GUARD_REDIRECT,K.NAVIGATION_ABORTED,K.NAVIGATION_CANCELLED,K.NAVIGATION_DUPLICATED;function wt(e,t){return H(Error(),{type:e,[Ct]:!0},t)}function Tt(e,t){return e instanceof Error&&Ct in e&&(t==null||!!(e.type&t))}function Et(e){let t={};if(e===``||e===`?`)return t;let n=(e[0]===`?`?e.slice(1):e).split(`&`);for(let e=0;e<n.length;++e){let r=n[e].replace(Le,` `),i=r.indexOf(`=`),a=Ze(i<0?r:r.slice(0,i)),o=i<0?null:Ze(r.slice(i+1));if(a in t){let e=t[a];U(e)||(e=t[a]=[e]),e.push(o)}else t[a]=o}return t}function Dt(e){let t=``;for(let n in e){let r=e[n];if(n=Je(n),r==null){r!==void 0&&(t+=(t.length?`&`:``)+n);continue}(U(r)?r.map(e=>e&&qe(e)):[r&&qe(r)]).forEach(e=>{e!==void 0&&(t+=(t.length?`&`:``)+n,e!=null&&(t+=`=`+e))})}return t}function Ot(e){let t={};for(let n in e){let r=e[n];r!==void 0&&(t[n]=U(r)?r.map(e=>e==null?null:``+e):r==null?r:``+r)}return t}var kt=Symbol(``),At=Symbol(``),jt=Symbol(``),Mt=Symbol(``),Nt=Symbol(``);function Pt(){let e=[];function t(t){return e.push(t),()=>{let n=e.indexOf(t);n>-1&&e.splice(n,1)}}function n(){e=[]}return{add:t,list:()=>e.slice(),reset:n}}function Ft(e,t,n,r,i,a=e=>e()){let o=r&&(r.enterCallbacks[i]=r.enterCallbacks[i]||[]);return()=>new Promise((s,c)=>{let l=e=>{e===!1?c(wt(K.NAVIGATION_ABORTED,{from:n,to:t})):e instanceof Error?c(e):xt(e)?c(wt(K.NAVIGATION_GUARD_REDIRECT,{from:t,to:e})):(o&&r.enterCallbacks[i]===o&&typeof e==`function`&&o.push(e),s())},u=a(()=>e.call(r&&r.instances[i],t,n,l)),d=Promise.resolve(u);e.length<3&&(d=d.then(l)),d.catch(e=>c(e))})}function It(e,t,n,r,i=e=>e()){let a=[];for(let o of e)for(let e in o.components){let s=o.components[e];if(!(t!==`beforeRouteEnter`&&!o.instances[e]))if(De(s)){let c=(s.__vccOpts||s)[t];c&&a.push(Ft(c,n,r,o,e,i))}else{let c=s();a.push(()=>c.then(a=>{if(!a)throw Error(`Couldn't resolve component "${e}" at "${o.path}"`);let s=Oe(a)?a.default:a;o.mods[e]=a,o.components[e]=s;let c=(s.__vccOpts||s)[t];return c&&Ft(c,n,r,o,e,i)()}))}}return a}function Lt(e,t){let n=[],r=[],i=[],a=Math.max(t.matched.length,e.matched.length);for(let o=0;o<a;o++){let a=t.matched[o];a&&(e.matched.find(e=>rt(e,a))?r.push(a):n.push(a));let s=e.matched[o];s&&(t.matched.find(e=>rt(e,s))||i.push(s))}return[n,r,i]}var Rt=()=>location.protocol+`//`+location.host;function zt(e,t){let{pathname:n,search:r,hash:i}=t,a=e.indexOf(`#`);if(a>-1){let t=i.includes(e.slice(a))?e.slice(a).length:1,n=i.slice(t);return n[0]!==`/`&&(n=`/`+n),G(n,``)}return G(n,e)+r+i}function Bt(e,t,n,r){let i=[],a=[],o=null,s=({state:a})=>{let s=zt(e,location),c=n.value,l=t.value,u=0;if(a){if(n.value=s,t.value=a,o&&o===c){o=null;return}u=l?a.position-l.position:0}else r(s);i.forEach(e=>{e(n.value,c,{delta:u,type:lt.pop,direction:u?u>0?ut.forward:ut.back:ut.unknown})})};function c(){o=n.value}function l(e){i.push(e);let t=()=>{let t=i.indexOf(e);t>-1&&i.splice(t,1)};return a.push(t),t}function u(){if(document.visibilityState===`hidden`){let{history:e}=window;if(!e.state)return;e.replaceState(H({},e.state,{scroll:ht()}),``)}}function d(){for(let e of a)e();a=[],window.removeEventListener(`popstate`,s),window.removeEventListener(`pagehide`,u),document.removeEventListener(`visibilitychange`,u)}return window.addEventListener(`popstate`,s),window.addEventListener(`pagehide`,u),document.addEventListener(`visibilitychange`,u),{pauseListeners:c,listen:l,destroy:d}}function Vt(e,t,n,r=!1,i=!1){return{back:e,current:t,forward:n,replaced:r,position:window.history.length,scroll:i?ht():null}}function Ht(e){let{history:t,location:n}=window,r={value:zt(e,n)},i={value:t.state};i.value||a(r.value,{back:null,current:r.value,forward:null,position:t.length-1,replaced:!0,scroll:null},!0);function a(r,a,o){let s=e.indexOf(`#`),c=s>-1?(n.host&&document.querySelector(`base`)?e:e.slice(s))+r:Rt()+e+r;try{t[o?`replaceState`:`pushState`](a,``,c),i.value=a}catch(e){console.error(e),n[o?`replace`:`assign`](c)}}function o(e,n){a(e,H({},t.state,Vt(i.value.back,e,i.value.forward,!0),n,{position:i.value.position}),!0),r.value=e}function s(e,n){let o=H({},i.value,t.state,{forward:e,scroll:ht()});a(o.current,o,!0),a(e,H({},Vt(r.value,e,null),{position:o.position+1},n),!1),r.value=e}return{location:r,state:i,push:s,replace:o}}function Ut(e){e=dt(e);let t=Ht(e),n=Bt(e,t.state,t.location,t.replace);function r(e,t=!0){t||n.pauseListeners(),history.go(e)}let i=H({location:``,base:e,go:r,createHref:pt.bind(null,e)},t,n);return Object.defineProperty(i,`location`,{enumerable:!0,get:()=>t.location.value}),Object.defineProperty(i,`state`,{enumerable:!0,get:()=>t.state.value}),i}var Wt=function(e){return e[e.Static=0]=`Static`,e[e.Param=1]=`Param`,e[e.Group=2]=`Group`,e}({}),q=function(e){return e[e.Static=0]=`Static`,e[e.Param=1]=`Param`,e[e.ParamRegExp=2]=`ParamRegExp`,e[e.ParamRegExpEnd=3]=`ParamRegExpEnd`,e[e.EscapeNext=4]=`EscapeNext`,e}(q||{}),Gt={type:Wt.Static,value:``},Kt=/[a-zA-Z0-9_]/;function qt(e){if(!e)return[[]];if(e===`/`)return[[Gt]];if(!e.startsWith(`/`))throw Error(`Invalid path "${e}"`);function t(e){throw Error(`ERR (${n})/"${l}": ${e}`)}let n=q.Static,r=n,i=[],a;function o(){a&&i.push(a),a=[]}let s=0,c,l=``,u=``;function d(){l&&=(n===q.Static?a.push({type:Wt.Static,value:l}):n===q.Param||n===q.ParamRegExp||n===q.ParamRegExpEnd?(a.length>1&&(c===`*`||c===`+`)&&t(`A repeatable param (${l}) must be alone in its segment. eg: '/:ids+.`),a.push({type:Wt.Param,value:l,regexp:u,repeatable:c===`*`||c===`+`,optional:c===`*`||c===`?`})):t(`Invalid state to consume buffer`),``)}function f(){l+=c}for(;s<e.length;){if(c=e[s++],c===`\\`&&n!==q.ParamRegExp){r=n,n=q.EscapeNext;continue}switch(n){case q.Static:c===`/`?(l&&d(),o()):c===`:`?(d(),n=q.Param):f();break;case q.EscapeNext:f(),n=r;break;case q.Param:c===`(`?n=q.ParamRegExp:Kt.test(c)?f():(d(),n=q.Static,c!==`*`&&c!==`?`&&c!==`+`&&s--);break;case q.ParamRegExp:c===`)`?u[u.length-1]==`\\`?u=u.slice(0,-1)+c:n=q.ParamRegExpEnd:u+=c;break;case q.ParamRegExpEnd:d(),n=q.Static,c!==`*`&&c!==`?`&&c!==`+`&&s--,u=``;break;default:t(`Unknown state`);break}}return n===q.ParamRegExp&&t(`Unfinished custom RegExp for param "${l}"`),d(),o(),i}var Jt=`[^/]+?`,Yt={sensitive:!1,strict:!1,start:!0,end:!0},J=function(e){return e[e._multiplier=10]=`_multiplier`,e[e.Root=90]=`Root`,e[e.Segment=40]=`Segment`,e[e.SubSegment=30]=`SubSegment`,e[e.Static=40]=`Static`,e[e.Dynamic=20]=`Dynamic`,e[e.BonusCustomRegExp=10]=`BonusCustomRegExp`,e[e.BonusWildcard=-50]=`BonusWildcard`,e[e.BonusRepeatable=-20]=`BonusRepeatable`,e[e.BonusOptional=-8]=`BonusOptional`,e[e.BonusStrict=.7000000000000001]=`BonusStrict`,e[e.BonusCaseSensitive=.25]=`BonusCaseSensitive`,e}(J||{}),Xt=/[.+*?^${}()[\]/\\]/g;function Zt(e,t){let n=H({},Yt,t),r=[],i=n.start?`^`:``,a=[];for(let t of e){let e=t.length?[]:[J.Root];n.strict&&!t.length&&(i+=`/`);for(let r=0;r<t.length;r++){let o=t[r],s=J.Segment+(n.sensitive?J.BonusCaseSensitive:0);if(o.type===Wt.Static)r||(i+=`/`),i+=o.value.replace(Xt,`\\$&`),s+=J.Static;else if(o.type===Wt.Param){let{value:e,repeatable:n,optional:c,regexp:l}=o;a.push({name:e,repeatable:n,optional:c});let u=l||Jt;if(u!==Jt){s+=J.BonusCustomRegExp;try{`${u}`}catch(t){throw Error(`Invalid custom RegExp for param "${e}" (${u}): `+t.message)}}let d=n?`((?:${u})(?:/(?:${u}))*)`:`(${u})`;r||(d=c&&t.length<2?`(?:/${d})`:`/`+d),c&&(d+=`?`),i+=d,s+=J.Dynamic,c&&(s+=J.BonusOptional),n&&(s+=J.BonusRepeatable),u===`.*`&&(s+=J.BonusWildcard)}e.push(s)}r.push(e)}if(n.strict&&n.end){let e=r.length-1;r[e][r[e].length-1]+=J.BonusStrict}n.strict||(i+=`/?`),n.end?i+=`$`:n.strict&&!i.endsWith(`/`)&&(i+=`(?:/|$)`);let o=new RegExp(i,n.sensitive?``:`i`);function s(e){let t=e.match(o),n={};if(!t)return null;for(let e=1;e<t.length;e++){let r=t[e]||``,i=a[e-1];n[i.name]=r&&i.repeatable?r.split(`/`):r}return n}function c(t){let n=``,r=!1;for(let i of e){(!r||!n.endsWith(`/`))&&(n+=`/`),r=!1;for(let e of i)if(e.type===Wt.Static)n+=e.value;else if(e.type===Wt.Param){let{value:a,repeatable:o,optional:s}=e,c=a in t?t[a]:``;if(U(c)&&!o)throw Error(`Provided param "${a}" is an array but it is not repeatable (* or + modifiers)`);let l=U(c)?c.join(`/`):c;if(!l)if(s)i.length<2&&(n.endsWith(`/`)?n=n.slice(0,-1):r=!0);else throw Error(`Missing required param "${a}"`);n+=l}}return n||`/`}return{re:o,score:r,keys:a,parse:s,stringify:c}}function Qt(e,t){let n=0;for(;n<e.length&&n<t.length;){let r=t[n]-e[n];if(r)return r;n++}return e.length<t.length?e.length===1&&e[0]===J.Static+J.Segment?-1:1:e.length>t.length?t.length===1&&t[0]===J.Static+J.Segment?1:-1:0}function $t(e,t){let n=0,r=e.score,i=t.score;for(;n<r.length&&n<i.length;){let e=Qt(r[n],i[n]);if(e)return e;n++}if(Math.abs(i.length-r.length)===1){if(en(r))return 1;if(en(i))return-1}return i.length-r.length}function en(e){let t=e[e.length-1];return e.length>0&&t[t.length-1]<0}var tn={strict:!1,end:!0,sensitive:!1};function nn(e,t,n){let r=H(Zt(qt(e.path),n),{record:e,parent:t,children:[],alias:[]});return t&&!r.record.aliasOf==!t.record.aliasOf&&t.children.push(r),r}function rn(e,t){let n=[],r=new Map;t=je(tn,t);function i(e){return r.get(e)}function a(e,n,r){let i=!r,s=on(e);s.aliasOf=r&&r.record;let l=je(t,e),u=[s];if(`alias`in e){let t=typeof e.alias==`string`?[e.alias]:e.alias;for(let e of t)u.push(on(H({},s,{components:r?r.record.components:s.components,path:e,aliasOf:r?r.record:s})))}let d,f;for(let t of u){let{path:u}=t;if(n&&u[0]!==`/`){let e=n.record.path,r=e[e.length-1]===`/`?``:`/`;t.path=n.record.path+(u&&r+u)}if(d=nn(t,n,l),r?r.alias.push(d):(f||=d,f!==d&&f.alias.push(d),i&&e.name&&!cn(d)&&o(e.name)),fn(d)&&c(d),s.children){let e=s.children;for(let t=0;t<e.length;t++)a(e[t],d,r&&r.children[t])}r||=d}return f?()=>{o(f)}:Ae}function o(e){if(St(e)){let t=r.get(e);t&&(r.delete(e),n.splice(n.indexOf(t),1),t.children.forEach(o),t.alias.forEach(o))}else{let t=n.indexOf(e);t>-1&&(n.splice(t,1),e.record.name&&r.delete(e.record.name),e.children.forEach(o),e.alias.forEach(o))}}function s(){return n}function c(e){let t=un(e,n);n.splice(t,0,e),e.record.name&&!cn(e)&&r.set(e.record.name,e)}function l(e,t){let i,a={},o,s;if(`name`in e&&e.name){if(i=r.get(e.name),!i)throw wt(K.MATCHER_NOT_FOUND,{location:e});s=i.record.name,a=H(an(t.params,i.keys.filter(e=>!e.optional).concat(i.parent?i.parent.keys.filter(e=>e.optional):[]).map(e=>e.name)),e.params&&an(e.params,i.keys.map(e=>e.name))),o=i.stringify(a)}else if(e.path!=null)o=e.path,i=n.find(e=>e.re.test(o)),i&&(a=i.parse(o),s=i.record.name);else{if(i=t.name?r.get(t.name):n.find(e=>e.re.test(t.path)),!i)throw wt(K.MATCHER_NOT_FOUND,{location:e,currentLocation:t});s=i.record.name,a=H({},t.params,e.params),o=i.stringify(a)}let c=[],l=i;for(;l;)c.unshift(l.record),l=l.parent;return{name:s,path:o,params:a,matched:c,meta:ln(c)}}e.forEach(e=>a(e));function u(){n.length=0,r.clear()}return{addRoute:a,resolve:l,removeRoute:o,clearRoutes:u,getRoutes:s,getRecordMatcher:i}}function an(e,t){let n={};for(let r of t)r in e&&(n[r]=e[r]);return n}function on(e){let t={path:e.path,redirect:e.redirect,name:e.name,meta:e.meta||{},aliasOf:e.aliasOf,beforeEnter:e.beforeEnter,props:sn(e),children:e.children||[],instances:{},leaveGuards:new Set,updateGuards:new Set,enterCallbacks:{},components:`components`in e?e.components||null:e.component&&{default:e.component}};return Object.defineProperty(t,`mods`,{value:{}}),t}function sn(e){let t={},n=e.props||!1;if(`component`in e)t.default=n;else for(let r in e.components)t[r]=typeof n==`object`?n[r]:n;return t}function cn(e){for(;e;){if(e.record.aliasOf)return!0;e=e.parent}return!1}function ln(e){return e.reduce((e,t)=>H(e,t.meta),{})}function un(e,t){let n=0,r=t.length;for(;n!==r;){let i=n+r>>1;$t(e,t[i])<0?r=i:n=i+1}let i=dn(e);return i&&(r=t.lastIndexOf(i,r-1)),r}function dn(e){let t=e;for(;t=t.parent;)if(fn(t)&&$t(e,t)===0)return t}function fn({record:e}){return!!(e.name||e.components&&Object.keys(e.components).length||e.redirect)}function pn(e){let t=a(jt),n=a(Mt),r=L(()=>{let n=C(e.to);return t.resolve(n)}),i=L(()=>{let{matched:e}=r.value,{length:t}=e,i=e[t-1],a=n.matched;if(!i||!a.length)return-1;let o=a.findIndex(rt.bind(null,i));if(o>-1)return o;let s=vn(e[t-2]);return t>1&&vn(i)===s&&a[a.length-1].path!==s?a.findIndex(rt.bind(null,e[t-2])):o}),o=L(()=>i.value>-1&&_n(n.params,r.value.params)),s=L(()=>i.value>-1&&i.value===n.matched.length-1&&it(n.params,r.value.params));function c(n={}){if(gn(n)){let n=t[C(e.replace)?`replace`:`push`](C(e.to)).catch(Ae);return e.viewTransition&&typeof document<`u`&&`startViewTransition`in document&&document.startViewTransition(()=>n),n}return Promise.resolve()}return{route:r,href:L(()=>r.value.href),isActive:o,isExactActive:s,navigate:c}}function mn(e){return e.length===1?e[0]:e}var hn=l({name:`RouterLink`,compatConfig:{MODE:3},props:{to:{type:[String,Object],required:!0},replace:Boolean,activeClass:String,exactActiveClass:String,custom:Boolean,ariaCurrentValue:{type:String,default:`page`},viewTransition:Boolean},useLink:pn,setup(e,{slots:t}){let n=D(pn(e)),{options:r}=a(jt),i=L(()=>({[yn(e.activeClass,r.linkActiveClass,`router-link-active`)]:n.isActive,[yn(e.exactActiveClass,r.linkExactActiveClass,`router-link-exact-active`)]:n.isExactActive}));return()=>{let r=t.default&&mn(t.default(n));return e.custom?r:d(`a`,{"aria-current":n.isExactActive?e.ariaCurrentValue:null,href:n.href,onClick:n.navigate,class:i.value},r)}}});function gn(e){if(!(e.metaKey||e.altKey||e.ctrlKey||e.shiftKey)&&!e.defaultPrevented&&!(e.button!==void 0&&e.button!==0)){if(e.currentTarget&&e.currentTarget.getAttribute){let t=e.currentTarget.getAttribute(`target`);if(/\b_blank\b/i.test(t))return}return e.preventDefault&&e.preventDefault(),!0}}function _n(e,t){for(let n in t){let r=t[n],i=e[n];if(typeof r==`string`){if(r!==i)return!1}else if(!U(i)||i.length!==r.length||r.some((e,t)=>e.valueOf()!==i[t].valueOf()))return!1}return!0}function vn(e){return e?e.aliasOf?e.aliasOf.path:e.path:``}var yn=(e,t,n)=>e??t??n,bn=l({name:`RouterView`,inheritAttrs:!1,props:{name:{type:String,default:`default`},route:Object},compatConfig:{MODE:3},setup(e,{attrs:t,slots:n}){let r=a(Nt),i=L(()=>e.route||r.value),o=a(At,0),s=L(()=>{let e=C(o),{matched:t}=i.value,n;for(;(n=t[e])&&!n.components;)e++;return e}),c=L(()=>i.value.matched[s.value]);g(At,L(()=>s.value+1)),g(kt,c),g(Nt,i);let l=x();return y(()=>[l.value,c.value,e.name],([e,t,n],[r,i,a])=>{t&&(t.instances[n]=e,i&&i!==t&&e&&e===r&&(t.leaveGuards.size||(t.leaveGuards=i.leaveGuards),t.updateGuards.size||(t.updateGuards=i.updateGuards))),e&&t&&(!i||!rt(t,i)||!r)&&(t.enterCallbacks[n]||[]).forEach(t=>t(e))},{flush:`post`}),()=>{let r=i.value,a=e.name,o=c.value,s=o&&o.components[a];if(!s)return xn(n.default,{Component:s,route:r});let u=o.props[a],f=d(s,H({},u?u===!0?r.params:typeof u==`function`?u(r):u:null,t,{onVnodeUnmounted:e=>{e.component.isUnmounted&&(o.instances[a]=null)},ref:l}));return xn(n.default,{Component:f,route:r})||f}}});function xn(e,t){if(!e)return null;let n=e(t);return n.length===1?n[0]:n}var Sn=bn;function Cn(e){let t=rn(e.routes,e),n=e.parseQuery||Et,r=e.stringifyQuery||Dt,i=e.history,a=Pt(),o=Pt(),s=Pt(),c=ee(ct),l=ct;Ee&&e.scrollBehavior&&`scrollRestoration`in history&&(history.scrollRestoration=`manual`);let u=ke.bind(null,e=>``+e),d=ke.bind(null,Xe),f=ke.bind(null,Ze);function m(e,n){let r,i;return St(e)?(r=t.getRecordMatcher(e),i=n):i=e,t.addRoute(i,r)}function h(e){let n=t.getRecordMatcher(e);n&&t.removeRoute(n)}function g(){return t.getRoutes().map(e=>e.record)}function _(e){return!!t.getRecordMatcher(e)}function v(e,a){if(a=H({},a||c.value),typeof e==`string`){let r=et(n,e,a.path),o=t.resolve({path:r.path},a),s=i.createHref(r.fullPath);return H(r,o,{params:f(o.params),hash:Ze(r.hash),redirectedFrom:void 0,href:s})}let o;if(e.path!=null)o=H({},e,{path:et(n,e.path,a.path).path});else{let t=H({},e.params);for(let e in t)t[e]??delete t[e];o=H({},e,{params:d(t)}),a.params=d(a.params)}let s=t.resolve(o,a),l=e.hash||``;s.params=u(f(s.params));let p=tt(r,H({},e,{hash:Ke(l),path:s.path})),m=i.createHref(p);return H({fullPath:p,hash:l,query:r===Dt?Ot(e.query):e.query||{}},s,{redirectedFrom:void 0,href:m})}function y(e){return typeof e==`string`?et(n,e,c.value.path):H({},e)}function b(e,t){if(l!==e)return wt(K.NAVIGATION_CANCELLED,{from:t,to:e})}function x(e){return T(e)}function S(e){return x(H(y(e),{replace:!0}))}function w(e,t){let n=e.matched[e.matched.length-1];if(n&&n.redirect){let{redirect:r}=n,i=typeof r==`function`?r(e,t):r;return typeof i==`string`&&(i=i.includes(`?`)||i.includes(`#`)?i=y(i):{path:i},i.params={}),H({query:e.query,hash:e.hash,params:i.path==null?e.params:{}},i)}}function T(e,t){let n=l=v(e),i=c.value,a=e.state,o=e.force,s=e.replace===!0,u=w(n,i);if(u)return T(H(y(u),{state:typeof u==`object`?H({},a,u.state):a,force:o,replace:s}),t||n);let d=n;d.redirectedFrom=t;let f;return!o&&nt(r,i,n)&&(f=wt(K.NAVIGATION_DUPLICATED,{to:d,from:i}),ne(i,i,!0,!1)),(f?Promise.resolve(f):O(d,i)).catch(e=>Tt(e)?Tt(e,K.NAVIGATION_GUARD_REDIRECT)?e:R(e):I(e,d,i)).then(e=>{if(e){if(Tt(e,K.NAVIGATION_GUARD_REDIRECT))return T(H({replace:s},y(e.to),{state:typeof e.to==`object`?H({},a,e.to.state):a,force:o}),t||d)}else e=A(d,i,!0,s,a);return k(d,i,e),e})}function E(e,t){let n=b(e,t);return n?Promise.reject(n):Promise.resolve()}function D(e){let t=re.values().next().value;return t&&typeof t.runWithContext==`function`?t.runWithContext(e):e()}function O(e,t){let n,[r,i,s]=Lt(e,t);n=It(r.reverse(),`beforeRouteLeave`,e,t);for(let i of r)i.leaveGuards.forEach(r=>{n.push(Ft(r,e,t))});let c=E.bind(null,e,t);return n.push(c),ae(n).then(()=>{n=[];for(let r of a.list())n.push(Ft(r,e,t));return n.push(c),ae(n)}).then(()=>{n=It(i,`beforeRouteUpdate`,e,t);for(let r of i)r.updateGuards.forEach(r=>{n.push(Ft(r,e,t))});return n.push(c),ae(n)}).then(()=>{n=[];for(let r of s)if(r.beforeEnter)if(U(r.beforeEnter))for(let i of r.beforeEnter)n.push(Ft(i,e,t));else n.push(Ft(r.beforeEnter,e,t));return n.push(c),ae(n)}).then(()=>(e.matched.forEach(e=>e.enterCallbacks={}),n=It(s,`beforeRouteEnter`,e,t,D),n.push(c),ae(n))).then(()=>{n=[];for(let r of o.list())n.push(Ft(r,e,t));return n.push(c),ae(n)}).catch(e=>Tt(e,K.NAVIGATION_CANCELLED)?e:Promise.reject(e))}function k(e,t,n){s.list().forEach(r=>D(()=>r(e,t,n)))}function A(e,t,n,r,a){let o=b(e,t);if(o)return o;let s=t===ct,l=Ee?history.state:{};n&&(r||s?i.replace(e.fullPath,H({scroll:s&&l&&l.scroll},a)):i.push(e.fullPath,a)),c.value=e,ne(e,t,n,s),R()}let M;function N(){M||=i.listen((e,t,n)=>{if(!ie.listening)return;let r=v(e),a=w(r,ie.currentRoute.value);if(a){T(H(a,{replace:!0,force:!0}),r).catch(Ae);return}l=r;let o=c.value;Ee&&yt(_t(o.fullPath,n.delta),ht()),O(r,o).catch(e=>Tt(e,K.NAVIGATION_ABORTED|K.NAVIGATION_CANCELLED)?e:Tt(e,K.NAVIGATION_GUARD_REDIRECT)?(T(H(y(e.to),{force:!0}),r).then(e=>{Tt(e,K.NAVIGATION_ABORTED|K.NAVIGATION_DUPLICATED)&&!n.delta&&n.type===lt.pop&&i.go(-1,!1)}).catch(Ae),Promise.reject()):(n.delta&&i.go(-n.delta,!1),I(e,r,o))).then(e=>{e||=A(r,o,!1),e&&(n.delta&&!Tt(e,K.NAVIGATION_CANCELLED)?i.go(-n.delta,!1):n.type===lt.pop&&Tt(e,K.NAVIGATION_ABORTED|K.NAVIGATION_DUPLICATED)&&i.go(-1,!1)),k(r,o,e)}).catch(Ae)})}let P=Pt(),te=Pt(),F;function I(e,t,n){R(e);let r=te.list();return r.length?r.forEach(r=>r(e,t,n)):console.error(e),Promise.reject(e)}function L(){return F&&c.value!==ct?Promise.resolve():new Promise((e,t)=>{P.add([e,t])})}function R(e){return F||(F=!e,N(),P.list().forEach(([t,n])=>e?n(e):t()),P.reset()),e}function ne(t,n,r,i){let{scrollBehavior:a}=e;if(!Ee||!a)return Promise.resolve();let o=!r&&bt(_t(t.fullPath,0))||(i||!r)&&history.state&&history.state.scroll||null;return p().then(()=>a(t,n,o)).then(e=>e&&gt(e)).catch(e=>I(e,t,n))}let z=e=>i.go(e),B,re=new Set,ie={currentRoute:c,listening:!0,addRoute:m,removeRoute:h,clearRoutes:t.clearRoutes,hasRoute:_,getRoutes:g,resolve:v,options:e,push:x,replace:S,go:z,back:()=>z(-1),forward:()=>z(1),beforeEach:a.add,beforeResolve:o.add,afterEach:s.add,onError:te.add,isReady:L,install(e){e.component(`RouterLink`,hn),e.component(`RouterView`,Sn),e.config.globalProperties.$router=ie,Object.defineProperty(e.config.globalProperties,`$route`,{enumerable:!0,get:()=>C(c)}),Ee&&!B&&c.value===ct&&(B=!0,x(i.location).catch(e=>{}));let t={};for(let e in ct)Object.defineProperty(t,e,{get:()=>c.value[e],enumerable:!0});e.provide(jt,ie),e.provide(Mt,j(t)),e.provide(Nt,c);let n=e.unmount;re.add(e),e.unmount=function(){re.delete(e),re.size<1&&(l=ct,M&&M(),M=null,c.value=ct,B=!1,F=!1),n()}}};function ae(e){return e.reduce((e,t)=>e.then(()=>D(t)),Promise.resolve())}return ie}function wn(){return a(jt)}var Tn=[`data-language`,`data-highlighted`],En=[`innerHTML`],Dn={key:1},On=M(l({__name:`HighlightedCode`,props:{code:{},language:{}},setup(e){let t=e,n=x(null);_(()=>{y([()=>t.code,()=>t.language],([e,t],r,i)=>{if(n.value=null,!e)return;let a,o,s=!0,c=()=>{s=!1,clearTimeout(o),a?.terminate()};i(c);try{a=new Worker(new URL(`/assets/highlightCode.worker-Cuil3Vkm.js`,``+import.meta.url),{type:`module`}),a.onmessage=e=>{s&&typeof e.data==`string`&&(n.value=e.data),c()},a.onerror=c,a.onmessageerror=c,o=setTimeout(c,1e4),a.postMessage({code:e,language:t})}catch{c()}},{immediate:!0,flush:`sync`})});let r=e=>{if(!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!==`a`)return;let t=e.currentTarget,n=window.getSelection();if(!(t instanceof HTMLElement)||!n)return;e.preventDefault(),e.stopPropagation();let r=document.createRange();r.selectNodeContents(t),n.removeAllRanges(),n.addRange(r)};return(t,i)=>(s(),u(`pre`,{class:`highlighted-code`,tabindex:`0`,"data-language":e.language,"data-highlighted":n.value!==null,onKeydown:r},[n.value===null?(s(),u(`code`,Dn,T(e.code),1)):(s(),u(`code`,{key:0,innerHTML:n.value},null,8,En))],40,Tn))}}),[[`__scopeId`,`data-v-bf896bec`]]),kn={class:`experiment-panel`},An={class:`control-fields-grid`},jn={class:`field field-compact`,title:`仿真停止时间；省略单位按秒，支持 30s、500ms`},Mn=[`value`],Nn={key:0,class:`experiment-warnings`},Pn={"aria-label":`实验文件`},Fn={class:`control-btn-row`},In={class:`control-btn-row`},Ln={class:`code-modal`,role:`dialog`,"aria-modal":`true`},Rn={class:`code-modal-head`},zn={class:`code-modal-actions`},Bn={__name:`ExperimentPanel`,props:{form:{type:Object,required:!0},specJson:{type:String,required:!0},scratchCc:{type:String,default:``},warnings:{type:Array,default:()=>[]},nodeCount:{type:Number,default:0},selectedCount:{type:Number,default:0},selectedSummary:{type:String,default:``},runStatus:{type:String,default:`idle`}},emits:[`update-field`,`sync-from-replay`,`apply-to-replay`,`add-node`,`remove-node`,`run`],setup(e,{emit:t}){let a=e,c=t,l=x(null),d=x(null),f=null,g=async e=>{f=document.activeElement,l.value=e,await p(),l.value===e&&d.value?.focus()},_=()=>{l.value=null,f?.isConnected&&f.focus({preventScroll:!0}),f=null},b=L(()=>l.value===`cc`?`scratch/aqua-visual.cc`:`experiment.json`),S=L(()=>l.value===`cc`?a.scratchCc:a.specJson),C=e=>{e.key!==`Escape`||e.isComposing||(e.preventDefault(),e.stopPropagation(),_())};y(l,e=>{e?window.addEventListener(`keydown`,C,!0):window.removeEventListener(`keydown`,C,!0)}),z(()=>window.removeEventListener(`keydown`,C,!0));let w=async()=>{try{await navigator.clipboard.writeText(S.value||``)}catch{}},E=(e,t)=>{c(`update-field`,e,t?.target?t.target.value:t)};return(t,a)=>(s(),u(`div`,kn,[a[7]||=h(`div`,{class:`dock-title`},`全局仿真参数`,-1),h(`div`,An,[h(`label`,jn,[a[5]||=h(`div`,{class:`field-head`},[h(`span`,null,`仿真时长（s）`),h(`span`,{class:`field-param`},`simStop`)],-1),h(`input`,{class:`select`,value:e.form.simStop,placeholder:`如 30、30s 或 500ms`,onInput:a[0]||=e=>E(`simStop`,e)},null,40,Mn)])]),e.warnings.length?(s(),u(`ul`,Nn,[(s(!0),u(m,null,v(e.warnings,e=>(s(),u(`li`,{key:e},T(e),1))),128))])):r(``,!0),h(`section`,Pn,[a[6]||=h(`div`,{class:`dock-title`},`实验文件`,-1),h(`div`,Fn,[h(`button`,{class:`btn btn-compact`,title:`查看实验规格 JSON`,onClick:a[1]||=e=>g(`json`)},`预览 JSON`),h(`button`,{class:`btn btn-compact`,title:`查看生成的 ns-3 仿真代码`,onClick:a[2]||=e=>g(`cc`)},`预览代码`)]),o(t.$slots,`experiment-files`)]),a[8]||=h(`div`,{class:`dock-title`},`回放联动`,-1),h(`div`,In,[h(`button`,{class:`btn btn-compact`,title:`从回放页读取节点拓扑`,onClick:a[3]||=e=>c(`sync-from-replay`)},`从回放导入`),h(`button`,{class:`btn btn-compact`,title:`将当前拓扑发送到回放页`,onClick:a[4]||=e=>c(`apply-to-replay`)},`发送到回放`)]),(s(),i(n,{to:`body`},[l.value?(s(),u(`div`,{key:0,class:`code-modal-backdrop`,onClick:R(_,[`self`])},[h(`div`,Ln,[h(`div`,Rn,[h(`span`,null,T(b.value),1),h(`div`,zn,[h(`button`,{class:`btn btn-compact`,onClick:w},`复制`),h(`button`,{ref_key:`viewerCloseButton`,ref:d,class:`btn btn-compact`,onClick:_},`关闭`,512)])]),O(On,{class:`code-modal-body`,code:S.value,language:l.value===`cc`?`cpp`:`json`,"aria-label":b.value},null,8,[`code`,`language`,`aria-label`])])])):r(``,!0)]))]))}},Vn=[`app`,`routing`,`mac`,`phy`,`channel`,`mobility`],Hn=e=>{let t=e=>{let t=Vn.indexOf(e);return t<0?Vn.length:t};return[...e].sort((e,n)=>t(e.id)-t(n.id))},Y=Hn([{id:`phy`,label:`物理层`,field:`phyId`,items:[]},{id:`mac`,label:`MAC`,field:`macId`,items:[]},{id:`routing`,label:`路由`,field:`routingId`,items:[]},{id:`app`,label:`应用层`,field:`appId`,items:[]},{id:`channel`,label:`信道`,field:`channelId`,scope:`scene`,items:[]},{id:`mobility`,label:`移动模型`,field:`mobilityId`,scope:`node`,items:[]}]),Un=(e,t,n=Y)=>n.find(t=>t.id===e)?.items.find(e=>e.id===t||e.typeId===t)||null,Wn=`application/x-aqua-item`,Gn={class:`protocol-drawer`},Kn={class:`protocol-library`,"aria-label":`协议库`},qn={class:`rail-wrap`},Jn={class:`rail`,"aria-label":`协议层`},Yn=[`onClick`],Xn={key:0,class:`flyout`},Zn={class:`flyout-head`},Qn={key:0,class:`catalog-hint`},$n={key:1,class:`catalog-hint`},er={class:`flyout-list`},tr=[`draggable`,`disabled`,`data-layer`,`data-item-id`,`title`,`onDragstart`,`onClick`],nr={class:`lib-item-name`},rr={class:`lib-item-tid`},ir=[`aria-label`,`title`,`data-source-type-id`,`onClick`],ar={class:`applied-protocols`,"aria-label":`已应用协议`},or={class:`applied-scroll`},sr={class:`stack-list`},cr={class:`stack-details`},lr={class:`stack-summary`},ur={class:`stack-heading`},dr={class:`stack-layer`},fr=[`title`],pr={class:`stack-content`},mr=[`title`],hr={key:0,class:`stack-src`},gr=M({__name:`ProtocolDrawer`,props:{layers:{type:Array,default:()=>Y},ready:{type:Boolean,default:!1},activeId:{type:String,default:``},appliedProtocols:{type:Array,default:()=>[]}},emits:[`assign`,`view-source`],setup(e,{emit:t}){let n=e,i=t,a=x(`mac`),c=e=>{a.value=a.value===e?``:e},l=L(()=>Hn(n.layers)),d=L(()=>n.layers.find(e=>e.id===a.value)||null),p=L(()=>n.ready&&d.value?.items||[]),g=(e,t,r)=>{if(!n.ready){r.preventDefault();return}let i=JSON.stringify({layer:e.id,id:t.id,typeId:t.typeId,field:t.field||e.field,scope:e.scope||`node`});r.dataTransfer.effectAllowed=`copy`,r.dataTransfer.setData(Wn,i),r.dataTransfer.setData(`text/plain`,i)},_=(e,t)=>{n.ready&&i(`assign`,{layer:e.id,id:t.id,typeId:t.typeId,field:t.field||e.field,scope:e.scope||`node`})},y=(e,t)=>n.activeId===`${e.id}:${t.id}`||n.activeId===`${e.id}:${t.typeId}`,b=e=>e?e.replace(/^ns3::/,``):`—`,S=e=>({phy:`PHY`,mac:`MAC`,routing:`RT`,app:`APP`,channel:`CH`})[e]||e;return(t,n)=>(s(),u(`div`,Gn,[h(`section`,Kn,[n[3]||=h(`h2`,{class:`drawer-heading`},`协议库`,-1),h(`div`,qn,[h(`nav`,Jn,[(s(!0),u(m,null,v(l.value,e=>(s(),u(`button`,{key:e.id,class:k([`rail-btn`,{on:a.value===e.id}]),type:`button`,onClick:t=>c(e.id)},T(S(e.id)),11,Yn))),128))]),O(A,{name:`flyout`},{default:f(()=>[d.value?(s(),u(`section`,Xn,[h(`header`,Zn,T(d.value.label),1),e.ready?p.value.length?r(``,!0):(s(),u(`p`,$n,`此目录未注册该层的可用协议。`)):(s(),u(`p`,Qn,`请先预编译，读取此目录实际注册的协议。`)),h(`div`,er,[(s(!0),u(m,null,v(p.value,t=>(s(),u(`div`,{key:t.id,class:`lib-item-row`},[h(`button`,{class:k([`lib-item`,{active:y(d.value,t)}]),type:`button`,draggable:e.ready,disabled:!e.ready,"data-layer":d.value.id,"data-item-id":t.id,title:t.requirement||t.label,onDragstart:e=>g(d.value,t,e),onClick:e=>_(d.value,t)},[h(`span`,nr,T(t.label),1),h(`span`,rr,T(b(t.typeId)),1)],42,tr),t.typeId&&t.id!==`none`?(s(),u(`button`,{key:0,class:`protocol-source-button`,type:`button`,"aria-label":`查看 ${t.label} 源码`,title:`查看 ${t.typeId} 源码`,"data-source-type-id":t.typeId,draggable:!1,onPointerdown:n[0]||=R(()=>{},[`stop`]),onDragstart:n[1]||=R(()=>{},[`prevent`,`stop`]),onClick:R(e=>i(`view-source`,t),[`stop`])},[...n[2]||=[h(`svg`,{viewBox:`0 0 24 24`,width:`16`,height:`16`,fill:`none`,stroke:`currentColor`,"stroke-width":`1.6`,"aria-hidden":`true`},[h(`path`,{d:`M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z`}),h(`circle`,{cx:`12`,cy:`12`,r:`3`})],-1)]],40,ir)):r(``,!0)]))),128))])])):r(``,!0)]),_:1})])]),h(`section`,ar,[n[4]||=h(`h2`,{class:`drawer-heading`},`已应用协议`,-1),h(`div`,or,[h(`ol`,sr,[(s(!0),u(m,null,v(e.appliedProtocols,e=>(s(),u(`li`,{key:e.key,class:`stack-row`},[h(`details`,cr,[h(`summary`,lr,[h(`span`,ur,[h(`span`,dr,T(e.layer),1),h(`span`,{class:`stack-name`,title:e.name},T(e.name),9,fr)])]),h(`div`,pr,[h(`span`,{class:`stack-tid`,title:e.typeId},T(e.typeId),9,mr),e.source?(s(),u(`span`,hr,T(e.source),1)):r(``,!0),o(t.$slots,`protocol-settings`,{layerId:e.key},void 0,!0)])])]))),128))])])])]))}},[[`__scopeId`,`data-v-8ee953a8`]]),_r=[`ns3::DoubleValue`,`ns3::IntegerValue`,`ns3::UintegerValue`],vr=e=>_r.includes(e.valueType),yr=e=>{if(e.valueType===`ns3::TimeValue`)return`s`;if(e.valueType===`ns3::DataRateValue`)return`bps`;if(!vr(e)&&e.valueType!==`ns3::Vector3DValue`)return null;let t=e.help||``,n=[...t.matchAll(/\[unit\s*=\s*([^\]]+)\]/gi)];if(n.length){let e=n.map(e=>V(e[1]));return e[0]&&e.every(t=>t===e[0])?e[0]:null}let r=new Set;for(let e of t.matchAll(/\(([^()]+)\)|\[([^\[\]]+)\]|\bin\s+(meters?|metres?|seconds?|milliseconds?|bytes?)(?=\s*(?:[.;,]|$))/gi)){let t=V(e[1]||e[2]||e[3]);t&&r.add(t)}return r.size===1?[...r][0]:null},br=e=>Object.fromEntries(Object.entries(e).filter(([,e])=>typeof e!=`string`||e.trim()!==``)),xr=(e,t)=>{let n=String(t).trim();if((vr(e)||e.valueType===`ns3::TimeValue`||e.valueType===`ns3::DataRateValue`)&&typeof t!=`string`&&typeof t!=`number`)throw Error(`请输入有效数值`);let r=yr(e);if(e.valueType===`ns3::TimeValue`){let e=pe(n,`s`).value;if(Math.abs(e)>9223372036)throw Error(`超出仿真时钟可表示的范围`);let t=n.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-zµμ]*)$/i);return`${t[1].toLowerCase()}${V((t[2]||`s`).toLowerCase())||`s`}`}if(e.valueType===`ns3::Vector3DValue`&&r){let e=n.split(`:`);if(e.length!==3)throw Error(`向量需要 x:y:z 三个分量`);return e.map(e=>String(pe(e,r).value)).join(`:`)}if(r){let t=[`ns3::IntegerValue`,`ns3::UintegerValue`].includes(e.valueType),i=pe(n,r,t||e.valueType===`ns3::DataRateValue`).value;if([`ns3::IntegerValue`,`ns3::UintegerValue`,`ns3::DataRateValue`].includes(e.valueType)&&!Number.isSafeInteger(i)&&!(fe(n)&&/^[+-]?\d+$/.test(n)))throw Error(`换算到 ${r} 后必须是安全范围内的整数`);if(e.valueType===`ns3::DataRateValue`){if(i<0)throw Error(`速率必须非负`);return`${fe(n)&&/^[+]?\d+$/.test(n)?n.replace(/^\+/,``):i}bps`}return t?fe(n)?re(n):String(i):fe(n)?n:String(i)}if(vr(e)){if(!fe(n))throw Error(`注册信息未声明单位，请填写纯数字`);if([`ns3::IntegerValue`,`ns3::UintegerValue`].includes(e.valueType))return re(n);if(!Number.isFinite(Number(n)))throw Error(`数值超出有效范围`)}return String(t)},Sr=e=>{let t=yr(e);return t?`${e.valueType===`ns3::Vector3DValue`?`x:y:z · `:``}省略单位按 ${t===`bps`?`bit/s`:t}`:vr(e)?`按注册数值填写，单位未声明`:``},Cr=(e,t)=>{let n=yr(e);return n&&fe(t)?`${t} ${n===`bps`?`bit/s`:n}`:t},wr=[`phy`,`mac`,`routing`],Tr=(e,t)=>wr.map(n=>{let r=e.stack[n],i=`attrs`in r?{...r.attrs}:{};return n===`phy`&&delete i.txPower,{layerId:n,typeId:r.type,attributes:{...br(i),...br(e.protocolAttributes?.[r.type]||{}),...br(t?.protocolAttributes?.[r.type]||{})}}}),Er=65534,Dr=e=>typeof e==`number`&&Number.isInteger(e)&&e>=1&&e<=65534,Or=(e,t=0)=>{let n=[];e.length<t&&n.push(`至少需要 ${t} 个节点`),e.length>64&&n.push(`最多支持 64 个节点`);let r=e.map(e=>e?.id);r.some(e=>!Dr(e))&&n.push(`节点编号必须是 1–${Er} 的整数`),new Set(r).size!==r.length&&n.push(`节点编号不能重复`);for(let t of e)t?.modelType!==void 0&&!F(t.modelType)&&n.push(`节点 ${t?.id} 的模型类型 modelType 无效`);return e.some(e=>[e?.x,e?.y,e?.z===void 0?0:e.z].some(e=>typeof e!=`number`||!Number.isFinite(e)))&&n.push(`节点坐标必须是有效数字`),n},kr=e=>{let t=new Set(e.filter(Dr)),n=t.size?Math.max(...t)+1:1;if(n<=65534)return n;for(let e=1;e<=Er;e++)if(!t.has(e))return e;return null},Ar=9223372036,jr=(e,t,n=!1)=>{let r;try{r=pe(e,`s`).value}catch(e){throw Error(`${t}：${e instanceof Error?e.message:String(e)}`)}let i=String(e).trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-zµμ]*)$/i),a=V((i[2]||`s`).toLowerCase())||`s`;if(!Number.isFinite(r)||!n&&r<0)throw Error(`${t} 必须是${n?``:`非负的`}有效时间`);if(Math.abs(r)>Ar)throw Error(`${t} 超出仿真时钟可表示的范围`);return{literal:`${i[1].toLowerCase()}${a}`,seconds:r}},Mr=(e,t,n)=>jr((e===void 0||typeof e==`string`&&!e.trim())&&n!==void 0?n:e,t).literal,Nr=(e,t)=>!!e?.attributes?.some(e=>e.name===t&&e.valueType===`ns3::TimeValue`),Pr=(e,t=Y)=>{let n=[],r=e=>{try{e()}catch(e){n.push(e instanceof Error?e.message:String(e))}};r(()=>Mr(e.simStop,`仿真时长 simStop`));let i=e.protocolAttributes||{},a=e=>t.flatMap(e=>e.items).find(t=>t.typeId===e),o=(e,t,n=e)=>{let i=a(e);for(let[e,a]of Object.entries(br(t)))Nr(i,e)&&r(()=>jr(a,`${n}.${e}`,!0))};for(let t of e.nodes.length?e.nodes:[void 0])for(let n of Tr(e,t))n.typeId&&o(n.typeId,n.attributes,t?`节点 ${t.id} 的 ${n.typeId}`:n.typeId);for(let t of[e.channel?.type,e.channel?.propagation])t&&o(t,i[t]||{});for(let t of e.nodes||[])t.app&&o(t.app,t.appAttrs||{},`节点 ${t.id} 的 ${t.app}`),t.mobility?.type&&o(t.mobility.type,t.protocolAttributes?.[t.mobility.type]||{},`节点 ${t.id} 的 ${t.mobility.type}`);return n},Fr=e=>!!e?.attributes?.some(e=>e.name===`Protocol`&&e.valueType===`ns3::TypeIdValue`&&e.constructible!==!1)&&!!e.attributes.some(e=>e.name===`Remote`&&e.valueType===`ns3::AddressValue`&&e.constructible!==!1),Ir=(e,t,n)=>Fr(e)&&[`Protocol`,`Remote`].includes(t.name)?{editable:!1,managed:!0,reason:`由节点目的地址与公共 Socket 接口连接`}:n===`channel`&&e.field!==`propagationId`&&t.pointeeTypeId===`ns3::AquaSimPropagation`?{editable:!1,managed:!0,reason:`由已选择的传播模型连接`}:[`phy`,`mac`,`routing`].includes(n||``)&&t.name===`SetDevice`&&t.valueType===`ns3::PointerValue`?{editable:!1,managed:!0,reason:`由所在节点的公共设备接口连接`}:n===`mobility`&&t.name===`Position`&&[`ns3::VectorValue`,`ns3::Vector3DValue`].includes(t.valueType)?{editable:!1,managed:!0,reason:`由节点坐标设置初始位置`}:t.constructible===!1?{editable:!1,managed:!1,reason:`注册接口不允许在构造时配置`}:[`ns3::ObjectVectorValue`,`ns3::ObjectMapValue`].includes(t.valueType)?{editable:!1,managed:!1,reason:`对象容器暂不支持文本配置`}:{editable:!0,managed:!1,reason:``},Lr=(e,t)=>{let n=[],r=e.protocolAttributes||{},i=(e,n,r=!1)=>t.find(t=>t.id===e)?.items.find(t=>t.typeId===n&&(e!==`channel`||t.field===`propagationId`===r)),a=(e,r,a,o=r,s=!1)=>{if(!r){n.push(`请选择${s?`传播模型`:t.find(t=>t.id===e)?.label||e}协议`);return}let c=i(e,r,s);if(!c){n.push(`${e} 未注册协议：${r}，请先预编译`);return}if(!c.attributes){n.push(`${r} 缺少注册属性信息，请先预编译`);return}for(let[t,r]of Object.entries(br(a))){let i=c.attributes.find(e=>e.name===t);if(!i){n.push(`${o} 没有属性 ${t}`);continue}let a=Ir(c,i,e);if(a.editable||n.push(`${o}.${t}：${a.reason}`),![`string`,`number`,`boolean`].includes(typeof r))n.push(`${o}.${t} 必须是标量属性值`);else if(a.editable)try{xr(i,r)}catch(e){n.push(`${o}.${t}：${e instanceof Error?e.message:String(e)}`)}}};for(let t of e.nodes.length?e.nodes:[void 0])for(let n of Tr(e,t))a(n.layerId,n.typeId,n.attributes,t?`节点 ${t.id} 的 ${n.typeId}`:n.typeId);a(`channel`,e.channel?.type,r[e.channel?.type]||{}),a(`channel`,e.channel?.propagation,r[e.channel?.propagation]||{},e.channel?.propagation,!0);for(let e of t.find(e=>e.id===`mobility`)?.items||[])Object.keys(br(r[e.typeId]||{})).length&&n.push(`${e.typeId} 的移动模型属性必须放在节点 protocolAttributes 中`);let o=new Set(e.nodes.map(e=>e.id));for(let r of e.nodes){let e=r.protocolAttributes;if(e!==void 0)if(!e||typeof e!=`object`||Array.isArray(e))n.push(`节点 ${r.id} 的协议覆盖必须是对象`);else for(let[i,a]of Object.entries(e)){if(!a||typeof a!=`object`||Array.isArray(a)){n.push(`节点 ${r.id} 的 ${i} 覆盖必须是属性对象`);continue}Object.values(a).some(e=>![`string`,`number`,`boolean`].includes(typeof e))&&n.push(`节点 ${r.id} 的 ${i} 属性必须是标量`);let e=t.find(e=>e.items.some(e=>e.typeId===i));Object.keys(a).length&&e&&e.id!==`mobility`&&!wr.some(t=>t===e.id)&&n.push(`节点 ${r.id} 的 ${i} 不支持节点协议覆盖；信道与传播模型在统一参数中配置，应用使用节点应用属性`)}r.mobility!==void 0&&(!r.mobility||typeof r.mobility!=`object`||Array.isArray(r.mobility)||typeof r.mobility.type!=`string`?n.push(`节点 ${r.id} 的移动模型必须包含 TypeId 字符串`):(Object.keys(r.mobility).some(e=>e!==`type`)&&n.push(`节点 ${r.id} 的移动模型仅保存 type；属性应放在节点 protocolAttributes 中`),a(`mobility`,r.mobility.type,e?.[r.mobility.type]||{},`节点 ${r.id} 的 ${r.mobility.type}`))),r.app&&(a(`app`,r.app,r.appAttrs||{},`节点 ${r.id} 的 ${r.app}`),Fr(i(`app`,r.app))&&(r.appDestination===void 0?n.push(`请为节点 ${r.id} 的应用选择目的节点`):o.has(r.appDestination)||n.push(`节点 ${r.id} 的应用目的节点不在拓扑中`)))}return[...new Set(n)]},Rr=()=>({}),zr=()=>({macId:``,phyId:``,routingId:``,channelId:``,propagationId:``,simStop:`30s`,txPower:1.1,protocolAttributes:Rr()}),Br=e=>Math.round((Number(e)||0)*100)/100,Vr=(e,t,n=Y)=>t===`none`&&e===`app`?``:Un(e,t,n)?.typeId??t,Hr=(e,t=Y)=>(e||[]).map(e=>({id:Number(e.node_id),name:e.name||`Node-${e.node_id}`,x:Br(e.x),y:Br(e.y),z:Br(e.z),role:e.role||`node`,...e.modelType===void 0?{}:{modelType:e.modelType},...e.mobility===void 0?{}:{mobility:{...e.mobility}},app:Vr(`app`,e.appId||`none`,t),appAttrs:e.appAttrs,appDestination:e.appDestination,...e.protocolAttributes===void 0?{}:{protocolAttributes:e.protocolAttributes}})),Ur=(e,t,n=Y)=>{let r=Hr(t,n),{macId:i,phyId:a,routingId:o}=e;return{schema:`aqua-sim-experiment/v0`,protocolAttributes:e.protocolAttributes||{},simStop:e.simStop,channel:{type:Vr(`channel`,e.channelId,n),propagation:Vr(`channel`,e.propagationId,n)},stack:{phy:{type:Vr(`phy`,a,n),attrs:{txPower:Number(e.txPower)||0}},mac:{type:Vr(`mac`,i,n),attrs:{}},routing:{type:Vr(`routing`,o,n)}},nodes:r,traffic:{preset:`none`}}},Wr=(e,t=Y)=>[...Or(e.nodes||[],2),...Pr(e,t),...Lr(e,t)],Gr=String.raw`
#include <set>
class AquaVisualTxTag : public Tag {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualTxTag")
            .SetParent<Tag>().AddConstructor<AquaVisualTxTag>();
        return tid;
    }
    TypeId GetInstanceTypeId() const override { return GetTypeId(); }
    uint32_t GetSerializedSize() const override { return 8; }
    void Serialize(TagBuffer buffer) const override { buffer.WriteU64(eventId); }
    void Deserialize(TagBuffer buffer) override { eventId = buffer.ReadU64(); }
    void Print(std::ostream& output) const override { output << eventId; }
    uint64_t eventId = 0;
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualTxTag);

struct VisualRx {
    uint32_t dst; int64_t startNs; int64_t durationNs;
    int64_t processingNs = 0; int64_t deliveryNs = -1; int64_t collisionNs = -1; int64_t dropNs = -1;
    bool hasProcessing = false; bool cacheEnded = false;
    std::string status = "pending"; std::string reason;
    std::set<uint64_t> interferers;
};
struct VisualTx { uint32_t src; int64_t startNs; int64_t durationNs; std::vector<VisualRx> receivers; };
static std::vector<VisualTx> visualPackets;
static bool visualReceiveEvents = false;
static std::string VisualJsonString(const std::string& value) {
    const char* hex = "0123456789abcdef";
    std::string encoded(1, '"');
    for (const unsigned char c : value) {
        if (c == '"' || c == '\\') { encoded.push_back('\\'); encoded.push_back(c); }
        else if (c < 32) { encoded += "\\u00"; encoded.push_back(hex[c >> 4]); encoded.push_back(hex[c & 15]); }
        else encoded.push_back(c);
    }
    encoded.push_back('"'); return encoded;
}
static VisualTx* VisualTransmission(Ptr<Packet> packet) {
    AquaVisualTxTag tag;
    if (!packet || !packet->PeekPacketTag(tag) || tag.eventId >= visualPackets.size()) return nullptr;
    return &visualPackets[static_cast<size_t>(tag.eventId)];
}
static VisualRx* VisualReceiver(VisualTx* tx, uint32_t id) {
    if (!tx || tx->src == id) return nullptr;
    for (auto& rx : tx->receivers) if (rx.dst == id) return &rx;
    return nullptr;
}
static void VisualTxTrace(uint32_t id, Ptr<AquaSimPhy> phy, Ptr<Packet> packet, double noise) {
    auto copy = packet->Copy();
    AquaSimPacketStamp stamp; copy->RemoveHeader(stamp);
    auto durationNs = phy->calcTxTime(copy).GetNanoSeconds();
    AquaVisualPhyTimingTag timing;
    if (packet->RemovePacketTag(timing)) {
        timing.airtimeNs = static_cast<uint64_t>(durationNs);
        timing.hasReception = false; timing.receptionEndNs = 0; timing.processingNs = 0;
        packet->AddPacketTag(timing);
    }
    AquaVisualTxTag tag;
    packet->RemovePacketTag(tag);
    tag.eventId = visualPackets.size();
    packet->AddPacketTag(tag);
    visualPackets.push_back({id, Simulator::Now().GetNanoSeconds(), durationNs, {}});
}
static void VisualRxBeginTrace(uint32_t id, Ptr<Packet> packet, Time duration) {
    auto tx = VisualTransmission(packet);
    if (!tx || tx->src == id || VisualReceiver(tx, id)) return;
    tx->receivers.push_back({id, Simulator::Now().GetNanoSeconds(), duration.GetNanoSeconds()});
}
static void VisualRxCollisionTrace(uint32_t id, Ptr<Packet> packet, Ptr<Packet> interferer, std::string reason) {
    auto rx = VisualReceiver(VisualTransmission(packet), id);
    if (!rx) return;
    const auto now = Simulator::Now().GetNanoSeconds();
    if (rx->collisionNs < 0 || now < rx->collisionNs) rx->collisionNs = now;
    if (rx->reason.empty() || reason == "collision_rx_tx") rx->reason = reason;
    rx->status = "fail";
    AquaVisualTxTag other;
    if (interferer && interferer->PeekPacketTag(other) && other.eventId < visualPackets.size())
        rx->interferers.insert(other.eventId);
}
static void VisualRxDropTrace(uint32_t id, Ptr<Packet> packet, std::string reason) {
    auto rx = VisualReceiver(VisualTransmission(packet), id);
    if (!rx) return;
    rx->status = "fail";
    if (rx->reason.empty()) rx->reason = reason;
    rx->dropNs = Simulator::Now().GetNanoSeconds();
}
static void VisualRxEndTrace(uint32_t id, Ptr<Packet> packet) {
    auto rx = VisualReceiver(VisualTransmission(packet), id);
    if (rx) rx->cacheEnded = true;
}
static void VisualRxTrace(uint32_t id, Ptr<Packet> packet, double noise) {
    auto tx = VisualTransmission(packet);
    if (!tx || tx->src == id) return;
    AquaVisualPhyTimingTag timing;
    const bool annotated = packet->PeekPacketTag(timing) && timing.hasReception;
    const auto completionNs = annotated ? static_cast<int64_t>(timing.receptionEndNs) : Simulator::Now().GetNanoSeconds();
    auto rx = VisualReceiver(tx, id);
    if (!rx) {
        tx->receivers.push_back({id, std::max(tx->startNs, completionNs - tx->durationNs), tx->durationNs});
        rx = &tx->receivers.back();
    }
    rx->status = "ok"; rx->reason.clear();
    rx->hasProcessing = annotated;
    if (annotated) rx->processingNs = static_cast<int64_t>(timing.processingNs);
}
static void VisualRxDeliveryTrace(uint32_t id, Ptr<Packet> packet, double noise) {
    auto rx = VisualReceiver(VisualTransmission(packet), id);
    if (rx) rx->deliveryNs = Simulator::Now().GetNanoSeconds();
}
// Verify the declared callback contract before binding an optional public trace.
static bool VisualConnectTrace(Ptr<Object> source, const std::string& name, const std::string& contract, const CallbackBase& callback) {
    if (!source) return false;
    for (auto tid = source->GetInstanceTypeId(); ; tid = tid.GetParent()) {
        for (std::size_t i = 0; i < tid.GetTraceSourceN(); ++i) {
            const auto info = tid.GetTraceSource(i);
            if (info.name == name) return info.callback == contract && source->TraceConnectWithoutContext(name, callback);
        }
        if (tid.GetParent() == tid) break;
    }
    return false;
}
static void VisualConnectReceptionEvents(uint32_t id, Ptr<AquaSimPhy> phy) {
    Ptr<Object> source = phy;
    const auto begin = MakeBoundCallback(&VisualRxBeginTrace, id);
    if (!VisualConnectTrace(source, "RxBegin", "ns3::AquaVisualRxBeginCallback", begin)) {
        source = phy->GetSignalCache();
        if (!VisualConnectTrace(source, "RxBegin", "ns3::AquaVisualRxBeginCallback", begin)) return;
    }
    visualReceiveEvents = true;
    VisualConnectTrace(source, "RxCollision", "ns3::AquaVisualRxCollisionCallback", MakeBoundCallback(&VisualRxCollisionTrace, id));
    VisualConnectTrace(source, "RxDrop", "ns3::AquaVisualRxDropCallback", MakeBoundCallback(&VisualRxDropTrace, id));
    VisualConnectTrace(source, "RxEnd", "ns3::AquaVisualRxEndCallback", MakeBoundCallback(&VisualRxEndTrace, id));
}
static void WriteVisualPackets(std::ostream& output) {
    const auto previousPrecision = output.precision(17);
    output << ",\"packets\":[";
    for (size_t i = 0; i < visualPackets.size(); ++i) {
        if (i) output << ',';
        const auto& tx = visualPackets[i];
        output << "{\"packet_id\":\"phy-" << i << "\",\"src\":" << tx.src
               << ",\"tx_start_us\":" << tx.startNs / 1000.0 << ",\"tx_duration_us\":" << tx.durationNs / 1000.0 << ",\"receivers\":[";
        for (size_t j = 0; j < tx.receivers.size(); ++j) {
            if (j) output << ',';
            const auto& rx = tx.receivers[j];
            const bool pending = rx.status == "pending";
            const std::string status = pending ? "fail" : rx.status;
            const std::string reason = pending ? (rx.cacheEnded ? "outcome_unreported" : "reception_incomplete") : rx.reason;
            output << "{\"dst\":" << rx.dst << ",\"rx_start_us\":" << rx.startNs / 1000.0
                   << ",\"rx_duration_us\":" << rx.durationNs / 1000.0 << ",\"status\":\"" << status << '"';
            if (status != "ok") output << ",\"reason\":" << VisualJsonString(reason);
            if (rx.collisionNs >= 0) output << ",\"collision_start_us\":" << rx.collisionNs / 1000.0;
            if (rx.dropNs >= 0) output << ",\"rx_drop_us\":" << rx.dropNs / 1000.0;
            if (!rx.interferers.empty()) {
                output << ",\"with\":["; bool first = true;
                for (const auto event : rx.interferers) { if (!first) output << ','; first = false; output << "\"phy-" << event << '"'; }
                output << ']';
            }
            if (rx.hasProcessing) output << ",\"rx_processing_duration_us\":" << rx.processingNs / 1000.0;
            if (rx.hasProcessing && rx.deliveryNs >= 0) output << ",\"rx_delivery_us\":" << rx.deliveryNs / 1000.0;
            output << '}';
        }
        output << "]}";
    }
    output << "]}";
    output.precision(previousPrecision);
}
`,Kr=String.raw`
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/traced-callback.h"
#include <map>
#include <string>
#include <vector>

namespace ns3 {
template <typename Cache>
class AquaVisualObservedCache : public Cache {
public:
    template <typename Concrete>
    static TypeId Register(const char* name) {
        return TypeId(name).template SetParent<Cache>().template AddConstructor<Concrete>()
            .AddTraceSource("RxBegin", "Packet admitted to the native signal cache; actual arrival and receiver airtime.",
                MakeTraceSourceAccessor(&AquaVisualObservedCache::m_rxBegin), "ns3::AquaVisualRxBeginCallback")
            .AddTraceSource("RxCollision", "Native PHY/cache changed this packet to collision; includes an observed interferer when available.",
                MakeTraceSourceAccessor(&AquaVisualObservedCache::m_rxCollision), "ns3::AquaVisualRxCollisionCallback")
            .AddTraceSource("RxDrop", "Packet discarded by the native signal-cache status check.",
                MakeTraceSourceAccessor(&AquaVisualObservedCache::m_rxDrop), "ns3::AquaVisualRxDropCallback")
            .AddTraceSource("RxEnd", "Native signal-cache processing returned; success is reported separately by the PHY.",
                MakeTraceSourceAccessor(&AquaVisualObservedCache::m_rxEnd), "ns3::AquaVisualRxEndCallback");
    }
    void SubmitPkt(Ptr<IncomingPacket> incoming) override {
        auto packet = incoming->packet;
        const auto status = incoming->status;
        const auto found = m_reasons.find(PeekPointer(incoming));
        const std::string reason = found == m_reasons.end() ? "phy_rejected" : found->second;
        if (status != AquaSimPacketStamp::RECEPTION) m_rxDrop(packet, reason);
        Cache::SubmitPkt(incoming);
        m_rxEnd(packet);
        m_reasons.erase(PeekPointer(incoming));
    }
protected:
    void UpdatePacketStatus(Ptr<IncomingPacket> incoming) override {
        struct Before { Ptr<IncomingPacket> packet; AquaSimPacketStamp::PacketStatus status; };
        std::vector<Before> previous;
        for (const auto& band : this->heads) {
            for (auto p = band.second->next; p; p = p->next) {
                if (p != incoming) previous.push_back({p, p->status});
            }
        }
        const bool initiallyCollided = incoming->status == AquaSimPacketStamp::COLLISION;
        std::string initialReason;
        if (initiallyCollided) {
            const auto status = this->m_phy->GetDevice()->GetTransmissionStatus();
            initialReason = status == SEND ? "collision_rx_tx" : status == RECV ? "collision_rx_rx" : "collision";
        }
        m_rxBegin(incoming->packet, this->m_phy->calcTxTime(incoming->packet));
        // Delegate exactly once. No reception status, interference or timing is rewritten here.
        Cache::UpdatePacketStatus(incoming);
        bool paired = false;
        for (const auto& before : previous) {
            if (before.status != AquaSimPacketStamp::COLLISION && before.packet->status == AquaSimPacketStamp::COLLISION) {
                Collision(before.packet, incoming->packet, "collision_rx_rx");
                if (incoming->status == AquaSimPacketStamp::COLLISION) {
                    Collision(incoming, before.packet->packet, initialReason.empty() ? "collision_rx_rx" : initialReason);
                    paired = true;
                }
            }
        }
        if (incoming->status == AquaSimPacketStamp::COLLISION && !paired)
            Collision(incoming, nullptr, initialReason.empty() ? "collision_rx_rx" : initialReason);
    }
    void DoDispose() override {
        m_reasons.clear();
        Cache::DoDispose();
    }
private:
    void Collision(Ptr<IncomingPacket> incoming, Ptr<Packet> interferer, const std::string& reason) {
        auto& known = m_reasons[PeekPointer(incoming)];
        if (known.empty() || reason == "collision_rx_tx") known = reason;
        m_rxCollision(incoming->packet, interferer, known);
    }
    std::map<const IncomingPacket*, std::string> m_reasons;
    ns3::TracedCallback<Ptr<Packet>, Time> m_rxBegin;
    ns3::TracedCallback<Ptr<Packet>, Ptr<Packet>, std::string> m_rxCollision;
    ns3::TracedCallback<Ptr<Packet>, std::string> m_rxDrop;
    ns3::TracedCallback<Ptr<Packet>> m_rxEnd;
};
class AquaVisualSignalCacheRange : public AquaVisualObservedCache<AquaSimSignalCacheRange> {
public:
    static TypeId GetTypeId() {
        static TypeId tid = Register<AquaVisualSignalCacheRange>("ns3::AquaVisualSignalCacheRange");
        return tid;
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualSignalCacheRange);
class AquaVisualSignalCacheSINR : public AquaVisualObservedCache<AquaSimSignalCacheSINR> {
public:
    static TypeId GetTypeId() {
        static TypeId tid = Register<AquaVisualSignalCacheSINR>("ns3::AquaVisualSignalCacheSINR");
        return tid;
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualSignalCacheSINR);
} // namespace ns3
`,qr=String.raw`
#include "ns3/tag.h"
namespace ns3 {
// Tags are simulator metadata, never transmitted bytes. A receiver may annotate
// successful on-air completion separately from later delivery to the MAC.
class AquaVisualPhyTimingTag : public Tag {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualPhyTimingTag")
            .SetParent<Tag>().AddConstructor<AquaVisualPhyTimingTag>();
        return tid;
    }
    TypeId GetInstanceTypeId() const override { return GetTypeId(); }
    uint32_t GetSerializedSize() const override { return 25; }
    void Serialize(TagBuffer buffer) const override {
        buffer.WriteU64(airtimeNs); buffer.WriteU64(receptionEndNs);
        buffer.WriteU64(processingNs); buffer.WriteU8(hasReception ? 1 : 0);
    }
    void Deserialize(TagBuffer buffer) override {
        airtimeNs = buffer.ReadU64(); receptionEndNs = buffer.ReadU64();
        processingNs = buffer.ReadU64(); hasReception = buffer.ReadU8() != 0;
    }
    void Print(std::ostream& out) const override {
        out << "airtime=" << airtimeNs << "ns rxEnd=" << receptionEndNs
            << "ns processing=" << processingNs << "ns";
    }
    uint64_t airtimeNs = 0;
    uint64_t receptionEndNs = 0;
    uint64_t processingNs = 0;
    bool hasReception = false;
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualPhyTimingTag);
} // namespace ns3
`+String.raw`
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/data-rate.h"
#include "ns3/nstime.h"
#include "ns3/simulator.h"
#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <vector>

namespace ns3 {
class AquaSimPhySimple : public AquaSimPhyCmn {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaSimPhySimple")
            .SetParent<AquaSimPhyCmn>().AddConstructor<AquaSimPhySimple>()
            .AddAttribute("DataRate",
                "On-air bit rate (bit/s). Airtime is 8 * transmitted bytes / DataRate, without OFDM framing overhead.",
                DataRateValue(DataRate("10kbps")),
                MakeDataRateAccessor(&AquaSimPhySimple::SetDataRate, &AquaSimPhySimple::GetDataRate),
                MakeDataRateChecker())
            .AddAttribute("RxProcessingDelay",
                "Per-packet delay after successful on-air reception and inherited error checks, before delivery to MAC. Does not occupy the acoustic medium.",
                TimeValue(Seconds(0)),
                MakeTimeAccessor(&AquaSimPhySimple::m_rxProcessingDelay),
                MakeTimeChecker(Seconds(0)))
            .AddTraceSource("RxComplete",
                "Successful on-air reception before receiver processing and MAC delivery.",
                MakeTraceSourceAccessor(&AquaSimPhySimple::m_rxComplete),
                "ns3::AquaSimPhy::TracedCallback");
        return tid;
    }
    void SetDataRate(DataRate rate) {
        if (rate.GetBitRate() == 0)
            throw std::invalid_argument("AquaSimPhySimple.DataRate must be greater than zero");
        m_dataRate = rate;
    }
    DataRate GetDataRate() const { return m_dataRate; }
    Time calcTxTime(uint32_t bytes) override {
        return std::max(NanoSeconds(1), m_dataRate.CalculateBytesTxTime(bytes));
    }
    Time calcTxTime(uint32_t bytes, int) override { return calcTxTime(bytes); }
    Time calcTxTime(Ptr<Packet> packet) override {
        // The base receive path calls this for RX status, energy and cache timing.
        // Use the transmitter's actual airtime, even with different node rates.
        AquaVisualPhyTimingTag timing;
        if (m_receiving && packet->PeekPacketTag(timing) && timing.airtimeNs > 0)
            return NanoSeconds(timing.airtimeNs);
        AquaSimTrailer trailer;
        const uint32_t metadataBytes = trailer.GetSerializedSize();
        if (packet->GetSize() < metadataBytes)
            throw std::invalid_argument("AquaSimPhySimple packet is missing its AquaSim trailer");
        // MAC, routing and transport headers are on-air; simulator trailer is not.
        return calcTxTime(packet->GetSize() - metadataBytes);
    }
    double CalcPktSize(double seconds, int) override {
        if (!std::isfinite(seconds) || seconds < 0)
            throw std::invalid_argument("AquaSimPhySimple duration must be finite and nonnegative");
        return seconds * static_cast<double>(m_dataRate.GetBitRate()) / 8.0;
    }
    Ptr<Packet> StampTxInfo(Ptr<Packet> packet) override {
        AquaVisualPhyTimingTag timing;
        packet->RemovePacketTag(timing);
        timing = AquaVisualPhyTimingTag();
        timing.airtimeNs = static_cast<uint64_t>(calcTxTime(packet).GetNanoSeconds());
        packet->AddPacketTag(timing);
        // Preserve inherited underwater power, frequency, bandwidth and range.
        return AquaSimPhyCmn::StampTxInfo(packet);
    }
    bool recvProcess(Ptr<Packet> packet) override {
        // Scoped because base validation and signal-cache admission are synchronous.
        struct ReceiveScope {
            bool& flag;
            const bool previous;
            explicit ReceiveScope(bool& value) : flag(value), previous(value) { flag = true; }
            ~ReceiveScope() { flag = previous; }
        } receiving(m_receiving);
        return AquaSimPhyCmn::recvProcess(packet);
    }
    void SendPktUp(Ptr<Packet> packet) override {
        // Called by the inherited signal-cache/BER path only after a successful RX.
        AquaVisualPhyTimingTag timing;
        packet->RemovePacketTag(timing);
        timing.hasReception = true;
        timing.receptionEndNs = static_cast<uint64_t>(Simulator::Now().GetNanoSeconds());
        timing.processingNs = static_cast<uint64_t>(m_rxProcessingDelay.GetNanoSeconds());
        packet->AddPacketTag(timing);
        m_rxComplete(packet, GetSignalCache()->GetNoise());
        if (m_rxProcessingDelay.IsZero()) {
            DeliverToMac(packet);
            return;
        }
        m_deliveries.erase(std::remove_if(m_deliveries.begin(), m_deliveries.end(),
            [](const EventId& event) { return !event.IsPending(); }), m_deliveries.end());
        m_deliveries.push_back(Simulator::Schedule(m_rxProcessingDelay,
            &AquaSimPhySimple::DeliverToMac, this, packet));
    }
protected:
    void DoDispose() override {
        for (const auto& event : m_deliveries) Simulator::Cancel(event);
        m_deliveries.clear();
        AquaSimPhyCmn::DoDispose();
    }
private:
    void DeliverToMac(Ptr<Packet> packet) { AquaSimPhyCmn::SendPktUp(packet); }
    DataRate m_dataRate{10000};
    Time m_rxProcessingDelay{Seconds(0)};
    bool m_receiving = false;
    std::vector<EventId> m_deliveries;
    ns3::TracedCallback<Ptr<Packet>, double> m_rxComplete;
};
NS_OBJECT_ENSURE_REGISTERED(AquaSimPhySimple);
} // namespace ns3
`,Jr=String.raw`
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/abort.h"
#include "ns3/data-rate.h"
#include "ns3/mobility-model.h"
#include "ns3/simulator.h"
#include "ns3/tag.h"
#include <algorithm>
#include <cmath>
#include <memory>
#include <stdexcept>
#include <vector>

namespace ns3 {

// Packet tags do not count as transmitted bytes. Keep the sender's precise
// airtime even if the receiving node has a different configured data rate.
class AquaSimRadioDurationTag : public Tag {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaSimRadioDurationTag")
            .SetParent<Tag>().AddConstructor<AquaSimRadioDurationTag>();
        return tid;
    }
    TypeId GetInstanceTypeId() const override { return GetTypeId(); }
    uint32_t GetSerializedSize() const override { return 8; }
    void Serialize(TagBuffer buffer) const override { buffer.WriteU64(nanoseconds); }
    void Deserialize(TagBuffer buffer) override { nanoseconds = buffer.ReadU64(); }
    void Print(std::ostream& out) const override { out << nanoseconds << "ns"; }
    uint64_t nanoseconds = 0;
};
NS_OBJECT_ENSURE_REGISTERED(AquaSimRadioDurationTag);

class AquaSimRadioPhy : public AquaSimPhy {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaSimRadioPhy")
            .SetParent<AquaSimPhy>().AddConstructor<AquaSimRadioPhy>()
            .AddAttribute("DataRate", "Ideal radio bit rate; no acoustic OFDM or preamble overhead.",
                DataRateValue(DataRate("1Mbps")),
                MakeDataRateAccessor(&AquaSimRadioPhy::SetDataRate, &AquaSimRadioPhy::GetDataRate),
                MakeDataRateChecker())
            .AddTraceSource("RxBegin", "Actual ideal-radio reception attempt.",
                MakeTraceSourceAccessor(&AquaSimRadioPhy::m_rxBegin), "ns3::AquaVisualRxBeginCallback")
            .AddTraceSource("RxCollision", "Collision observed by the ideal-radio medium.",
                MakeTraceSourceAccessor(&AquaSimRadioPhy::m_rxCollision), "ns3::AquaVisualRxCollisionCallback")
            .AddTraceSource("RxDrop", "Actual failed radio reception.",
                MakeTraceSourceAccessor(&AquaSimRadioPhy::m_rxDrop), "ns3::AquaVisualRxDropCallback")
            .AddTraceSource("RxEnd", "Radio reception has ended.",
                MakeTraceSourceAccessor(&AquaSimRadioPhy::m_rxEnd), "ns3::AquaVisualRxEndCallback");
        return tid;
    }
    void SetDataRate(DataRate rate) {
        NS_ABORT_MSG_IF(rate.GetBitRate() == 0, "Radio DataRate must be greater than zero");
        m_rate = rate;
    }
    DataRate GetDataRate() const { return m_rate; }
    void addModulation(Ptr<AquaSimModulation>, int) override {
        throw std::invalid_argument("Ideal radio PHY uses DataRate and does not support acoustic modulation objects");
    }
    Time calcTxTime(uint32_t bytes) override {
        return std::max(NanoSeconds(1), m_rate.CalculateBytesTxTime(bytes));
    }
    Time calcTxTime(uint32_t bytes, int) override { return calcTxTime(bytes); }
    Time calcTxTime(Ptr<Packet> packet) override {
        AquaSimTrailer trailer;
        const uint32_t metadataBytes = trailer.GetSerializedSize();
        NS_ABORT_MSG_IF(packet->GetSize() < metadataBytes, "Radio packet is missing its AquaSim trailer");
        // Transport/routing/MAC headers are on-air bytes. The simulator-only
        // trailer and PacketStamp are not; this call precedes StampTxInfo.
        return calcTxTime(packet->GetSize() - metadataBytes);
    }
    double CalcPktSize(double seconds, int) override {
        return std::max(0.0, seconds) * static_cast<double>(m_rate.GetBitRate()) / 8.0;
    }
    int64_t AssignStreams(int64_t) override { return 0; }
    std::vector<double> getBandWidth() override { return {1}; }
    std::vector<double> getFreq() override { return {1}; }

    Ptr<Packet> StampTxInfo(Ptr<Packet> packet) override {
        AquaSimRadioDurationTag tag;
        packet->RemovePacketTag(tag);
        tag.nanoseconds = static_cast<uint64_t>(calcTxTime(packet).GetNanoSeconds());
        packet->AddPacketTag(tag);
        // Compatibility envelope only. These safe nonnegative placeholders are
        // not RF frequency/power; neither radio propagation nor RX uses them.
        AquaSimPacketStamp stamp;
        stamp.SetPt(1); stamp.SetPr(1); stamp.SetTxRange(GetTransRange());
        stamp.SetFreq(1); stamp.SetBandWidth(1);
        stamp.SetBandId(0); stamp.SetBandNum(1);
        packet->AddHeader(stamp);
        return packet;
    }
    bool txProcess(Ptr<Packet> packet) override {
        const auto status = GetDevice()->GetTransmissionStatus();
        if ((status == RECV && !HasActiveReceptions()) || (status == SEND && Simulator::Now() >= m_txEnd)) setStatus(NIDLE, 0);
        if (GetDevice()->GetTransmissionStatus() != NIDLE || HasActiveReceptions()) return false;
        m_txEnd = Simulator::Now() + calcTxTime(packet);
        GetDevice()->SetTransmissionStatus(SEND);
        // Preserve the base Tx trace used by the web replay adapter.
        const bool sent = AquaSimPhy::PktTransmit(packet);
        if (!sent) { m_txEnd = Simulator::Now(); setStatus(NIDLE, 0); }
        return sent;
    }
    bool recvProcess(Ptr<Packet> packet) override {
        AquaSimRadioDurationTag tag;
        if (!packet->PeekPacketTag(tag) || tag.nanoseconds == 0 || GetDevice()->FailureStatus()
            || GetDevice()->GetTransmissionStatus() == SLEEP) return false;
        AquaSimPacketStamp stamp;
        packet->RemoveHeader(stamp);
        auto reception = std::make_shared<Reception>();
        reception->packet = packet;
        reception->end = Simulator::Now() + NanoSeconds(tag.nanoseconds);
        m_rxBegin(packet, NanoSeconds(tag.nanoseconds));
        reception->collided = Simulator::Now() < m_txEnd;
        if (reception->collided) {
            reception->reason = "collision_rx_tx";
            m_rxCollision(packet, nullptr, reception->reason);
        }
        for (const auto& other : m_receiving) {
            if (other->end > Simulator::Now()) {
                other->collided = true; reception->collided = true;
                if (other->reason.empty()) other->reason = "collision_rx_rx";
                if (reception->reason.empty()) reception->reason = "collision_rx_rx";
                m_rxCollision(other->packet, packet, other->reason);
                m_rxCollision(packet, other->packet, reception->reason);
            }
        }
        m_receiving.push_back(reception);
        setStatus(NIDLE, 0);
        reception->event = Simulator::Schedule(NanoSeconds(tag.nanoseconds),
            &AquaSimRadioPhy::FinishReceive, this, reception);
        return true;
    }
    void setStatus(TransStatus requested, uint8_t) override {
        if (requested == NIDLE) {
            requested = Simulator::Now() < m_txEnd ? SEND : HasActiveReceptions() ? RECV : NIDLE;
        }
        GetDevice()->SetTransmissionStatus(requested);
    }

protected:
    // Airtime comes directly from DataRate; no acoustic modulation table is needed.
    void initmodulations() override {}
    bool matchPkt(Ptr<Packet> packet) override {
        AquaSimRadioDurationTag tag;
        return packet->PeekPacketTag(tag);
    }
    // This ideal model has no electrical consumption model. Do not silently use
    // the inherited underwater modem power, noise cache or BER assumptions.
    void UpdateTxEnergy(Time, double) override {}
    void UpdateRxEnergy(Time) override {}
    void UpdateIdleEnergy() override {}
    void DoDispose() override {
        for (const auto& reception : m_receiving) Simulator::Cancel(reception->event);
        m_receiving.clear();
        AquaSimPhy::DoDispose();
    }

private:
    struct Reception { Ptr<Packet> packet; EventId event; Time end; bool collided = false; std::string reason; };
    bool HasActiveReceptions() const {
        return std::any_of(m_receiving.begin(), m_receiving.end(), [](const auto& reception) {
            return reception->end > Simulator::Now();
        });
    }
    void FinishReceive(std::shared_ptr<Reception> reception) {
        m_receiving.erase(std::remove(m_receiving.begin(), m_receiving.end(), reception), m_receiving.end());
        const bool sleeping = GetDevice()->GetTransmissionStatus() == SLEEP;
        if (!sleeping) setStatus(NIDLE, 0);
        if (!reception->collided && !sleeping && !GetDevice()->FailureStatus()) {
            // Preserve the base Rx trace and normal MAC/application delivery.
            SendPktUp(reception->packet);
        } else {
            m_rxDrop(reception->packet, reception->reason.empty() ? std::string("receiver_unavailable") : reception->reason);
        }
        m_rxEnd(reception->packet);
    }
    ns3::TracedCallback<Ptr<Packet>, Time> m_rxBegin;
    ns3::TracedCallback<Ptr<Packet>, Ptr<Packet>, std::string> m_rxCollision;
    ns3::TracedCallback<Ptr<Packet>, std::string> m_rxDrop;
    ns3::TracedCallback<Ptr<Packet>> m_rxEnd;
    DataRate m_rate{1000000};
    Time m_txEnd{Seconds(0)};
    std::vector<std::shared_ptr<Reception>> m_receiving;
};
NS_OBJECT_ENSURE_REGISTERED(AquaSimRadioPhy);

class AquaSimRadioPropagation : public AquaSimPropagation {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaSimRadioPropagation")
            .SetParent<AquaSimPropagation>().AddConstructor<AquaSimRadioPropagation>();
        return tid;
    }
    Time PDelay(Ptr<MobilityModel> sender, Ptr<MobilityModel> receiver) override {
        return Seconds(sender->GetDistanceFrom(receiver) / 299792458.0);
    }
    std::vector<PktRecvUnit>* ReceivedCopies(Ptr<AquaSimNetDevice> sender, Ptr<Packet>,
        std::vector<Ptr<AquaSimNetDevice>> devices) override {
        auto copies = new std::vector<PktRecvUnit>;
        const double range = sender->GetPhy()->GetTransRange();
        NS_ABORT_MSG_IF(!std::isfinite(range) || range < 0, "Radio transRange must be finite and nonnegative");
        auto from = sender->GetNode()->GetObject<MobilityModel>();
        for (const auto& receiver : devices) {
            if (receiver == sender || !receiver->GetPhy()) continue;
            auto to = receiver->GetNode()->GetObject<MobilityModel>();
            if (from->GetDistanceFrom(to) > range) continue;
            PktRecvUnit copy;
            copy.recver = receiver;
            copy.pR = 1; // No attenuation/sensitivity model in this ideal link.
            copy.pDelay = PDelay(from, to);
            copies->push_back(copy);
        }
        return copies;
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaSimRadioPropagation);

class AquaSimRadioChannel : public AquaSimChannel {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaSimRadioChannel")
            .SetParent<AquaSimChannel>().AddConstructor<AquaSimRadioChannel>();
        return tid;
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaSimRadioChannel);

} // namespace ns3
`,Yr=String.raw`
// Private header retains the upstream byte layout, with signed millimeter coordinates
// and initialized fields. It does not change the installed legacy VBHeader globally.
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/header.h"
#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>
namespace ns3 {
class AquaVisualVbfHeader : public VBHeader {
public:
    AquaVisualVbfHeader() {
        SetMessType(0); SetPkNum(0); SetTargetAddr(AquaSimAddress(0));
        SetSenderAddr(AquaSimAddress(0)); SetForwardAddr(AquaSimAddress(0));
        SetDataType(0); SetNumForwards(0); SetOriginalSource(Vector());
        SetToken(0); SetTs(0); SetRange(0);
        SetExtraInfo_o(Vector()); SetExtraInfo_f(Vector());
        SetExtraInfo_t(Vector()); SetExtraInfo_d(Vector());
    }
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualVbfHeader")
            .SetParent<VBHeader>().AddConstructor<AquaVisualVbfHeader>();
        return tid;
    }
    TypeId GetInstanceTypeId() const override { return GetTypeId(); }
    void Serialize(Buffer::Iterator i) const override {
        // Legacy getters are non-const; serialize a value copy.
        auto h = *this;
        i.WriteU8(h.GetMessType()); i.WriteU32(h.GetPkNum());
        i.WriteU16(h.GetTargetAddr().GetAsInt()); i.WriteU16(h.GetSenderAddr().GetAsInt());
        i.WriteU16(h.GetForwardAddr().GetAsInt()); i.WriteU8(h.GetDataType());
        i.WriteU16(h.GetNumForwards()); WriteVector(i, h.GetOriginalSource());
        i.WriteU32(h.GetToken()); i.WriteU32(h.GetTs()); i.WriteU32(h.GetRange());
        auto extra = h.GetExtraInfo();
        WriteVector(i, extra.o); WriteVector(i, extra.f);
        WriteVector(i, extra.t); WriteVector(i, extra.d);
    }
    uint32_t Deserialize(Buffer::Iterator i) override {
        SetMessType(i.ReadU8()); SetPkNum(i.ReadU32());
        SetTargetAddr(AquaSimAddress(i.ReadU16())); SetSenderAddr(AquaSimAddress(i.ReadU16()));
        SetForwardAddr(AquaSimAddress(i.ReadU16())); SetDataType(i.ReadU8());
        SetNumForwards(i.ReadU16()); SetOriginalSource(ReadVector(i));
        SetToken(i.ReadU32()); SetTs(i.ReadU32()); SetRange(i.ReadU32());
        SetExtraInfo_o(ReadVector(i)); SetExtraInfo_f(ReadVector(i));
        SetExtraInfo_t(ReadVector(i)); SetExtraInfo_d(ReadVector(i));
        return GetSerializedSize();
    }
private:
    static void WriteVector(Buffer::Iterator& i, const Vector& v) {
        for (const auto value : {v.x, v.y, v.z}) {
            const double mm = std::round(value * 1000.0);
            if (!std::isfinite(mm) || mm < std::numeric_limits<int32_t>::min()
                || mm > std::numeric_limits<int32_t>::max())
                throw std::runtime_error("VBF coordinate exceeds signed millimeter header range");
            i.WriteU32(static_cast<uint32_t>(static_cast<int32_t>(mm)));
        }
    }
    static Vector ReadVector(Buffer::Iterator& i) {
        const auto read = [&i]() {
            const uint32_t raw = i.ReadU32();
            const int64_t mm = raw <= INT32_MAX ? int64_t(raw) : int64_t(raw) - (int64_t(1) << 32);
            return static_cast<double>(mm) / 1000.0;
        };
        const double x = read(), y = read(), z = read();
        return Vector(x, y, z);
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualVbfHeader);
} // namespace ns3

/* -*- Mode:C++; c-file-style:"gnu"; indent-tabs-mode:nil; -*- */
/*
 * Copyright (c) 2016 University of Connecticut
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 as
 * published by the Free Software Foundation;
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 *
 * Author: Robert Martin <robert.martin@engr.uconn.edu>
 */

#ifndef AQUA_SIM_ROUTING_VBF_H
#define AQUA_SIM_ROUTING_VBF_H

#include "ns3/aqua-sim-address.h"
#include "ns3/aqua-sim-channel.h"
#include "ns3/aqua-sim-datastructure.h"
#include "ns3/aqua-sim-routing.h"

#include "ns3/packet.h"
#include "ns3/random-variable-stream.h"
#include "ns3/vector.h"

#include <map>

namespace ns3
{


struct vbf_neighborhood
{
    int number;
    Vector neighbor[MAX_NEIGHBOR];
};

typedef std::pair<AquaSimAddress, unsigned int> hash_entry;

/**
 * \ingroup aqua-sim-ng
 *
 * \brief Packet Hash table for VBF to assist in specialized tables.
 */
class AquaSimPktHashTable
{
  public:
    std::map<hash_entry, vbf_neighborhood*> m_htable;
    // std::map<hash_t, hash_entry> m_htable;

    AquaSimPktHashTable();
    ~AquaSimPktHashTable();

    int m_windowSize{WINDOW_SIZE};
    void Reset();
    void PutInHash(AquaSimAddress sAddr, unsigned int pkNum);
    void PutInHash(AquaSimAddress sAddr, unsigned int pkNum, Vector p);
    vbf_neighborhood* GetHash(AquaSimAddress senderAddr, unsigned int pkt_num);
    // private:
    // int lower_counter;
}; // class AquaSimPktHashTable

/**
 * \brief Packet Hash table for VBF to assist in specialized tables.
 */
class AquaSimDataHashTable
{
  public:
    std::map<int*, int*> m_htable;
    // Tcl_HashTable htable;

    AquaSimDataHashTable();
    ~AquaSimDataHashTable();

    void Reset();
    void PutInHash(int* attr);
    int* GetHash(int* attr);
}; // class AquaSimDataHashTable

/**
 * \brief Vector Based Forwarding
 * http://engr.uconn.edu/~jcui/UWSN_papers/vbf_networking2006.pdf
 */
class AquaSimVBF : public AquaSimRouting
{
  public:
    AquaSimVBF();
    static TypeId GetTypeId();
    int64_t AssignStreams(int64_t stream) override;
    bool TxProcess(Ptr<Packet> packet, const Address& dest, uint16_t protocolNumber) override;
    bool Recv(Ptr<Packet> packet, const Address& dest, uint16_t protocolNumber) override;

    void SetTargetPos(Vector pos);
    // AquaSimVBF_Entry routing_table[MAX_DATA_TYPE];

  protected:
    int m_pkCount;
    int m_counter;
    int m_hopByHop;
    int m_enableRouting; // if true, VBF can perform routing functionality. Otherwise, not perform
    // int m_useOverhear;
    double m_priority;
    bool m_measureStatus;
    // int m_portNumber;
    AquaSimPktHashTable PktTable;
    AquaSimPktHashTable SourceTable;
    AquaSimPktHashTable Target_discoveryTable;
    AquaSimPktHashTable SinkTable;

    double m_width;
    // the width is used to test if the node is close enough to the path specified by the packet
    Vector m_targetPos;
    Ptr<UniformRandomVariable> m_rand;

    void Terminate();
    void Reset();
    void ConsiderNew(Ptr<Packet> pkt);
    void SetDelayTimer(Ptr<Packet>, double);
    void Timeout(Ptr<Packet>);
    double Advance(Ptr<Packet>);
    double Distance(Ptr<Packet>);
    double Projection(Ptr<Packet>);
    double CalculateDelay(Ptr<Packet>, Vector*);
    // double RecoveryDelay(Ptr<Packet>, Vector*);
    void CalculatePosition(Ptr<Packet>);
    void SetMeasureTimer(Ptr<Packet>, double);
    bool IsTarget(Ptr<Packet>);
    bool IsCloseEnough(Ptr<Packet>);

    Ptr<Packet> CreatePacket();
    Ptr<Packet> PrepareMessage(unsigned int dtype, AquaSimAddress to_addr, int msg_type);

    void DataForSink(Ptr<Packet> pkt);
    void StopSource();
    void MACprepare(Ptr<Packet> pkt);
    void MACsend(Ptr<Packet> pkt, double delay = 0);

    void DoDispose() override;
}; // class AquaSimVBF

} // namespace ns3

#endif /* AQUA_SIM_ROUTING_VBF_H */

/* -*- Mode:C++; c-file-style:"gnu"; indent-tabs-mode:nil; -*- */
/*
 * Copyright (c) 2016 University of Connecticut
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 as
 * published by the Free Software Foundation;
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 *
 * Author: Robert Martin <robert.martin@engr.uconn.edu>
 */


#include "ns3/aqua-sim-header-routing.h"
#include "ns3/aqua-sim-header.h"
#include "ns3/aqua-sim-propagation.h"
#include "ns3/aqua-sim-pt-tag.h"
#include "ns3/aqua-sim-trailer.h"

#include "ns3/double.h"
#include "ns3/integer.h"
#include "ns3/log.h"
#include "ns3/mobility-model.h"
#include "ns3/simulator.h"

#include <iostream>
namespace ns3 {

NS_LOG_COMPONENT_DEFINE("AquaSimVBF");

AquaSimPktHashTable::AquaSimPktHashTable()
{
    NS_LOG_FUNCTION(this);
    //  lower_counter=0;
    // 50 items in the hash table, however, because it begins by 0, so, minus 1
    // Tcl_InitHashTable(&m_htable, 3);
}

AquaSimPktHashTable::~AquaSimPktHashTable()
{
    NS_LOG_FUNCTION(this);
    for (std::map<hash_entry, vbf_neighborhood*>::iterator it = m_htable.begin();
         it != m_htable.end();
         ++it)
    {
        delete it->second;
    }
    m_htable.clear();
}

void
AquaSimPktHashTable::Reset()
{
    for (const auto& entry : m_htable) delete entry.second;
    m_htable.clear();
    /*
      vbf_neighborhood *hashPtr;
      Tcl_HashEntry *entryPtr;
      Tcl_HashSearch searchPtr;

      entryPtr = Tcl_FirstHashEntry(&m_htable, &searchPtr);
      while (entryPtr != NULL) {
          hashPtr = (vbf_neighborhood *)Tcl_GetHashValue(entryPtr);
          delete hashPtr;
          Tcl_DeleteHashEntry(entryPtr);
          entryPtr = Tcl_NextHashEntry(&searchPtr);
      }
    */
}

vbf_neighborhood*
AquaSimPktHashTable::GetHash(AquaSimAddress senderAddr, unsigned int pk_num)
{
    hash_entry entry = std::make_pair(senderAddr, pk_num);
    std::map<hash_entry, vbf_neighborhood*>::iterator it;

    it = m_htable.find(entry);

    if (it == m_htable.end())
    {
        return NULL;
    }

    return it->second;
    /*
    unsigned int key[3];

      key[0] = senderAddr;
      key[1] = 0; //sender_id.port_;
      key[2] = pk_num;

      Tcl_HashEntry *entryPtr = Tcl_FindHashEntry(&m_htable, (char *)key);

      if (entryPtr == NULL )
          return NULL;

      return (vbf_neighborhood *)Tcl_GetHashValue(entryPtr);
    */
}

void
AquaSimPktHashTable::PutInHash(AquaSimAddress sAddr, unsigned int pkNum)
{
    // Tcl_HashEntry *entryPtr;
    //  Pkt_Hash_Entry    *hashPtr;
    vbf_neighborhood* hashPtr;
    // unsigned int key[3];
    // bool newPtr = true;

    // key[1]=0; //(vbh->sender_id).port_;
    hash_entry entry = std::make_pair(sAddr, pkNum);
    std::map<hash_entry, vbf_neighborhood*>::iterator it;

    const auto k = pkNum > static_cast<unsigned>(m_windowSize) ? pkNum - m_windowSize : 0;
    if (k > 0) // TODO verify this in future work
    {
        auto old = m_htable.lower_bound(std::make_pair(sAddr, 0u));
        while (old != m_htable.end() && old->first.first == sAddr && old->first.second < k)
        {
            delete old->second;
            old = m_htable.erase(old);
        }
    }

    entry.second = pkNum;
    hashPtr = GetHash(sAddr, pkNum);
    // entryPtr = Tcl_CreateHashEntry(&m_htable, (char *)key, &newPtr);
    if (hashPtr != NULL)
    {
        int m = hashPtr->number;
        if (m < MAX_NEIGHBOR)
        {
            hashPtr->number++;
            hashPtr->neighbor[m].x = 0;
            hashPtr->neighbor[m].y = 0;
            hashPtr->neighbor[m].z = 0;
        }
        return;
    }
    hashPtr = new vbf_neighborhood();
    hashPtr->number = 1;
    hashPtr->neighbor[0].x = 0;
    hashPtr->neighbor[0].y = 0;
    hashPtr->neighbor[0].z = 0;
    std::pair<hash_entry, vbf_neighborhood*> newPair;
    newPair.first = entry;
    newPair.second = hashPtr;
    if (m_htable.insert(newPair).second == false)
    {
        delete newPair.second;
    }
    // Tcl_SetHashValue(entryPtr, hashPtr);
}

void
AquaSimPktHashTable::PutInHash(AquaSimAddress sAddr, unsigned int pkNum, Vector p)
{
    NS_LOG_DEBUG("PutinHash begin:" << sAddr << "," << pkNum << ",(" << p.x << "," << p.y << ","
                                    << p.z << ")");
    // Tcl_HashEntry *entryPtr;
    //  Pkt_Hash_Entry    *hashPtr;
    vbf_neighborhood* hashPtr;
    // unsigned int key[3];
    // bool newPtr = true;

    // key[1]=0; //(vbh->sender_id).port_;
    hash_entry entry = std::make_pair(sAddr, pkNum);
    std::map<hash_entry, vbf_neighborhood*>::iterator it;
    const auto k = pkNum > static_cast<unsigned>(m_windowSize) ? pkNum - m_windowSize : 0;
    if (k > 0)
    {
        auto old = m_htable.lower_bound(std::make_pair(sAddr, 0u));
        while (old != m_htable.end() && old->first.first == sAddr && old->first.second < k)
        {
            delete old->second;
            old = m_htable.erase(old);
        }
    }

    entry.second = pkNum;
    hashPtr = GetHash(sAddr, pkNum);
    // entryPtr = Tcl_CreateHashEntry(&m_htable, (char *)key, &newPtr);
    if (hashPtr != NULL)
    {
        int m = hashPtr->number;
        // printf("hash_table: this is not old item, there are %d item inside\n",m);
        if (m < MAX_NEIGHBOR)
        {
            hashPtr->number++;
            hashPtr->neighbor[m].x = p.x;
            hashPtr->neighbor[m].y = p.y;
            hashPtr->neighbor[m].z = p.z;
        }
        return;
    }
    hashPtr = new vbf_neighborhood();
    hashPtr->number = 1;
    hashPtr->neighbor[0].x = p.x;
    hashPtr->neighbor[0].y = p.y;
    hashPtr->neighbor[0].z = p.z;
    std::pair<hash_entry, vbf_neighborhood*> newPair;
    newPair.first = entry;
    newPair.second = hashPtr;
    if (m_htable.insert(newPair).second == false)
    {
        delete newPair.second;
    }
    // Tcl_SetHashValue(entryPtr, hashPtr);
}

AquaSimDataHashTable::AquaSimDataHashTable()
{
    NS_LOG_FUNCTION(this);
    Reset();
    // Tcl_InitHashTable(&htable, MAX_ATTRIBUTE);
}

AquaSimDataHashTable::~AquaSimDataHashTable()
{
    NS_LOG_FUNCTION(this);
    Reset();
}

void
AquaSimDataHashTable::Reset()
{
    for (std::map<int*, int*>::iterator it = m_htable.begin(); it != m_htable.end(); ++it)
    {
        delete it->first;
        delete it->second;
    }
    m_htable.clear();
    /*
      Tcl_HashEntry *entryPtr;
      Tcl_HashSearch searchPtr;

      entryPtr = Tcl_FirstHashEntry(&htable, &searchPtr);
      while (entryPtr != NULL) {
          Tcl_DeleteHashEntry(entryPtr);
          entryPtr = Tcl_NextHashEntry(&searchPtr);
      }
    */
}

int*
AquaSimDataHashTable::GetHash(int* attr)
{
    std::map<int*, int*>::iterator it;
    it = m_htable.find(attr);
    if (it == m_htable.end())
    {
        return NULL;
    }

    return it->second;
}

void
AquaSimDataHashTable::PutInHash(int* attr)
{
    // bool newPtr = true;

    // Tcl_HashEntry* entryPtr=Tcl_CreateHashEntry(&htable, (char *)attr, &newPtr);
    if (m_htable.count(attr) > 0)
    {
        return;
    }

    int* hashPtr = new int[1];
    hashPtr[0] = 1;
    m_htable.insert(std::pair<int*, int*>(attr, hashPtr));
    // Tcl_SetHashValue(entryPtr, hashPtr);
}

NS_OBJECT_ENSURE_REGISTERED(AquaSimVBF);

AquaSimVBF::AquaSimVBF()
{
    // Initialize variables.
    //  printf("VB initialized\n");
    m_pkCount = 0;
    // TODO
    m_width = 2500;
    // m_width=0;
    m_counter = 0;
    m_priority = 1.2;
    // m_priority=2;
    // m_useOverhear = 0;
    m_enableRouting = 1;
    m_targetPos = Vector();
    m_rand = CreateObject<UniformRandomVariable>();
}

TypeId
AquaSimVBF::GetTypeId()
{
    static TypeId tid = TypeId("ns3::AquaSimVBF")
                            .SetParent<AquaSimRouting>()
                            .AddConstructor<AquaSimVBF>()
                            .AddAttribute("HopByHop",
                                          "Hop by hop VBF setting. Default 0 is false.",
                                          IntegerValue(0),
                                          MakeIntegerAccessor(&AquaSimVBF::m_hopByHop),
                                          MakeIntegerChecker<int>())
                            .AddAttribute("EnableRouting",
                                          "Enable routing VBF setting. Default 1 is true.",
                                          IntegerValue(1),
                                          MakeIntegerAccessor(&AquaSimVBF::m_enableRouting),
                                          MakeIntegerChecker<int>())
                            .AddAttribute("Width",
                                          "Radius of the VBF forwarding pipe in meters. Default is 2500.",
                                          DoubleValue(2500),
                                          // DoubleValue(100),
                                          MakeDoubleAccessor(&AquaSimVBF::m_width),
                                          MakeDoubleChecker<double>(std::numeric_limits<double>::min()))
                            .AddAttribute("TargetPos",
                                          "Position of target sink (x,y,z).",
                                          Vector3DValue(),
                                          MakeVector3DAccessor(&AquaSimVBF::m_targetPos),
                                          MakeVector3DChecker());
    return tid;
    // bind("m_useOverhear_", &m_useOverhear);
}

int64_t
AquaSimVBF::AssignStreams(int64_t stream)
{
    NS_LOG_FUNCTION(this << stream);
    m_rand->SetStream(stream);
    return 1;
}

// 传输层调用Txprocess
bool
AquaSimVBF::TxProcess(Ptr<Packet> packet, const Address& dest, uint16_t protocolNumber)
{
    AquaVisualVbfHeader vbh;

    vbh.SetSenderAddr(AquaSimAddress::ConvertFrom(m_device->GetAddress()));
    vbh.SetTargetAddr(AquaSimAddress::ConvertFrom(dest));
    packet->AddHeader(vbh);

    return Recv(packet, dest, protocolNumber);
}

// MAC层的包调用Recv
bool
AquaSimVBF::Recv(Ptr<Packet> packet, const Address& dest, uint16_t protocolNumber)
{
    NS_LOG_FUNCTION(this);
    NS_LOG_DEBUG("================Recv=================\n");

    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;

    packet->RemoveHeader(vbh);
    packet->RemoveTrailer(tra);
    // std::cout<<"Recv packet:"<<packet<<"\n";
    // std::cout<<"ash.GetNumForwards:"<<ash.GetNumForwards()<<"\n";
    if (vbh.GetMessType() != AS_DATA)
    {
        // no headers //TODO create specalized Application instead of using this hack.// how many
        // times this pkt was forwarded
        tra.SetNextHop(AquaSimAddress::GetBroadcast());
        tra.SetSAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));
        tra.SetDAddr(AquaSimAddress::ConvertFrom(dest));

        vbh.SetMessType(AS_DATA);
        vbh.SetSenderAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));
        vbh.SetForwardAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));
        vbh.SetTargetAddr(AquaSimAddress::ConvertFrom(dest));
        vbh.SetPkNum(packet->GetUid());

        // set position error    //todo

        Ptr<Object> sObject = GetDevice()->GetNode();
        Ptr<MobilityModel> sModel = sObject->GetObject<MobilityModel>();

        // todo
        // GetDevice()->SetRouting(this);
        vbh.SetOriginalSource(sModel->GetPosition());
        vbh.SetExtraInfo_f(sModel->GetPosition());

        vbh.SetExtraInfo_t(m_targetPos);
        vbh.SetExtraInfo_o(sModel->GetPosition());
        NS_LOG_DEBUG("source position:x:" << sModel->GetPosition().x
                  << " y:" << sModel->GetPosition().y << " z:" << sModel->GetPosition().z);
        NS_LOG_DEBUG("Recv-addheader\n");

        packet->AddHeader(vbh);
    }
    else
    {
        packet->AddHeader(vbh);
        packet->PeekHeader(vbh);
        // ignoring forward iterator, but this can be simply changed if necessary
    }

    packet->AddTrailer(tra);
    // unsigned char msg_type =vbh.GetMessType();  //unused
    // unsigned int dtype = vbh.GetDataType();  //unused
    // double t1=vbh.GetTs();  //unused

    if (!m_enableRouting)
    {
        if (vbh.GetMessType() != AS_DATA)
        {
            packet = 0;
            NS_LOG_DEBUG("vbf recv vbh.GetMessType() != AS_DATA vbh.GetMessType():"
                      << vbh.GetMessType());
            return false;
        }
        NS_LOG_DEBUG("vbh.GetTargetAddr():" << vbh.GetTargetAddr() << " GetDevice()->GetAddress()"
                  << GetDevice()->GetAddress());

        if (vbh.GetSenderAddr() == GetDevice()->GetAddress())
        {
            MACprepare(packet);
            MACsend(packet, (m_rand->GetValue() * JITTER));
            NS_LOG_DEBUG("Recv macsend\n");
        }
        else if (vbh.GetTargetAddr() == GetDevice()->GetAddress())
        {
            DataForSink(packet);
            NS_LOG_DEBUG("Recv data for sink\n");
        }
        return true;
    }

    vbf_neighborhood* hashPtr = PktTable.GetHash(vbh.GetSenderAddr(), vbh.GetPkNum());
    // Received this packet before ?

    if (hashPtr != NULL)
    {
        PktTable.PutInHash(vbh.GetSenderAddr(), vbh.GetPkNum(), vbh.GetExtraInfo().f);
        packet = 0;
        Ptr<Object> sObject = GetDevice()->GetNode();
        Ptr<MobilityModel> sModel = sObject->GetObject<MobilityModel>();
        NS_LOG_DEBUG("hashPtr != NULL position.x:" << sModel->GetPosition().x
                  << "position.y:" << sModel->GetPosition().y
                  << "position.z:" << sModel->GetPosition().z);
        NS_LOG_DEBUG("vbf hashPtr != null");
        return false;
        // printf("vectrobasedforward: this is duplicate packet\n");
    }
    else
    {
        // Never receive it before ? Put in hash table.
        // printf("vectrobasedforward: this is new packet\n");
        NS_LOG_DEBUG("Recv nevev receive it before\n");
        PktTable.PutInHash(vbh.GetSenderAddr(), vbh.GetPkNum(), vbh.GetExtraInfo().f);

        Ptr<Object> sObject = GetDevice()->GetNode();
        Ptr<MobilityModel> sModel = sObject->GetObject<MobilityModel>();
        // Todo
        NS_LOG_DEBUG("position.x:" << sModel->GetPosition().x
                  << "position.y:" << sModel->GetPosition().y
                  << "position.z:" << sModel->GetPosition().z);
        // todo end
        Vector forwarder = vbh.GetExtraInfo().f;

        packet->RemoveHeader(vbh);
        Vector d = Vector(sModel->GetPosition().x - forwarder.x,
                          sModel->GetPosition().y - forwarder.y,
                          sModel->GetPosition().z - forwarder.z);
        vbh.SetExtraInfo_d(d);
        packet->AddHeader(vbh);

        ConsiderNew(packet);
    }

    return true;
}

void
AquaSimVBF::ConsiderNew(Ptr<Packet> pkt)
{
    // std::cout << "===========vbf: considerNew===========\n";
    NS_LOG_FUNCTION(this);

    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;

    pkt->PeekHeader(vbh);
    // Todo
    double tx = vbh.GetExtraInfo().t.x;
    double ty = vbh.GetExtraInfo().t.y;
    double tz = vbh.GetExtraInfo().t.z;
    NS_LOG_DEBUG("consider new begin : Advance target position is:" << tx << "," << ty << "," << tz
              << '\n');
    Vector pos = GetDevice()->GetPosition();
    NS_LOG_DEBUG("consider new begin : Advance current position is:" << pos.x << "," << pos.y << ","
              << pos.z << '\n');
    // todo end

    unsigned char msg_type = vbh.GetMessType();
    // unsigned int dtype = vbh.GetDataType();  //unused
    double l; //,h;  //unused
              // JITTER=0.1;use to generate random
    // Pkt_Hash_Entry *hashPtr;
    vbf_neighborhood* hashPtr;
    //  Agent_List *agentPtr;
    // PrvCurPtr  RetVal;
    AquaSimAddress from_nodeAddr; //, forward_nodeAddr;zhuan fa qi

    Ptr<Packet> gen_pkt;
    AquaVisualVbfHeader gen_vbh;

    //  printf("Vectorbasedforward:oops!\n");
    switch (msg_type)
    {
    case INTEREST:
        NS_LOG_DEBUG("===========vbf: INTEREST===========\n");
        // printf("Vectorbasedforward:it is interest packet!\n");
        hashPtr = PktTable.GetHash(vbh.GetSenderAddr(), vbh.GetPkNum());
        NS_LOG_INFO("ConsiderNew: INTEREST, hashptr #=" << hashPtr->number);
        // Check if it comes from sink agent of this node
        // If so we have to keep it in sink list

        from_nodeAddr = vbh.GetSenderAddr();
        // forward_nodeAddr = vbh.GetForwardAddr();
        //   printf("Vectorbasedforward:it the from_nodeaddr is %d %d  and theb this node id is %d
        //   ,%d!\n", from_nodeAddr,from_nodeID.port_,THIS_NODE.addr_,THIS_NODE.port_ );

        if (GetDevice()->GetAddress() == from_nodeAddr)
        {
            MACprepare(pkt);
            MACsend(pkt, m_rand->GetValue() * JITTER);
            //  printf("vectorbasedforward: after MACprepare(pkt)\n");
        }
        else
        {
            // CalculatePosition(pkt); not necessary with mobilitymodel
            // printf("vectorbasedforward: This packet is from different node\n");
            if (IsTarget(pkt))
            {
                // If this node is target?
                l = Advance(pkt); // l=0?

                //    if (!SendUp(p))
                //	     NS_LOG_WARN("DataForSink: Something went wrong when passing packet up to
                // dmux.");
                //  printf("vectorbasedforward:%d send out the source-discovery \n",here_.addr_);
                //  pkt->RemoveHeader(ash);
                pkt->RemoveHeader(vbh);
                vbh.SetMessType(SOURCE_DISCOVERY);
                pkt->AddHeader(vbh);
                // pkt->AddHeader(ash);
                SetDelayTimer(pkt, l * JITTER);
                // !!! need to re-think
            }
            else
            {
                // CalculatePosition(pkt);
                // No the target forwared
                l = Advance(pkt);
                // h=Projection(pkt);  //never used...
                if (IsCloseEnough(pkt))
                {
                    // printf("vectorbasedforward:%d I am close enough for the
                    // interest\n",here_.addr_);
                    MACprepare(pkt);
                    MACsend(pkt, m_rand->GetValue() * JITTER); //!!!! need to re-think
                }
                else
                {
                    //  printf("vectorbasedforward:%d I am not close enough for the interest
                    //  \n",here_.addr_);
                    pkt = 0;
                }
            }
        }
        // pkt=0;
        return;

    case TARGET_DISCOVERY:
        NS_LOG_DEBUG("===========vbf: Target_DISCOVERY==========\n");
        // from other nodes hitted by the packet, it is supposed
        // to be the one hop away from the sink

        // printf("Vectorbasedforward(%d,%d):it is target-discovery  packet(%d)! it target id is %d
        // coordinate is %f,%f,%f and range is
        // %f\n",here_.addr_,here_.port_,vbh.GetPkNum(),vbh.GetTargetAddr(),vbh.GetExtraInfo().t.x,
        // vbh.GetExtraInfo().t.y,vbh.GetExtraInfo().t.z,vbh.GetRange());
        if (GetDevice()->GetAddress() == vbh.GetTargetAddr())
        {
            // printf("Vectorbasedforward(%d,??%d):it is target-discovery  packet(%d)! it target id
            // is %d  coordinate is %f,%f,%f and range is
            // %f\n",here_.addr_,here_.port_,vbh.GetPkNum(),vbh.GetTargetAddr(),vbh.GetExtraInfo().t.x,
            // vbh.GetExtraInfo().t.y,vbh.GetExtraInfo().t.z,vbh.GetRange());
            //  AquaSimAddress *hashPtr= PktTable.GetHash(vbh.GetSenderAddr(), vbh.GetPkNum());
            //  Received this packet before ?
            //  if (hashPtr == NULL) {

            // CalculatePosition(pkt); not necessary with mobilitymodel
            DataForSink(pkt);
            NS_LOG_INFO("AquaSimVBF::ConsiderNew: target is " << GetDevice()->GetAddress());
            // } //New data Process this data
            //
        }
        else
        {
            pkt = 0;
        }
        return;

    case SOURCE_DISCOVERY:
        NS_LOG_DEBUG("===========vbf: source_discovery===========\n");
        pkt = 0;
        // other nodes already claim to be the source of this interest
        //   SourceTable.PutInHash(vbh);
        return;

    case DATA_READY:
        NS_LOG_DEBUG("===========vbf:data_ready==========\n");
        //  printf("Vectorbasedforward(%d,%d):it is data ready packet(%d)! it target id is %d
        //  \n",here_.addr_,here_.port_,vbh->pk_num,vbh->target_id.addr_);
        from_nodeAddr = vbh.GetSenderAddr();
        if (GetDevice()->GetAddress() == from_nodeAddr)
        {
            // come from the same node, broadcast it
            MACprepare(pkt);
            MACsend(pkt, m_rand->GetValue() * JITTER);
            return;
        }
        // CalculatePosition(pkt); not necessary with mobilitymodel
        if (GetDevice()->GetAddress() == vbh.GetTargetAddr())
        {
            NS_LOG_INFO("AquaSimVBF::ConsiderNew: target is " << GetDevice()->GetAddress());
            DataForSink(pkt); // process it
        }
        else
        {
            // printf("Vectorbasedforward: %d is the not  target\n", here_.addr_);
            MACprepare(pkt);
            MACsend(pkt, m_rand->GetValue() * JITTER);
        }
        return;

        /*
           case DATA_READY :

           // put source_agent in source list of routing table
           agentPtr = new Agent_List;
           AGT_ADDR(agentPtr) = vbh.GetSenderAddr();
           agentPtr->next = routing_table[dtype].source;
           routing_table[dtype].source = agentPtr;

           // !! this part will be modified later
           God::instance()->AddSource(dtype, (vbh.GetSenderAddr()));

           gen_pkt = PrepareMessage(dtype, vbh.GetSenderAddr(), DATA_REQUEST);
           gen_vbh = HDR_UWVB(gen_pkt);
           //      gen_vbh->report_rate = ORIGINAL;
         if (!SendUp(p))
            NS_LOG_WARN("DataForSink: Something went wrong when passing packet up to dmux.");
           pkt=0;
           return;
         */

    case AS_DATA:
        NS_LOG_DEBUG("===========vbf: as data===========\n");
        NS_LOG_INFO("AquaSimVBF::ConsiderNew: data packet");

        // std::cout<<"considerNew as_data current
        // node:"<<GetDevice()->GetNode()->GetObject<Node>()->GetId()<<"\n"; std::cout<< "Node
        // "<<AquaSimAddress::ConvertFrom(m_device->GetAddress()).GetAsInt()<<" MAC Layer Send
        // down"<<std::endl; std::cout<<"considerNew as_data current node
        // position:"<<GetDevice()->GetAddress()<<"\n"; printf("Vectorbasedforward(%d,%d):it is data
        // packet(%d)! it target id is %d  coordinate is %f,%f,%f and range is
        // %f\n",here_.addr_,here_.port_,vbh->pk_num,vbh->target_id.addr_,vbh->info.tx,
        // vbh->info.ty,vbh->info.tz,vbh->range); printf("Vectorbasedforward(%d):it is data
        // packet(%d)\n",here_.addr_,vbh->pk_num);
        from_nodeAddr = vbh.GetSenderAddr();
        // TODO
        if (GetDevice()->GetAddress() == from_nodeAddr)
        {
            // come from the same node, broadcast it
            NS_LOG_DEBUG("considerNew_MACsssend\n");
            MACprepare(pkt);
            MACsend(pkt, 0);
            return;
        }
        // CalculatePosition(pkt); not necessary with mobilitymodel
        //   printf("vectorbasedforward: after MACprepare(pkt)\n");
        l = Advance(pkt);
        // h=Projection(pkt);  //never used...
        NS_LOG_DEBUG("considerNew as_data forwardnodeaddr:" << vbh.GetSenderAddr() << "\n");
        NS_LOG_DEBUG("considerNew_as_data l:" << l << "\n");

        if (GetDevice()->GetAddress() == vbh.GetTargetAddr())
        {
            // printf("Vectorbasedforward: %d is the target\n", here_.addr_);
            DataForSink(pkt); // process it
            NS_LOG_DEBUG("considerNew_as_data data for sink\n");
        }

        else
        {
            //  printf("Vectorbasedforward: %d is the not  target\n", here_.addr_);
            // TODO iscloseenough return false,surely,so pkt=0
            if (IsCloseEnough(pkt))
            {
                NS_LOG_DEBUG("ConsiderNew as_data isclosenough\n");
                Vector* p1;
                p1 = new Vector[1];
                p1[0].x = vbh.GetExtraInfo().f.x;
                p1[0].y = vbh.GetExtraInfo().f.y;
                p1[0].z = vbh.GetExtraInfo().f.z;
                double delay = CalculateDelay(
                    pkt,
                    p1); // TODO should just pass the Vector for easier memory management here.
                delete[] p1;
                double d2 = (Distance(pkt) - m_device->GetPhy()->GetTransRange()) /
                            ns3::SOUND_SPEED_IN_WATER; // gettransrange=0
                // printf("Vectorbasedforward: I am  not  target delay is %f d2=%f
                // distance=%f\n",(sqrt(delay)*DELAY+d2*2),d2,Distance(pkt)); std::cout << "DElay is
                // " << (sqrt(delay)*DELAY+d2*2) << " d2 is " << d2 << " distance is " <<
                // Distance(pkt) << "\n";
                SetDelayTimer(pkt, (sqrt(delay) * DELAY + d2 * 2)); // set Tdelay=1.0
            }
            else
            {
                pkt = 0;
            }
        }
        return;

    default:

        pkt = 0;
        break;
    }
}

void
AquaSimVBF::Reset()
{
    PktTable.Reset();
    /*
       for (int i=0; i<MAX_DATA_TYPE; i++) {
       routing_table[i].Reset();
       }
     */
}

void
AquaSimVBF::Terminate()
{
    NS_LOG_DEBUG("AquaSimVBF::Terminate: Node="
                 << GetDevice()->GetAddress()
                 << ": remaining energy=" << GetDevice()->GetEnergyModel()->GetEnergy()
                 << ", initial energy=" << GetDevice()->GetEnergyModel()->GetInitialEnergy());
}

void
AquaSimVBF::StopSource()
{
    /*
       Agent_List *cur;

       for (int i=0; i<MAX_DATA_TYPE; i++) {
       for (cur=routing_table[i].source; cur!=NULL; cur=AGENT_NEXT(cur) ) {
       SEND_MESSAGE(i, AGT_ADDR(cur), DATA_STOP);
       }
       }
     */
}

Ptr<Packet>
AquaSimVBF::CreatePacket()
{
    NS_LOG_FUNCTION(this);

    Ptr<Packet> pkt = Create<Packet>();

    if (!pkt)
    {
        return NULL;
    }

    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;
    // ash.SetSize(36);
    vbh.SetTs(Simulator::Now().ToDouble(Time::S));

    //!! I add new part

    vbh.SetExtraInfo_o(GetDevice()->GetPosition());
    vbh.SetExtraInfo_f(GetDevice()->GetPosition());

    pkt->AddHeader(vbh);
    pkt->AddTrailer(tra);
    return pkt;
}

Ptr<Packet>
AquaSimVBF::PrepareMessage(unsigned int dtype, AquaSimAddress to_addr, int msg_type)
{
    NS_LOG_DEBUG("-----------vbf PrepareMessage-----------\n");
    Ptr<Packet> pkt = Create<Packet>();
    AquaVisualVbfHeader vbh;

    vbh.SetMessType(msg_type);
    vbh.SetPkNum(m_pkCount);
    m_pkCount++;
    vbh.SetSenderAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));
    vbh.SetDataType(dtype);
    vbh.SetForwardAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));

    vbh.SetTs(Simulator::Now().ToDouble(Time::S));
    //    vbh->num_next = 1;
    // I am not sure if we need this
    // vbh->next_nodes[0] = to_addr;

    // I am not sure if we need it?
    /*
       iph->src_ = here_;
       iph->dst_ = to_addr;
     */
    pkt->AddHeader(vbh);

    return pkt;
}

void
AquaSimVBF::MACprepare(Ptr<Packet> pkt)
{
    // std::cout << "-----------vbf MACprepare-----------\n";
    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;

    pkt->RemoveHeader(vbh);
    pkt->RemoveTrailer(tra);
    vbh.SetForwardAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));

    // printf("vectorbased: the mac_Broadcast is:%d\n",MAC_BROADCAST);
    tra.SetNextHop(AquaSimAddress::GetBroadcast());
    // ash.addr_type() = NS_AF_ILINK;
    //  ash.SetTxTime(Seconds(0));
    //  printf("vectorbased: the address type is :%d and suppose to be %d and  nexthop %d MAC_BROAD
    //  %d\n", ash->addr_type(),NS_AF_ILINK,ash->next_hop(),MAC_BROADCAST);
    // ash.SetDirection(AquaSimHeader::DOWN);

    /*if(!GetDevice()->GetSinkStatus()) {       //!! I add new part
    f = Vector(GetDevice()->CX(),
                  GetDevice()->CY(),
                  GetDevice()->CZ());
    }
    else{*/
    Ptr<MobilityModel> model = GetDevice()->GetNode()->GetObject<MobilityModel>();
    //}
    vbh.SetExtraInfo_f(model->GetPosition());

    pkt->AddHeader(vbh);
    pkt->AddTrailer(tra);
    // printf("vectorbasedforward: last line MACprepare\n");
}

void
AquaSimVBF::MACsend(Ptr<Packet> pkt, double delay)
{
    // std::cout << "-----------vbf MACsend-----------\n";
    NS_LOG_INFO("MACsend: delay " << delay << " at time " << Simulator::Now().GetSeconds());

    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;

    pkt->RemoveTrailer(tra);
    pkt->RemoveHeader(vbh);
    // pkt->RemovePacketTag(ptag);

    // I don't understand why it works like this way
    /*
       if (vbh.GetMessType() == AS_DATA)
       ash->size() = (God::instance()->data_pkt_size) + 4*(vbh.GetPkNum() - 1);
       else
       ash->size() = 36 + 4*(vbh.GetPkNum() -1);
     */

    /*
       if (vbh.GetMessType() == AS_DATA)
       // ash->size() = (God::instance()->data_pkt_size)+12 ;
       ash->size() = 65+12 ;
       else
       ash->size() =32;
     */

    // if(!ll) printf("ok, the LL is empty\n");
    // ptag.SetPacketType(PT_UWVB);
    // printf("vectorbased: the address type is :%d uid is %d\n", ash->addr_type(),pkt->uid_);
    // printf("vectorbased: the packet type is :%d\n", ptag.GetPacketType());
    //  ll->handle(pkt);
    pkt->AddHeader(vbh);
    pkt->AddTrailer(tra);

    Simulator::Schedule(Seconds(delay),
                        &AquaSimRouting::SendDown,
                        this,
                        pkt,
                        AquaSimAddress::GetBroadcast(),
                        Seconds(0));
}

void
AquaSimVBF::DataForSink(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;
    pkt->RemoveHeader(vbh);
    if (!SendUp(pkt))
    {
        NS_LOG_WARN("DataForSink: Something went wrong when passing packet up to dmux.");
    }
}

void
AquaSimVBF::SetDelayTimer(Ptr<Packet> pkt, double c)
{
    NS_LOG_FUNCTION(this << c);
    if (c < 0)
    {
        c = 0;
    }
    Simulator::Schedule(Seconds(c), &AquaSimVBF::Timeout, this, pkt);
}

void
AquaSimVBF::Timeout(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;

    pkt->PeekHeader(vbh);

    unsigned char msg_type = vbh.GetMessType();
    NS_LOG_DEBUG("Timeout:" << msg_type << "\n");
    vbf_neighborhood* hashPtr;
    // Ptr<Packet> p1;

    switch (msg_type)
    {
    case AS_DATA:
        hashPtr = PktTable.GetHash(vbh.GetSenderAddr(), vbh.GetPkNum());
        if (hashPtr != NULL)
        {
            int num_neighbor = hashPtr->number;
            NS_LOG_DEBUG("Timeout as_data n-neighbor:" << num_neighbor << "\n");
            // printf("vectorbasedforward: node %d have received %d when wake up at
            // %f\n",here_.addr_,num_neighbor,NOW);
            if (num_neighbor != 1)
            {
                /*AlohaOverhear can guarantee that the packet be successfully deliveried to next
                 * hop, so we release the pkt if overhearing other neighbors send this pkt.
                 */
                /* if( m_useOverhear )
                   {
                         pkt=0;
                         return;
                   }*/

                // Some guys transmit the data before me
                if (num_neighbor == MAX_NEIGHBOR)
                {
                    // I have too many neighbors, I quit
                    pkt = 0;
                    return;
                }
                else // I need to calculate my delay time again
                {
                    int i = 0;
                    Vector* tp;
                    tp = new Vector[1];

                    tp[0].x = hashPtr->neighbor[i].x;
                    tp[0].y = hashPtr->neighbor[i].y;
                    tp[0].z = hashPtr->neighbor[i].z;
                    double tdelay = CalculateDelay(pkt, tp);
                    // neighbor's tdelay
                    //  double tdelay=5;
                    i++;
                    double c = 1;
                    while (i < num_neighbor)
                    {
                        c = c * 2;
                        tp[0].x = hashPtr->neighbor[i].x;
                        tp[0].y = hashPtr->neighbor[i].y;
                        tp[0].z = hashPtr->neighbor[i].z;
                        double t2delay = CalculateDelay(pkt, tp);
                        if (t2delay < tdelay)
                        {
                            tdelay = t2delay;
                        }
                        i++;
                        NS_LOG_DEBUG("Timeout i:" << i << "calculatedelay:" << tdelay << "\n");
                    }

                    delete[] tp;
                    if (tdelay <= (m_priority / c))
                    {
                        MACprepare(pkt);
                        MACsend(pkt, 0);
                        NS_LOG_DEBUG("Timeout delay=a less than priority,then macsend\n");
                    }
                    else
                    {
                        pkt = 0; // to much overlap, don;t send
                    }
                } // end of calculate my new delay time
            }
            else
            { // I am the only neighbor
                Vector* tp;
                tp = new Vector[1];
                tp[0].x = vbh.GetExtraInfo().f.x;
                tp[0].y = vbh.GetExtraInfo().f.y;
                tp[0].z = vbh.GetExtraInfo().f.z;
                double delay = CalculateDelay(pkt, tp);
                NS_LOG_DEBUG("Timeout only neighbor delay:" << delay << "\n");
                delete[] tp;
                if (delay <= m_priority)
                {
                    // printf("vectorbasedforward: !!%f\n",delay);
                    MACprepare(pkt);
                    MACsend(pkt, 0);
                    NS_LOG_DEBUG("Timeout only neighbor and delay=a less than priority,then macsend\n");
                }
                else
                {
                    pkt = 0;
                }
                // printf("vectorbasedforward:  I%d am the only neighbor, I send it out at
                // %f\n",here_.addr_,NOW);
                return;
            }
        }
        break;
    default:
        pkt = 0;
        break;
    }
}

void
AquaSimVBF::CalculatePosition(Ptr<Packet> pkt)
{
    // not used.
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);
    auto f = vbh.GetExtraInfo().f;
    auto d = vbh.GetExtraInfo().d;
    auto c = f + d;
    // GetDevice()->SetPosition(c);
    printf("vectorbased: my position is computed as (%f,%f,%f)\n", c.x, c.y, c.z);
}

double
AquaSimVBF::CalculateDelay(Ptr<Packet> pkt, Vector* p1) // calculate a,rather than delay
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    double fx = p1->x;
    double fy = p1->y;
    double fz = p1->z;

    Vector pos = GetDevice()->GetPosition();
    double dx = pos.x - fx;
    double dy = pos.y - fy;
    double dz = pos.z - fz;

    double tx = vbh.GetExtraInfo().t.x;
    double ty = vbh.GetExtraInfo().t.y;
    double tz = vbh.GetExtraInfo().t.z;

    double dtx = tx - fx;
    double dty = ty - fy;
    double dtz = tz - fz;

    double dp = dx * dtx + dy * dty + dz * dtz;

    // double a=Advance(pkt);
    double p = Projection(pkt);
    double d = sqrt((dx * dx) + (dy * dy) + (dz * dz));
    double l = sqrt((dtx * dtx) + (dty * dty) + (dtz * dtz));
    double cos_theta;
    if (d == 0 || l == 0)
    {
        cos_theta = 0;
    }
    else
    {
        cos_theta = dp / (d * l);
    }
    // double delay=(TRANSMISSION_DISTANCE-d*cos_theta)/TRANSMISSION_DISTANCE;
    const double range = m_device->GetPhy()->GetTransRange();
    if (!std::isfinite(range) || range <= 0)
        throw std::runtime_error("VBF requires a positive finite PHY transRange");
    double delay = (p / m_width) + ((m_device->GetPhy()->GetTransRange() - d * cos_theta) /
                                    m_device->GetPhy()->GetTransRange());
    // double delay=(p/m_width) +((TRANSMISSION_DISTANCE-d)/TRANSMISSION_DISTANCE)+(1-cos_theta);
    // printf("vectorbased: node(%d) projection is %f, and cos is %f, and d is %f)\n",here_.addr_,p,
    // cos_theta, d);
    NS_LOG_DEBUG("CalculateDelay(" << GetDevice()->GetAddress() << ") projection is " << p
                                   << ", cos is " << cos_theta << " and d is " << d
                                   << " and total delay is " << delay);
    return std::max(0.0, delay);
}

double
AquaSimVBF::Distance(Ptr<Packet> pkt) // d
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    double tx = vbh.GetExtraInfo().f.x;
    double ty = vbh.GetExtraInfo().f.y;
    double tz = vbh.GetExtraInfo().f.z;
    // printf("vectorbased: the target is %lf,%lf,%lf \n",tx,ty,tz);
    Vector pos = GetDevice()->GetPosition();
    // double x=GetDevice()->CX(); //change later
    // double y=GetDevice()->CY();// printf(" Vectorbasedforward: I am in advanced\n");
    // double z=GetDevice()->CZ();
    //  printf("the target is %lf,%lf,%lf and my coordinates are %lf,%lf,%lf\n",tx,ty,tz,x,y,z);
    return sqrt((tx - pos.x) * (tx - pos.x) + (ty - pos.y) * (ty - pos.y) +
                (tz - pos.z) * (tz - pos.z));
}

double
AquaSimVBF::Advance(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    double tx = vbh.GetExtraInfo().t.x;
    double ty = vbh.GetExtraInfo().t.y;
    double tz = vbh.GetExtraInfo().t.z;
    // TODO
    NS_LOG_DEBUG("Advance target position is:" << tx << "," << ty << "," << tz << '\n');
    // printf("vectorbased: the target is %lf,%lf,%lf \n",tx,ty,tz);
    Vector pos = GetDevice()->GetPosition();
    NS_LOG_DEBUG("Advance current position is:" << pos.x << "," << pos.y << "," << pos.z << '\n');
    // double x=GetDevice()->CX(); //change later
    // double y=GetDevice()->CY();// printf(" Vectorbasedforward: I am in advanced\n");
    // double z=GetDevice()->CZ();
    //  printf("the target is %lf,%lf,%lf and my coordinates are %lf,%lf,%lf\n",tx,ty,tz,x,y,z);
    return sqrt((tx - pos.x) * (tx - pos.x) + (ty - pos.y) * (ty - pos.y) +
                (tz - pos.z) * (tz - pos.z));
}

double
AquaSimVBF::Projection(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    double tx = vbh.GetExtraInfo().t.x;
    double ty = vbh.GetExtraInfo().t.y;
    double tz = vbh.GetExtraInfo().t.z;

    Vector o;
    // double ox, oy, oz;
    NS_LOG_DEBUG("m_hopByHop:" << m_hopByHop);
    if (!m_hopByHop)
    {
        NS_LOG_DEBUG("enter !m_hopByHop");
        // printf("vbf is used\n");
        o.x = vbh.GetExtraInfo().o.x;
        o.y = vbh.GetExtraInfo().o.y;
        o.z = vbh.GetExtraInfo().o.z;
    }
    else
    {
        NS_LOG_DEBUG("not enter !m_hopByHop");
        // printf("m_hopByHop vbf is used\n");
        o.x = vbh.GetExtraInfo().f.x;
        o.y = vbh.GetExtraInfo().f.y;
        o.z = vbh.GetExtraInfo().f.z;
    }

    // NOTE below may not work if the nodes are mobile.
    /*double x=GetDevice()->CX();
    double y=GetDevice()->CY();
    double z=GetDevice()->CZ();
  */
    Vector myPos = GetDevice()->GetPosition();

    double wx = tx - o.x;
    double wy = ty - o.y;
    double wz = tz - o.z;

    double vx = myPos.x - o.x;
    double vy = myPos.y - o.y;
    double vz = myPos.z - o.z;
    // xiang liang cha cheng qiu mian ji,ci chu qiu wan hai shi xiang liang
    double cross_product_x = vy * wz - vz * wy;
    double cross_product_y = vz * wx - vx * wz;
    double cross_product_z = vx * wy - vy * wx;
    NS_LOG_DEBUG("cross_product_x:" << cross_product_x);
    NS_LOG_DEBUG("cross_product_y:" << cross_product_y);
    NS_LOG_DEBUG("cross_product_z:" << cross_product_z);

    NS_LOG_DEBUG("vx-vy-vz:" << vx << "-" << vy << "-" << vz);
    NS_LOG_DEBUG("wx-wy-wz:" << wx << "-" << wy << "-" << wz);
    NS_LOG_DEBUG("vy*wz:" << vy * wz);
    NS_LOG_DEBUG("vz*wy:" << vz * wy);
    // mian ji wei cha cheng hou de mo
    double area = sqrt(cross_product_x * cross_product_x + cross_product_y * cross_product_y +
                       cross_product_z * cross_product_z);
    double length =
        sqrt((tx - o.x) * (tx - o.x) + (ty - o.y) * (ty - o.y) + (tz - o.z) * (tz - o.z));
    // printf("vectorbasedforward: the area is %f and length is %f\n",area,length);
    NS_LOG_DEBUG("Projection: area is " << area << " length is " << length);
    NS_LOG_DEBUG("Projection: area is " << area << " length is " << length);
    if (length == 0)
    {
        return 0;
    }
    NS_LOG_DEBUG("Projection=" << area / length);
    return area / length;
}

bool
AquaSimVBF::IsTarget(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    // TODO
    // if (vbh.GetTargetAddr().GetAsInt()==1) {
    if (vbh.GetTargetAddr().GetAsInt() == 0)
    {
        //  printf("vectorbased: advanced is %lf and my range is %f\n",Advance(pkt),vbh.GetRange());
        return (Advance(pkt) < vbh.GetRange());
    }
    else
    {
        return (GetDevice()->GetAddress() == vbh.GetTargetAddr());
    }
}

bool
AquaSimVBF::IsCloseEnough(Ptr<Packet> pkt)
{
    // AquaVisualVbfHeader vbh;
    // AquaSimHeader ash;
    // pkt->RemoveHeader(ash);
    // pkt->PeekHeader(vbh);
    // pkt->AddHeader(ash);

    // double range=vbh.GetRange();  //unused
    // double range=m_width;

    //  printf("underwatersensor: The m_width is %f\n",range);
    // double ox=vbh.GetExtraInfo().o.x;  //unused
    // double oy=vbh.GetExtraInfo().o.y;  //unused
    // double oz=vbh.GetExtraInfo().o.z;  //unused

    /*
  double tx=vbh.GetExtraInfo().t.x;
    double ty=vbh.GetExtraInfo().t.y;
    double tz=vbh.GetExtraInfo().t.z;

    double fx=vbh.GetExtraInfo().f.x;
    double fy=vbh.GetExtraInfo().f.y;
    double fz=vbh.GetExtraInfo().f.z;
  */ // currently unused...

    // double x=GetDevice()->CX();  //unused  //change later
    // double y=GetDevice()->CY();  //unused
    // double z=GetDevice()->CZ();  //unused

    // double d=sqrt((tx-fx)*(tx-fx)+(ty-fy)*(ty-fy)+(tz-fz)*(tz-fz));  //unused
    // double l=sqrt((tx-ox)*(tx-ox)+(ty-oy)*(ty-oy)+ (tz-oz)*(tz-oz));
    // double l=Advance(pkt);  //unused
    //  if (l<range)
    //  {
    //  printf("vectorbasedforward: IsClose?too close! it should be target!\n");
    //  return true;
    //  }
    //  else {
    // double c=d/l;
    return Projection(pkt) <= m_width;
}

void
AquaSimVBF::DoDispose()
{
    m_rand = 0;
    AquaSimRouting::DoDispose();
}

void
AquaSimVBF::SetTargetPos(Vector pos)
{
    m_targetPos = pos;
}

// Some methods for Flooding Entry

/*
   void Vectorbasedforward_Entry::reset()
   {
   clear_agentlist(source);
   clear_agentlist(sink);
   source = NULL;
   sink = NULL;
   }

   void Vectorbasedforward_Entry::clear_agentlist(Agent_List *list)
   {
   Agent_List *cur=list;
   Agent_List *temp = NULL;

   while (cur != NULL) {
   temp = AGENT_NEXT(cur);
   delete cur;
   cur = temp;
   }
   }

 */

} // namespace ns3
`,Xr=String.raw`
#include "ns3/mobility-module.h"

namespace ns3 {
class AquaVisualLinearMobilityModel : public ConstantVelocityMobilityModel {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualLinearMobilityModel")
            .SetParent<ConstantVelocityMobilityModel>()
            .SetGroupName("Mobility")
            .AddConstructor<AquaVisualLinearMobilityModel>()
            .AddAttribute("InitialVelocity", "Initial velocity vector [unit=m/s].",
                VectorValue(Vector(0, 0, 0)),
                MakeVectorAccessor(&AquaVisualLinearMobilityModel::SetInitialVelocity,
                                   &AquaVisualLinearMobilityModel::GetInitialVelocity),
                MakeVectorChecker());
        return tid;
    }
    void SetInitialVelocity(const Vector& velocity) {
        m_initialVelocity = velocity;
        if (IsInitialized()) SetVelocity(velocity);
    }
    Vector GetInitialVelocity() const { return m_initialVelocity; }
    Ptr<MobilityModel> Copy() const override {
        auto copy = CreateObject<AquaVisualLinearMobilityModel>();
        copy->SetPosition(GetPosition());
        copy->SetInitialVelocity(GetVelocity());
        copy->SetVelocity(GetVelocity());
        return copy;
    }
protected:
    void DoInitialize() override {
        // ConstantVelocity's SetPosition clears its helper velocity. Apply the
        // registered initial velocity after generic installation sets coordinates.
        SetVelocity(m_initialVelocity);
        ConstantVelocityMobilityModel::DoInitialize();
    }
private:
    Vector m_initialVelocity;
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualLinearMobilityModel);
}
`,Zr=[{path:`builtin/observed-signal-cache.cc`,code:Kr},{path:`builtin/aqua-sim-phy-simple.cc`,code:qr},{path:`builtin/terrestrial-radio.cc`,code:Jr},{path:`builtin/aqua-sim-routing-vbf.cc`,code:Yr},{path:`builtin/aqua-visual-linear-mobility.cc`,code:Xr}].map(e=>e.code).join(`
`),Qr=String.raw`
#include <stdexcept>
#include <utility>

using VisualAttributes = std::vector<std::pair<std::string, std::string>>;

static std::string VisualTrim(const std::string& text) {
    const auto first = text.find_first_not_of(" \t\r\n");
    return first == std::string::npos ? "" : text.substr(first, text.find_last_not_of(" \t\r\n") - first + 1);
}

static TypeId VisualType(const std::string& name) {
    TypeId tid;
    if (!TypeId::LookupByNameFailSafe(name, &tid) || !tid.HasConstructor()) {
        throw std::runtime_error("Unregistered or non-constructible TypeId: " + name);
    }
    return tid;
}

static ObjectFactory VisualFactory(const std::string&, const VisualAttributes&, unsigned = 0);

// Parse the public ObjectFactory text syntax before construction. In ns-3's
// PointerValue parser an unknown TypeId otherwise terminates the process.
static Ptr<AttributeValue> VisualPointer(const std::string& text, const PointerChecker& checker, unsigned depth) {
    const std::string value = VisualTrim(text);
    if (value == "0") return Create<PointerValue>();
    const auto bracket = value.find('[');
    const std::string type = VisualTrim(value.substr(0, bracket));
    const TypeId tid = VisualType(type);
    const TypeId expected = checker.GetPointeeTypeId();
    if (tid != expected && !tid.IsChildOf(expected)) {
        throw std::runtime_error(type + " does not implement " + expected.GetName());
    }
    VisualAttributes attributes;
    if (bracket != std::string::npos) {
        if (value.back() != ']') throw std::runtime_error("Unclosed ObjectFactory attribute list");
        const auto body = value.substr(bracket + 1, value.size() - bracket - 2);
        std::size_t begin = 0;
        int nesting = 0;
        for (std::size_t i = 0; i <= body.size(); ++i) {
            if (i < body.size()) {
                if (body[i] == '[') ++nesting;
                if (body[i] == ']') --nesting;
                if (nesting < 0) throw std::runtime_error("Invalid ObjectFactory brackets");
            }
            if (i == body.size() || (body[i] == '|' && nesting == 0)) {
                const auto entry = body.substr(begin, i - begin);
                if (!entry.empty()) {
                    const auto equals = entry.find('=');
                    if (equals == std::string::npos) throw std::runtime_error("ObjectFactory attributes require name=value");
                    attributes.emplace_back(VisualTrim(entry.substr(0, equals)), entry.substr(equals + 1));
                }
                begin = i + 1;
            }
        }
        if (nesting != 0) throw std::runtime_error("Invalid ObjectFactory brackets");
    }
    return Create<PointerValue>(VisualFactory(type, attributes, depth + 1).Create<Object>());
}

static ObjectFactory VisualFactory(const std::string& type, const VisualAttributes& attributes, unsigned depth) {
    if (depth > 32) throw std::runtime_error("ObjectFactory nesting exceeds 32 levels");
    const TypeId tid = VisualType(type);
    ObjectFactory factory;
    factory.SetTypeId(tid);
    for (const auto& [name, text] : attributes) {
        TypeId::AttributeInformation info;
        if (!tid.LookupAttributeByName(name, &info) || !(info.flags & TypeId::ATTR_CONSTRUCT)) {
            throw std::runtime_error(type + "." + name + " is not a constructible attribute");
        }
        Ptr<AttributeValue> value;
        try {
            if (auto pointer = dynamic_cast<const PointerChecker*>(PeekPointer(info.checker))) {
                value = VisualPointer(text, *pointer, depth);
                if (!info.checker->Check(*value)) value = nullptr;
            } else {
                value = info.checker->CreateValidValue(StringValue(text));
            }
        } catch (const std::exception& error) {
            throw std::runtime_error(type + "." + name + " = " + text + ": " + error.what());
        }
        if (!value) {
            const auto constraint = info.checker->HasUnderlyingTypeInformation()
                ? info.checker->GetUnderlyingTypeInformation() : info.checker->GetValueTypeName();
            throw std::runtime_error("Invalid attribute " + type + "." + name + " = " + text + " (expected " + constraint + ")");
        }
        factory.Set(name, *value);
    }
    return factory;
}

static ObjectFactory VisualNodeFactory(const std::string& type, const VisualAttributes& attributes, uint32_t nodeId) {
    try { return VisualFactory(type, attributes); }
    catch (const std::exception& error) {
        throw std::runtime_error("Node " + std::to_string(nodeId) + ": " + error.what());
    }
}

static Ptr<MobilityModel> VisualCreateMobility(const std::string& type, const VisualAttributes& attributes,
                                             uint32_t nodeId, const Vector& position) {
    const TypeId tid = VisualType(type);
    if (!tid.IsChildOf(MobilityModel::GetTypeId())) {
        throw std::runtime_error("Node " + std::to_string(nodeId) + ": " + type + " does not implement ns3::MobilityModel");
    }
    for (const auto& attribute : attributes) {
        if (attribute.first == "Position") {
            throw std::runtime_error("Node " + std::to_string(nodeId) + ": mobility Position is managed by node coordinates");
        }
    }
    auto model = VisualNodeFactory(type, attributes, nodeId).Create<MobilityModel>();
    model->SetPosition(position);
    return model;
}

class AquaVisualSocket : public AquaSimSocket {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualSocket")
            .SetParent<AquaSimSocket>().AddConstructor<AquaVisualSocket>();
        return tid;
    }
    int Bind() override {
        const int result = AquaSimSocket::Bind();
        if (result == 0) m_bound = true;
        return result;
    }
    int Bind(const Address& address) override {
        const int result = AquaSimSocket::Bind(address);
        if (result == 0) m_bound = true;
        return result;
    }
    int Bind6() override { return Bind(); }
    int Connect(const Address& address) override {
        if (!m_bound && Bind() != 0) return -1;
        return AquaSimSocket::Connect(address);
    }
    int Close() override { m_bound = false; return AquaSimSocket::Close(); }
private:
    bool m_bound = false;
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualSocket);

class AquaVisualSocketFactory : public SocketFactory {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualSocketFactory")
            .SetParent<SocketFactory>().AddConstructor<AquaVisualSocketFactory>();
        return tid;
    }
    Ptr<Socket> CreateSocket() override {
        auto socket = CreateObject<AquaVisualSocket>();
        socket->SetNode(GetObject<Node>());
        return socket;
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualSocketFactory);
`,$r=String.raw`
#include "ns3/default-simulator-impl.h"
#include "ns3/event-id.h"
#include <stdexcept>

class AquaVisualGuardedSimulator : public DefaultSimulatorImpl {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualGuardedSimulator")
            .SetParent<DefaultSimulatorImpl>().AddConstructor<AquaVisualGuardedSimulator>();
        return tid;
    }
    void PreEventHook(const EventId& event) override {
        const auto timestamp = event.GetTs();
        if (!m_count || timestamp != m_timestamp) {
            m_timestamp = timestamp;
            m_count = 0;
        }
        if (++m_count > MAX_EVENTS_AT_ONE_TIME) {
            m_stalled = true;
            // Stop through the normal simulator path. Throwing inside this hook
            // would interrupt DefaultSimulatorImpl's event ownership/accounting.
            Stop();
        }
    }
    void CheckProgress() const {
        if (m_stalled) throw std::runtime_error(
            "仿真时间未推进：在同一时刻 (" + std::to_string(m_timestamp)
            + " 个时钟步) 连续处理超过 " + std::to_string(MAX_EVENTS_AT_ONE_TIME)
            + " 个事件，已停止本次运行。请检查零间隔的循环事件；重复产包间隔应大于 0，首包启动时间与产包间隔是不同设置。");
    }
private:
    static constexpr uint64_t MAX_EVENTS_AT_ONE_TIME = 100000;
    uint64_t m_timestamp = 0;
    uint64_t m_count = 0;
    bool m_stalled = false;
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualGuardedSimulator);
`,ei=String.raw`
#include <algorithm>
#include <limits>
#include <map>

struct VisualMovement {
    uint32_t nodeId;
    int64_t startNs, endNs;
    Vector from, to;
};
struct VisualMobilityTrack {
    Ptr<MobilityModel> model;
    int64_t timeNs;
    Vector position;
    size_t mergeIndex = std::numeric_limits<size_t>::max();
};
static std::vector<VisualMovement> visualMovements;
static std::map<uint32_t, VisualMobilityTrack> visualMobilityTracks;
static bool visualMobilityRecording = false;
static Time visualMobilitySampleInterval;
static Time visualMobilityStop;
static EventId visualMobilitySampleEvent;

static bool VisualFinitePosition(const Vector& point) {
    return std::isfinite(point.x) && std::isfinite(point.y) && std::isfinite(point.z);
}
static bool VisualSamePosition(const Vector& a, const Vector& b) {
    return a.x == b.x && a.y == b.y && a.z == b.z;
}
static bool VisualSameVelocity(const Vector& a, const Vector& b) {
    const auto equal = [](double x, double y) {
        return std::abs(x - y) <= 1e-9 * std::max({1.0, std::abs(x), std::abs(y)});
    };
    return equal(a.x, b.x) && equal(a.y, b.y) && equal(a.z, b.z);
}
static void VisualCaptureMobility(uint32_t id, bool courseChange) {
    if (!visualMobilityRecording) return;
    auto& track = visualMobilityTracks.at(id);
    const auto now = Simulator::Now().GetNanoSeconds();
    const Vector position = track.model->GetPosition();
    if (!VisualFinitePosition(position)) {
        throw std::runtime_error("Node " + std::to_string(id) + ": mobility produced non-finite coordinates");
    }
    if (!VisualSamePosition(track.position, position)) {
        bool merged = false;
        if (now > track.timeNs && track.mergeIndex < visualMovements.size()) {
            auto& previous = visualMovements[track.mergeIndex];
            if (previous.endNs == track.timeNs && previous.endNs > previous.startNs) {
                const Vector before = (previous.to - previous.from) * (1e9 / (previous.endNs - previous.startNs));
                const Vector after = (position - track.position) * (1e9 / (now - track.timeNs));
                if (VisualSameVelocity(before, after)) {
                    previous.endNs = now;
                    previous.to = position;
                    merged = true;
                }
            }
        }
        if (!merged) {
            if (visualMovements.size() >= ${le}) {
                throw std::runtime_error("Mobility trace exceeds ${le} movement segments; shorten the experiment or reduce course changes");
            }
            track.mergeIndex = visualMovements.size();
            visualMovements.push_back({id, track.timeNs, now, track.position, position});
        }
    } else if (now > track.timeNs) {
        // Do not interpolate through a stationary interval as though it moved.
        track.mergeIndex = std::numeric_limits<size_t>::max();
    }
    track.timeNs = now;
    track.position = position;
    // Preserve the exact public course-change boundary after this observation.
    if (courseChange) track.mergeIndex = std::numeric_limits<size_t>::max();
}
static void VisualMobilityCourseChanged(uint32_t id, Ptr<const MobilityModel>) {
    VisualCaptureMobility(id, true);
}
static void VisualSampleMobility() {
    if (!visualMobilityRecording) return;
    for (const auto& entry : visualMobilityTracks) VisualCaptureMobility(entry.first, false);
    if (visualMobilityStop - Simulator::Now() > visualMobilitySampleInterval) {
        visualMobilitySampleEvent = Simulator::Schedule(visualMobilitySampleInterval, &VisualSampleMobility);
    }
}
static void VisualStartMobilityTrace(const NodeContainer& nodes, const std::vector<uint16_t>& addresses,
                                     Time sampleInterval, Time stop) {
    visualMobilitySampleInterval = sampleInterval;
    visualMobilityStop = stop;
    for (uint32_t i = 0; i < nodes.GetN(); ++i) {
        auto model = nodes.Get(i)->GetObject<MobilityModel>();
        const Vector position = model->GetPosition();
        if (!VisualFinitePosition(position)) throw std::runtime_error("Invalid initial mobility position");
        visualMobilityTracks.emplace(addresses[i], VisualMobilityTrack{model, Simulator::Now().GetNanoSeconds(), position});
        if (!VisualConnectTrace(model, "CourseChange", "ns3::MobilityModel::TracedCallback",
                MakeBoundCallback(&VisualMobilityCourseChanged, uint32_t(addresses[i])))) {
            throw std::runtime_error("MobilityModel CourseChange trace interface is unavailable");
        }
    }
    visualMobilityRecording = true;
    if (stop - Simulator::Now() > sampleInterval) {
        visualMobilitySampleEvent = Simulator::Schedule(sampleInterval, &VisualSampleMobility);
    }
}
static void VisualFinishMobilityTrace() {
    for (const auto& entry : visualMobilityTracks) VisualCaptureMobility(entry.first, false);
    visualMobilityRecording = false;
    visualMobilitySampleEvent.Cancel();
}
static void WriteVisualMovements(std::ostream& output) {
    const auto previousPrecision = output.precision(17);
    output << ",\"movements\":[";
    for (size_t i = 0; i < visualMovements.size(); ++i) {
        if (i) output << ',';
        const auto& movement = visualMovements[i];
        output << "{\"node_id\":" << movement.nodeId
            << ",\"start_us\":" << movement.startNs / 1000.0 << ",\"end_us\":" << movement.endNs / 1000.0
            << ",\"from_x\":" << movement.from.x << ",\"from_y\":" << movement.from.y << ",\"from_z\":" << movement.from.z
            << ",\"to_x\":" << movement.to.x << ",\"to_y\":" << movement.to.y << ",\"to_z\":" << movement.to.z << '}';
    }
    output << ']';
    output.precision(previousPrecision);
}
`,ti={phyId:`ns3::AquaSimPhyFDM`,macId:`ns3::AquaSimSwarm`,routingId:`ns3::AquaSimStaticRouting`,channelId:`ns3::AquaSimChannel`,propagationId:`ns3::AquaSimRangePropagation`},ni={phy:{"phy-fdm":`ns3::AquaSimPhyFDM`,"phy-cmn":`ns3::AquaSimPhyCmn`,"phy-radio":`ns3::AquaSimRadioPhy`},mac:{swarm:`ns3::AquaSimSwarm`,tdma:`ns3::AquaSimTDMA`,broadcast:`ns3::AquaSimBroadcastMac`,aloha:`ns3::AquaSimPAloha`},routing:{static:`ns3::AquaSimStaticRouting`},app:{none:``,onoff:`ns3::OnOffNDApplication`,"traffic-gen":`ns3::AquaSimTrafficGen`},channel:{channel:`ns3::AquaSimChannel`,range:`ns3::AquaSimRangePropagation`,simple:`ns3::AquaSimSimplePropagation`,bellhop:`ns3::AquaSimBellhopPropagation`,"radio-channel":`ns3::AquaSimRadioChannel`,"radio-propagation":`ns3::AquaSimRadioPropagation`}},ri=new Set([`ns3::AquaSimRadioPhy`,`ns3::AquaSimRadioChannel`,`ns3::AquaSimRadioPropagation`]),X=(e,t,n)=>Un(e,t,n)?.typeId??ni[e]?.[t]??t,ii=(e,t)=>{if(!e||typeof e!=`object`||Array.isArray(e))throw Error(`${t} 必须是对象`);return e},ai=(e,t)=>{if(typeof e!=`string`)throw Error(`${t} 必须是字符串`);return e},oi=(e,t)=>{if(![`string`,`number`,`boolean`].includes(typeof e))throw Error(`属性 ${t} 必须是标量`);return String(e)},si=(e,t)=>{let n={...e};for(let[e,r]of Object.entries(t))n[e]={...n[e],...r};return n},ci=(e,t)=>{if(e===void 0)return{};let n={};for(let[r,i]of Object.entries(ii(e,`environmentStacks`))){if(r!==`acoustic`&&r!==`radio`)throw Error(`不支持的传播环境`);let e=ii(i,`${r} 环境配置`),a=X(`phy`,ai(e.phyId,`环境 phyId`),t);ai(e.channelId,`环境 channelId`),ai(e.propagationId,`环境 propagationId`),e.transRange!==void 0&&(n[a]={transRange:oi(e.transRange,`transRange`)})}return n},li=(e,t,n)=>{let r=(e,n)=>oi(t[e]===void 0?n:t[e],e),i=r(`transRange`,1200),a={},o=new Set([...Object.values(ni.phy),...(n.find(e=>e.id===`phy`)?.items||[]).filter(e=>e.attributes?.some(e=>e.name===`transRange`)).map(e=>e.typeId)]),s=(e,t)=>{for(let n of o)t&&(ri.has(n)?`radio`:`acoustic`)!==t||(a[n]={...a[n],transRange:e})};if(s(i),t.environmentStacks!==void 0)for(let[e,r]of Object.entries(ii(t.environmentStacks,`environmentStacks`))){if(e!==`acoustic`&&e!==`radio`)throw Error(`不支持的传播环境`);let t=ii(r,`${e} 环境配置`),i=X(`phy`,ai(t.phyId,`环境 phyId`),n);if(ai(t.channelId,`环境 channelId`),ai(t.propagationId,`环境 propagationId`),t.transRange!==void 0){let n=oi(t.transRange,`transRange`);s(n,e),a[i]={...a[i],transRange:n}}}let c=X(`phy`,e.phyId,n);s(i,[c,X(`channel`,e.channelId,n),X(`channel`,e.propagationId,n)].some(e=>ri.has(e))?`radio`:`acoustic`),t.transRange!==void 0&&(a[c]={...a[c],transRange:i}),a[`ns3::AquaSimTDMA`]={SlotNum:r(`slotNum`,4),SlotLen:r(`slotLen`,`5s`)};for(let e of[`ns3::AquaSimSwarm`,`ns3::AquaSimSwarM`])a[e]={InitialRoundDelay:r(`initialRoundDelay`,`1s`)};return si(a,e.protocolAttributes||{})},ui=(e,t)=>{let n=(e,t)=>{if(typeof e!=`number`||!Number.isFinite(e))throw Error(`${t} 必须是有效数字`);return e},r={trafficId:`none`,trafficSrc:1,trafficDst:2,trafficRateBps:80,trafficPkt:50,trafficStart:`5s`,trafficStop:`100s`},i=ii(e,`traffic`),a=ai(i.preset,`traffic.preset`);if(![`none`,`periodic`,`onoff-to`].includes(a))throw Error(`不支持的流量模式`);let o={...r,trafficId:a};if(a!==`none`&&(o={...o,trafficSrc:n(i.src,`traffic.src`),trafficDst:n(i.dst,`traffic.dst`),trafficRateBps:n(i.rate_bps,`traffic.rate_bps`),trafficPkt:n(i.pkt,`traffic.pkt`),trafficStart:ai(i.start,`traffic.start`),trafficStop:ai(i.stop,`traffic.stop`)}),t){o={...r};for(let e of[`trafficId`,`trafficStart`,`trafficStop`])t[e]!==void 0&&(o[e]=ai(t[e],e));for(let e of[`trafficSrc`,`trafficDst`,`trafficRateBps`,`trafficPkt`])t[e]!==void 0&&(o[e]=n(t[e],e));if(![`none`,`periodic`,`onoff-to`].includes(o.trafficId))throw Error(`不支持的流量模式`)}return o},di=(e,t,n,r,i)=>e===`ns3::AquaSimTrafficGen`?{Delay:String(n*8/t),PacketSize:String(n)}:e===`ns3::OnOffNDApplication`?{DataRate:`${t}bps`,PacketSize:String(n),Nsend:String(r),traffic:String(t/(n*8)),mode:i?`0`:`1`,OffTime:`ns3::ConstantRandomVariable[Constant=0]`}:{},fi=(e,t,n)=>{let r=e.trafficId!==`none`;if(r&&!t.some(t=>t.node_id===e.trafficSrc))throw Error(`流量源不在拓扑中`);let i=Math.max(1,Math.round(r?e.trafficRateBps:80)),a=Math.max(1,Math.round(r?e.trafficPkt:50));return t.map(o=>{let s=X(`app`,o.appId||`none`,n)||(r&&o.node_id===e.trafficSrc?`ns3::OnOffNDApplication`:``);return s?{...o,appId:s,appDestination:o.appDestination??(r?e.trafficDst:t[t.length-1]?.node_id),appAttrs:{...di(s,i,a,t.length,r&&e.trafficId===`periodic`),StartTime:r?e.trafficStart:`1s`,StopTime:r?e.trafficStop:e.simStop,...e.protocolAttributes?.[s],...o.appAttrs}}:o})},pi=e=>{let t=e.traffic;if(!t||t.preset===`none`||!(`src`in t))return e;if(!e.nodes.some(e=>e.id===Number(t.src)))throw Error(`流量源不在拓扑中`);let n=Math.max(1,Math.round(Number(t.rate_bps)||80)),r=Math.max(1,Math.round(Number(t.pkt)||50));return{...e,traffic:{preset:`none`},nodes:e.nodes.map(i=>{let a=i.app||(i.id===Number(t.src)?`ns3::OnOffNDApplication`:``);return a?{...i,app:a,appDestination:i.appDestination??Number(t.dst),appAttrs:{...di(a,n,r,e.nodes.length,t.preset===`periodic`),StartTime:t.start||`1s`,StopTime:t.stop||e.simStop,...e.protocolAttributes?.[a],...i.appAttrs}}:i})}},mi=e=>Number(e)||0,Z=e=>JSON.stringify(e),hi=(e,t=Y,n=`net.aqua-visual.json`)=>{let r=pi(e),i=Array.isArray(r?.nodes)?r.nodes:[],a=[...Or(i,2),...Lr(r,t),...Pr(r,t)];if(a.length)throw Error(a.join(`；`));let o=(e,n,r=!1)=>{let i=t.find(t=>t.id===e)?.items.find(t=>t.typeId===n&&(e!==`channel`||t.field===`propagationId`===r));if(!i)throw Error(`${e} 未注册协议：${n}，请先预编译`);return i},s=o(`phy`,r.stack.phy.type),c=o(`mac`,r.stack.mac.type),l=o(`routing`,r.stack.routing.type),u=o(`channel`,r.channel.type),d=o(`channel`,r.channel.propagation,!0),f=r.protocolAttributes||{},p=(e,t)=>`{${Object.entries(br(t)).map(([t,n])=>{let r=e.attributes?.find(e=>e.name===t),i=r?xr(r,n):String(n);return`{${Z(t)}, ${Z(i)}}`}).join(`, `)}}`,m=(e,t)=>`VisualFactory(${Z(e.typeId)}, ${p(e,t)})`,h=[s,c,l].map((e,t)=>`    const std::vector<VisualAttributes> node${[`Phy`,`Mac`,`Routing`][t]}Attributes = {
${i.map(n=>`        ${p(e,Tr(r,n)[t].attributes)}`).join(`,
`)}
    };`).join(`
`),g=jr(r.simStop,`仿真时长 simStop`),_=g.literal,v=i.map((e,t)=>{let n=e.mobility?o(`mobility`,e.mobility.type):null,r=n?.typeId||`ns3::ConstantPositionMobilityModel`,i=n?p(n,e.protocolAttributes?.[n.typeId]||{}):`{}`;return`    nodesCon.Get(${t})->AggregateObject(VisualCreateMobility(${Z(r)}, ${i}, ${e.id}, Vector(${mi(e.x)}, ${mi(e.y)}, ${mi(e.z)})));`}).join(`
`),y=i.map((e,t)=>{if(!e.app)return``;let n=o(`app`,e.app),r=Fr(n);return`    {
        auto factory = ${m(n,e.appAttrs||{})};
${r?`        AquaSimSocketAddress remote;
        remote.SetAllDevices();
        remote.SetDestinationAddress(AquaSimAddress(${e.appDestination}));
        remote.SetProtocol(0);
        factory.Set("Protocol", TypeIdValue(AquaVisualSocketFactory::GetTypeId()));
        factory.Set("Remote", AddressValue(remote));
`:``}        nodesCon.Get(${t})->AddApplication(factory.Create<Application>());
    }`}).join(`
`),b=JSON.stringify({meta:{schema:`uan-vis-packet-log/v2`,time_unit:`us`,time_precision_us:.001,sim_end_us:Math.round(g.seconds*1e6),distance_unit:`m`,protocols:{phy:[s.typeId],mac:[c.typeId],routing:[l.typeId],channel:[u.typeId]}}}).slice(0,-2),x=JSON.stringify(i.map(e=>({node_id:e.id,name:e.name||`Node-${e.id}`,x:mi(e.x),y:mi(e.y),z:mi(e.z),role:e.role||`node`,...e.modelType===void 0?{}:{modelType:e.modelType},...e.mobility===void 0?{}:{mobility:{type:e.mobility.type},protocolAttributes:{[e.mobility.type]:e.protocolAttributes?.[e.mobility.type]||{}}}})));return`/** Generated by Aquasim Visual. */
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/core-module.h"
#include "ns3/mobility-module.h"
#include "ns3/network-module.h"
#include <cmath>
#include <iomanip>
#include <iostream>
#include <fstream>
#include <vector>
using namespace ns3;
${Zr}
${Qr}
${Gr}
${ei}
${$r}
int main(int argc, char* argv[]) {
    try {
    CommandLine cmd; cmd.Parse(argc, argv);
    auto progressGuard = CreateObject<AquaVisualGuardedSimulator>();
    Simulator::SetImplementation(progressGuard);
    const Time simStop(${Z(_)});
    auto channelFactory = ${m(u,f[u.typeId]||{})};
    auto propagationFactory = ${m(d,f[d.typeId]||{})};
    auto sharedChannel = channelFactory.Create<AquaSimChannel>();
    sharedChannel->SetPropagation(propagationFactory.Create<AquaSimPropagation>());
    if (!sharedChannel->GetNoiseGen()) sharedChannel->SetNoiseGenerator(CreateObject<AquaSimConstNoiseGen>());
    // Query the selected propagation interface; never infer speed from a model name.
    double propagationSpeed = 0;
    PointerValue propagationValue;
    if (sharedChannel->GetAttributeFailSafe("SetProp", propagationValue)) {
        auto model = propagationValue.Get<AquaSimPropagation>();
        if (model) {
            auto from = CreateObject<ConstantPositionMobilityModel>();
            auto to = CreateObject<ConstantPositionMobilityModel>();
            to->SetPosition(Vector(1000, 0, 0));
            const double delay = model->PDelay(from, to).GetSeconds();
            if (std::isfinite(delay) && delay > 0) propagationSpeed = 1000 / delay;
        }
    }
    NodeContainer nodesCon; nodesCon.Create(${i.length});
${v}
    NetDeviceContainer devices;
    const std::vector<uint16_t> nodeAddresses = {${i.map(e=>e.id).join(`, `)}};
${h}
    for (uint32_t i = 0; i < nodesCon.GetN(); ++i) {
        auto node = nodesCon.Get(i);
        // A fresh factory per node also gives nested PointerValue objects their own ownership.
        auto phyFactory = VisualNodeFactory(${Z(s.typeId)}, nodePhyAttributes[i], nodeAddresses[i]);
        auto macFactory = VisualNodeFactory(${Z(c.typeId)}, nodeMacAttributes[i], nodeAddresses[i]);
        auto routingFactory = VisualNodeFactory(${Z(l.typeId)}, nodeRoutingAttributes[i], nodeAddresses[i]);
        auto device = CreateObject<AquaSimNetDevice>();
        node->AddDevice(device);
        auto phy = phyFactory.Create<AquaSimPhy>();
        auto signalCache = phy->GetSignalCache();
        if (!signalCache) signalCache = CreateObject<AquaVisualSignalCacheRange>();
        phy->SetSignalCache(signalCache);
        phy->SetSinrChecker(CreateObject<AquaSimThresholdSinrChecker>());
        device->SetPhy(phy);
        device->SetChannel(sharedChannel);
        device->SetEnergyModel(CreateObject<AquaSimEnergyModel>());
        device->SetMac(macFactory.Create<AquaSimMac>());
        device->SetRouting(routingFactory.Create<AquaSimRouting>());
        devices.Add(device);
    }
${i.map((e,t)=>`    devices.Get(${t})->SetAddress(AquaSimAddress(${e.id}));`).join(`
`)}
    for (uint32_t i = 0; i < devices.GetN(); ++i) {
        auto device = DynamicCast<AquaSimNetDevice>(devices.Get(i));
        auto id = AquaSimAddress::ConvertFrom(device->GetAddress()).GetAsInt();
        device->GetPhy()->TraceConnectWithoutContext("Tx", MakeBoundCallback(&VisualTxTrace, uint32_t(id), device->GetPhy()));
        VisualConnectReceptionEvents(uint32_t(id), device->GetPhy());
        // Optional common interface: on-air completion may precede MAC delivery.
        if (device->GetPhy()->TraceConnectWithoutContext("RxComplete", MakeBoundCallback(&VisualRxTrace, uint32_t(id)))) {
            device->GetPhy()->TraceConnectWithoutContext("Rx", MakeBoundCallback(&VisualRxDeliveryTrace, uint32_t(id)));
        } else {
            device->GetPhy()->TraceConnectWithoutContext("Rx", MakeBoundCallback(&VisualRxTrace, uint32_t(id)));
        }
    }
    AquaSimSocketHelper socketHelper; socketHelper.Install(nodesCon);
    for (auto node : nodesCon) node->AggregateObject(CreateObject<AquaVisualSocketFactory>());
${y}
    // Bound periodic observations to about 20k samples across all nodes; exact
    // CourseChange events remain separately observed and collinear runs merge.
    const Time mobilitySampleInterval = Seconds(std::max(0.1, simStop.GetSeconds() * nodesCon.GetN() / 20000.0));
    VisualStartMobilityTrace(nodesCon, nodeAddresses, mobilitySampleInterval, simStop);
    std::cout << "Running ${c.typeId} / ${s.typeId} / ${d.typeId}\\n";
    Simulator::Stop(simStop);
    Simulator::Run();
    VisualFinishMobilityTrace();
    Simulator::Destroy();
    progressGuard->CheckProgress();
    std::ofstream replay(${Z(n)});
    replay << ${Z(b)};
    replay << ',' << char(34) << "mobility_sample_interval_us" << char(34) << ':'
           << std::setprecision(17) << mobilitySampleInterval.GetNanoSeconds() / 1000.0;
    replay << ",\\"trace_scope\\":\\"" << (visualReceiveEvents ? "phy-events" : "phy-success") << char(34);
    if (std::isfinite(propagationSpeed) && propagationSpeed > 0)
        replay << ",\\"propagation_speed_mps\\":" << std::setprecision(17) << propagationSpeed;
    replay << "},\\"nodes\\":" << ${Z(x)};
    WriteVisualMovements(replay);
    WriteVisualPackets(replay);
    std::cout << "fin.\\n";
    return 0;
    } catch (const std::exception& error) {
        std::cerr << "Simulation error: " << error.what() << '\\n';
        return 1;
    }
}
`},gi=(e,t,n)=>{let r=Un(`phy`,e.phyId,t),i=r?.attributes?.find(e=>e.name===`transRange`);if(!r||!i)return null;let a=br(n?.protocolAttributes?.[r.typeId]||{})[i.name]??br(e.protocolAttributes?.[r.typeId]||{})[i.name]??i.defaultValue;try{let e=Number(xr(i,a));return Number.isFinite(e)&&e>0?e:null}catch{return null}},_i=()=>({nodes:x([]),form:x(zr()),selectedIds:x([]),activeCatalogId:x(``),canvas:x()}),vi=_i(),yi=_i(),bi=e=>({node_id:Number(e.node_id),name:e.name||`Node-${e.node_id}`,x:Number(e.x)||0,y:Number(e.y)||0,z:Number(e.z)||0,role:e.role||`node`,...e.modelType===void 0?{}:{modelType:e.modelType},...e.mobility===void 0?{}:{mobility:{...e.mobility}},phyId:e.phyId||``,macId:e.macId||``,routingId:e.routingId||``,appId:e.appId||`none`,appAttrs:{...e.appAttrs},appDestination:e.appDestination,...e.protocolAttributes===void 0?{}:{protocolAttributes:Object.fromEntries(Object.entries(e.protocolAttributes).map(([e,t])=>[e,{...t}]))}}),xi=(e,t)=>e.map(e=>bi({...e,phyId:t.phyId,macId:t.macId,routingId:t.routingId})),Si=e=>Math.round((Number(e)||0)*100)/100,Ci=(e,t=vi)=>{let{nodes:n,selectedIds:r,form:i,activeCatalogId:a,canvas:o}=t,s=x(``),c=e=>o.value?.lockedNodeIds?.includes(Number(e))??!1,l=L(()=>n.value.length<64),u=L(()=>n.value.filter(e=>r.value.includes(Number(e.node_id)))),d=L(()=>u.value.length===1?u.value[0]:null),f=L(()=>i.value.macId),p=L(()=>u.value.length?`已选 ${u.value.length} 个节点`:`未选中节点`),m=L(()=>n.value.map(e=>({...e,macId:i.value.macId,phyId:i.value.phyId,routingId:i.value.routingId}))),h=L(()=>m.value.map(t=>({...t,mode:`idle`,fillProgress:0,fade:1,statusText:Un(`mac`,i.value.macId,e.value)?.label||i.value.macId,packetId:null}))),g=(t,n)=>{let r=Un(t,n,e.value);return{name:r?.label||(n?`${n}（待校验）`:`未选择`),typeId:(r?.typeId||n||`—`).replace(/^ns3::/,``),source:r?.source||``}},_=L(()=>{let e=i.value,t=g(`channel`,e.channelId),n=g(`channel`,e.propagationId);return[{key:`routing`,layer:`路由`,...g(`routing`,e.routingId)},{key:`mac`,layer:`MAC`,...g(`mac`,e.macId)},{key:`phy`,layer:`物理层`,...g(`phy`,e.phyId)},{key:`channel`,layer:`信道`,name:`${t.name} · ${n.name}`,typeId:`${t.typeId} · ${n.typeId}`,source:[t.source,n.source].filter(Boolean).join(`
`)}]}),v=L(()=>_.value.filter(e=>e.key!==`app`&&e.key!==`channel`).map(e=>e.name).join(` · `)),y=e=>{r.value=(e||[]).map(e=>Number(e))},b=e=>{if(!e){r.value=[];return}let t=Number(e.node_id);r.value.includes(t)||(r.value=[t])},S=e=>{if(!Array.isArray(e)||!e.length)return;let t=new Map(e.map(e=>[Number(e.node_id),e]));n.value=n.value.map(e=>{let n=t.get(Number(e.node_id));return!n||c(e.node_id)?e:{...e,x:Si(n.x),y:Si(n.y)}})},C=e=>{!e||!Number.isFinite(Number(e.node_id))||r.value.length>1||c(e.node_id)||(n.value=n.value.map(t=>t.node_id===e.node_id?{...t,x:Si(e.x),y:Si(e.y)}:t))},w=({node_id:e,axis:t,value:r})=>{![`x`,`y`,`z`].includes(t)||!Number.isFinite(r)||c(e)||(n.value=n.value.map(n=>n.node_id===e?{...n,[t]:Si(r)}:n))},T=e=>{if(!l.value)return s.value=`最多支持 64 个节点`,!1;let t=kr(n.value.map(e=>e.node_id));if(t===null)return s.value=`没有可用的节点编号`,!1;let a=n.value.map(e=>Number(e.x)||0),o=n.value.map(e=>Number(e.y)||0),c=n.value.map(e=>Number(e.z)||0),u=a.length>=2?Math.max(400,(Math.max(...a)-Math.min(...a))/Math.max(a.length-1,1)):1e3,f=e&&typeof e==`object`&&!(`target`in e)&&Number.isFinite(Number(e.x))&&Number.isFinite(Number(e.y)),p=f?Number(e.x):a.length?Math.max(...a)+u:0,m=f?Number(e.y):o.length?o.reduce((e,t)=>e+t,0)/o.length:0,h=f&&e?.z!==void 0&&e.z!==``&&Number.isFinite(Number(e.z))?Number(e.z):c.length?c.reduce((e,t)=>e+t,0)/c.length:0,g=d.value||n.value[0];return n.value=[...n.value,{node_id:t,name:`Node-${t}`,x:Si(p),y:Si(m),z:Si(h),role:`node`,modelType:`auv`,phyId:i.value.phyId,macId:i.value.macId,routingId:i.value.routingId,appId:g?.appId||`none`}],r.value=[t],s.value=``,!0},E=()=>{if(!r.value.length)return;let e=new Set(r.value.map(Number));n.value=n.value.filter(t=>!e.has(Number(t.node_id))),r.value=[],s.value=``},D=(t,o=r.value)=>{if(!t)return;let s=t.layer||`mac`,c=t.id||t.macId;if(!c)return;let l=e.value.find(e=>e.id===s),u=Un(s,c,e.value),d=u?.field||l?.field;if(!(!u||!d)){if(a.value=`${s}:${c}`,d===`appId`){if(!o.length)return;let e=new Set(o.map(Number));n.value=n.value.map(t=>e.has(Number(t.node_id))?{...t,appId:c,appAttrs:{}}:t);return}l?.scope!==`node`&&(i.value={...i.value,[d]:c},l?.scope!==`scene`&&(n.value=n.value.map(e=>({...e,[d]:c}))))}};return{editNodes:n,canvas:o,canAddNode:l,topologyError:s,selectedIds:r,experimentForm:i,activeCatalogId:a,selectedNodes:u,selectedEditNode:d,selectedMacId:f,selectedSummary:p,canvasNodes:m,nodeVisuals:h,protocolStack:_,stackBrief:v,onSelectionChange:y,onNodeSelect:b,onNodesMove:S,onNodeMove:C,onNodeCoordinate:w,addNode:T,removeSelected:E,assignItem:D,onProtocolDrop:e=>{if(e?.nodeId!=null&&Number.isFinite(Number(e.nodeId))){let t=Number(e.nodeId),n=r.value.includes(t)&&r.value.length>1?r.value:[t];r.value.includes(t)||(r.value=[t]),D(e,n);return}D(e,r.value)},replaceTopology:e=>{let t=e.map(e=>bi(e)),i=Or(t.map(e=>({...e,id:e.node_id})));return i.length?(s.value=i.join(`；`),!1):(n.value=t,r.value=n.value[0]?[Number(n.value[0].node_id)]:[],s.value=``,!0)},setField:(e,t)=>{i.value={...i.value,[e]:t}},setProtocolAttribute:(e,t,r,a)=>{let o=(e={})=>{let n={...e};return r===``?delete n[t]:n[t]=r,n};if(a!==void 0)n.value=n.value.map(e=>e.node_id===a?{...e,appAttrs:o(e.appAttrs)}:e);else{let t=i.value.protocolAttributes||{};i.value={...i.value,protocolAttributes:{...t,[e]:o(t[e])}}}},setNodeDestination:(e,t)=>{n.value=n.value.map(n=>n.node_id===e?{...n,appDestination:t}:n)},onNodeRename:({node_id:e,name:t})=>{n.value=n.value.map(n=>n.node_id===e?{...n,name:ce(t,e)}:n)},onNodeModelChange:({node_id:e,modelType:t})=>{F(t)&&(n.value=n.value.map(n=>n.node_id===e?{...n,modelType:t}:n))},setNodeMobility:(e,t)=>{n.value=n.value.map(n=>{if(n.node_id!==e)return n;if(t)return{...n,mobility:{type:t}};let{mobility:r,...i}=n;return i})},setNodeProtocolAttribute:(e,t,i,a=r.value)=>{let o=new Set(a);n.value=n.value.map(n=>{if(!o.has(n.node_id))return n;let r={...n.protocolAttributes?.[e]};return i===``?delete r[t]:r[t]=i,{...n,protocolAttributes:{...n.protocolAttributes,[e]:r}}})}}},wi=async(e,t,n)=>{let r=await fetch(`/api/${e}`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify(t),signal:n});if(!r.headers.get(`content-type`)?.includes(`application/json`))throw Error(`仿真服务不可用，请启动 Go 服务或开发服务。`);let i=await r.json();if(!i||typeof i!=`object`||Array.isArray(i))throw Error(`仿真服务返回了无效响应`);return{ok:r.ok,status:r.status,data:i}},Ti=({getSpec:e,getAquaSimHome:t,onSuccess:n})=>{let r=x(`idle`),i=x(``),a=null,o=!1;return P(()=>{o=!0,a?.abort(),a=null}),{runStatus:r,runLog:i,runExperiment:async()=>{if(o||r.value===`running`)return;let s=new AbortController;a=s,r.value=`running`,i.value=``;try{let{ok:c,data:l}=await wi(`run`,{spec:e(),aquaSimHome:t().trim()},s.signal);if(a!==s||o)return;if(i.value=l.stdout||l.error||``,!c||l.ok===!1){r.value=`fail`;return}r.value=`ok`,l.log&&n(l.log,l.logName||`ns3.log`)}catch(e){if(s.signal.aborted||o)return;r.value=`fail`,i.value=String(e?.message||e)}finally{a===s&&(a=null)}}}},Ei=(e,t=``,n=`操作失败，请查看详情。`)=>{let r=e=>String(e??``).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g,``).replace(/^Error:\s*/,``).trim(),i=r(e instanceof Error?e.message:e),a=r(t),o=[i,a].filter(Boolean).join(`
`),s=i;/(?:PCH file|precompiled header)[\s\S]*?(?:different branch|different version|compiler version)/i.test(o)?s=`编译器版本已变化，旧预编译头不兼容。请清除构建后重新预编译。`:/^读取注册协议失败/.test(i)?s=`读取注册协议失败，请查看详情。`:(!i||i.length>180||/\n|-- (?:Using|Processing|Configuring)|CMake Error|\[\s*\d+%\]/.test(i))&&(s=n),s=s.replace(/请查看(?:编译)?输出/g,`请查看详情`);let c=i.length>180||i.includes(`
`),l=a&&c&&!a.includes(i)?[i,a].join(`

`):a||i;return{summary:s,details:l}},Di=1e4,Oi=3,ki=()=>({ready:null,startupPrecompileConsumed:!1}),Ai=ki(),ji=ki(),Mi=(e=Ai,t={})=>{let n=t.storageKey??B.aquaSimHome,r=x(``),i=x(Y),a=x(!1),o=x(``),s=x(``),c=x(!1),l=x(`idle`),u=x(``),d=x(``),f=x(null),p=x(`idle`),m=x(``),h=x(null),g=null,v=null,b=null,S=null,C=0,w=!1,T=!e.startupPrecompileConsumed,E=()=>{T=!1,e.startupPrecompileConsumed=!0},D=null,O=()=>{D&&clearInterval(D),D=null,b?.abort(),b=null},k=()=>{v?.abort(),v=null,O(),S?.(),S=null},A=async()=>{if(w||b||!v||l.value!==`building`)return;let e=v,t=f.value?.phase===`waiting`,n=new AbortController;b=n;let i=setTimeout(()=>n.abort(),Di);n.signal.addEventListener(`abort`,()=>clearTimeout(i),{once:!0});try{let{ok:i,data:a}=await wi(`simulator/build-progress`,{aquaSimHome:r.value.trim()},n.signal);if(!i)throw Error(`任务状态请求失败`);i&&v===e&&!n.signal.aborted&&(f.value?.phase===`waiting`?(C=0,t&&a.task===null&&(S?.(),S=null)):a.progress&&(f.value=a.progress))}catch{t&&v===e&&f.value?.phase===`waiting`&&(C+=1,C>=Oi&&(S?.(Error(`无法获取当前任务状态，请检查仿真服务后重新预编译。`)),S=null))}finally{clearTimeout(i),b===n&&(b=null)}};try{r.value=localStorage.getItem(n)||``}catch{s.value=`浏览器无法读取设置，本次仍可填写目录。`}let j=e.ready,M=!!j&&j.selection===r.value.trim();M?(i.value=j.catalog,a.value=!0,h.value=j.result,o.value=j.defaultHome,l.value=j.buildStatus,u.value=j.buildLog,f.value=j.buildProgress,E()):e.ready=null;let N=()=>{!a.value||w||(e.ready={selection:r.value.trim(),catalog:i.value,result:h.value?.ok?h.value:null,defaultHome:o.value,buildStatus:l.value===`ok`?`ok`:`idle`,buildLog:u.value,buildProgress:f.value})};y(r,t=>{e.ready=null,E(),g?.abort(),g=null,k(),c.value=!1,h.value=null,i.value=Y,a.value=!1,l.value=`idle`,u.value=``,d.value=``,f.value=null,p.value=`idle`,m.value=``;try{t.trim()?localStorage.setItem(n,t.trim()):localStorage.removeItem(n),s.value=``}catch{s.value=`浏览器无法保存设置，目录仅在当前页面生效。`}},{flush:`sync`});let P=async(t=!1)=>{if(t||E(),w)return;e.ready=null,g?.abort();let n=new AbortController;g=n,c.value=!0,h.value=null;try{let{ok:e,data:s}=await wi(`simulator/check`,{aquaSimHome:r.value.trim()},n.signal);g===n&&!n.signal.aborted&&!w&&(s.defaultHome&&(o.value=s.defaultHome),h.value={...s,ok:e&&s.ok},a.value=e&&s.ok&&!!s.catalog,i.value=a.value?s.catalog:Y,a.value&&s.buildReusable?(E(),l.value=`ok`,u.value=``,f.value={phase:`done`,completed:1,total:1},N()):t&&T&&e&&s.ok?ee():N())}catch(e){n.signal.aborted||(h.value={ok:!1,error:e instanceof Error?e.message:String(e)})}finally{g===n&&(c.value=!1,g=null)}},ee=async()=>{if(E(),w||l.value===`building`||p.value===`cleaning`)return;e.ready=null,g?.abort(),g=null,c.value=!1,k();let t=new AbortController;v=t,l.value=`building`,h.value&&={...h.value,buildReusable:!1},i.value=Y,a.value=!1,u.value=``,d.value=``,f.value={phase:`configure`,completed:0,total:0},p.value=`idle`,D=setInterval(()=>{A()},600),A();try{for(;v===t&&!t.signal.aborted;){let{ok:e,status:n,data:o}=await wi(`simulator/build`,{aquaSimHome:r.value.trim()},t.signal);if(v!==t||t.signal.aborted)return;if(n===409&&o.code===`SIMULATOR_BUSY`){if(f.value={phase:`waiting`,completed:0,total:0},C=0,b?.abort(),b=null,await new Promise((e,t)=>{S=n=>n?t(n):e(),A()}),v!==t||t.signal.aborted)return;f.value={phase:`configure`,completed:0,total:0};continue}if(u.value=o.stdout||``,!e||!o.ok)throw Error(o.error||`预编译失败，请查看编译输出`);if(!Array.isArray(o.catalog))throw Error(`预编译未返回注册协议目录，请重试。`);i.value=o.catalog,a.value=!0,l.value=`ok`,f.value={phase:`done`,completed:1,total:1},N();break}}catch(e){if(v!==t||t.signal.aborted)return;l.value=`fail`;let n=Ei(e,u.value,`预编译失败，请查看详情。`);d.value=n.summary,u.value=n.details}finally{v===t&&k()}};return _(()=>{M||P(t.autoBuild!==!1)}),z(()=>{w=!0,g?.abort(),g=null,k()}),{catalog:i,catalogReady:a,aquaSimHome:r,defaultHome:o,storageError:s,checking:c,result:h,precompile:ee,buildStatus:l,buildLog:u,buildError:d,buildProgress:f,clearBuild:async()=>{if(E(),w||l.value===`building`||p.value===`cleaning`)return;e.ready=null,g?.abort(),g=null,c.value=!1,k();let t=new AbortController;v=t,p.value=`cleaning`,m.value=``,u.value=``;try{let{ok:e,data:n}=await wi(`simulator/clean`,{aquaSimHome:r.value.trim()},t.signal);if(v!==t||t.signal.aborted)return;if(u.value=n.stdout||``,!e||!n.ok)throw Error(n.error||`清除构建失败`);i.value=Y,a.value=!1,l.value=`idle`,f.value=null,d.value=``,p.value=`ok`}catch(e){if(v!==t||t.signal.aborted)return;p.value=`fail`;let n=Ei(e,u.value,`清除构建失败，请查看详情。`);m.value=n.summary,u.value=n.details}finally{v===t&&k()}},cleanStatus:p,cleanError:m,resetDirectory:()=>{r.value=``,P()},selectDirectory:e=>{r.value=e,P()}}},Q=(e,t)=>{if(!e||typeof e!=`object`||Array.isArray(e))throw Error(`${t} 必须是对象`);return e},$=(e,t)=>{if(typeof e!=`string`)throw Error(`${t} 必须是字符串`);return e},Ni=(e,t)=>{if(typeof e!=`number`||!Number.isFinite(e))throw Error(`${t} 必须是有效数字`);return e},Pi=e=>Object.fromEntries(Object.entries(Q(e??{},`协议属性`)).map(([e,t])=>{if(![`string`,`number`,`boolean`].includes(typeof t))throw Error(`属性 ${e} 必须是标量`);return[e,String(t)]})),Fi=e=>Object.fromEntries(Object.entries(Q(e??{},`protocolAttributes`)).map(([e,t])=>[e,Pi(t)])),Ii=e=>Object.fromEntries(Object.entries(Q(e,`节点协议覆盖`)).map(([e,t])=>[e,Pi(Q(t,`节点 ${e} 的属性覆盖`))])),Li=(e,t=Y)=>JSON.stringify({...Ur(e.form,e.nodes,t),editor:{version:3,form:e.form,nodes:e.nodes,selectedIds:e.selectedIds,activeCatalogId:e.activeCatalogId,aquaSimHome:e.aquaSimHome,canvas:e.canvas}},null,2),Ri=(e,t=Y)=>{let n;try{n=JSON.parse(e.replace(/^\uFEFF/,``))}catch{throw Error(`JSON 格式错误，未修改当前实验`)}let r=Q(n,`实验文件`);if(r.schema!==`aqua-sim-experiment/v0`)throw Error(`不支持的实验格式，请导入 aqua-sim-experiment/v0 文件`);let i=r.editor===void 0?null:Q(r.editor,`editor`);if(i&&i.version!==1&&i.version!==2&&i.version!==3)throw Error(`不支持的编辑器文件版本`);let a=(e,n)=>{let r=$(n,`${e} TypeId`);if(!r)return e===`app`?`none`:``;let a=X(e,r,t);if(a!==r||Un(e,r,t))return a||`none`;if(i)return r;if(!/^ns3::[A-Za-z0-9_:]+$/.test(r))throw Error(`无效的 TypeId：${r}`);return r},o=Q(r.stack,`stack`),s=Q(o.phy,`phy`),c=Pi(s.attrs),l=Q(o.mac,`mac`),u=Pi(l.attrs),d=Q(o.routing,`routing`),f=Q(r.channel,`channel`),p={...zr(),simStop:$(r.simStop,`simStop`),phyId:a(`phy`,s.type),macId:a(`mac`,l.type),routingId:a(`routing`,d.type),channelId:a(`channel`,f.type),propagationId:a(`channel`,f.propagation),protocolAttributes:si({[X(`phy`,String(s.type),t)]:Object.fromEntries(Object.entries(c).filter(([e])=>e!==`txPower`)),[X(`mac`,String(l.type),t)]:u},Fi(r.protocolAttributes))};c.txPower!==void 0&&(p.txPower=Ni(Number(c.txPower),`txPower`));let m=ui(r.traffic);if(i){let e=Q(i.form,`editor.form`);m=ui(r.traffic,e);let n={...zr(),...i.version===3?{}:ti},a=Object.fromEntries(Object.entries(n).filter(([e])=>e!==`protocolAttributes`).map(([t,n])=>[t,e[t]===void 0?n:typeof n==`number`?Ni(e[t],t):$(e[t],t)]));p={...n,...a,protocolAttributes:Fi(e.protocolAttributes)};for(let[e,n]of[[`phyId`,`phy`],[`macId`,`mac`],[`routingId`,`routing`],[`channelId`,`channel`],[`propagationId`,`channel`]])p[e]=X(n,p[e],t);if(i.version!==3){let n=X(`phy`,p.phyId,t),r=n===X(`phy`,String(s.type),t);r&&(p.protocolAttributes=si({[n]:Object.fromEntries(Object.entries(c).filter(([e])=>![`txPower`,`transRange`].includes(e)))},p.protocolAttributes||{}));let i=X(`mac`,p.macId,t),a=i===X(`mac`,String(l.type),t);a&&(p.protocolAttributes=si({[i]:Object.fromEntries(Object.entries(u).filter(([e])=>![`SlotNum`,`SlotLen`,`InitialRoundDelay`].includes(e)))},p.protocolAttributes||{})),p.protocolAttributes=li(p,{...e,...e.slotNum===void 0&&a&&u.SlotNum!==void 0?{slotNum:u.SlotNum}:{},...e.slotLen===void 0&&a&&u.SlotLen!==void 0?{slotLen:u.SlotLen}:{},...e.initialRoundDelay===void 0&&a&&u.InitialRoundDelay!==void 0?{initialRoundDelay:u.InitialRoundDelay}:{},...e.transRange===void 0&&r&&c.transRange!==void 0?{transRange:c.transRange}:{}},t)}else p.protocolAttributes=si(ci(e.environmentStacks,t),p.protocolAttributes||{})}else p.protocolAttributes=li(p,{transRange:c.transRange,slotNum:u.SlotNum,slotLen:u.SlotLen,initialRoundDelay:u.InitialRoundDelay},t);let h=i?.nodes??r.nodes;if(!Array.isArray(h)||h.length>64)throw Error(`nodes 必须是最多 64 个节点的数组`);let g=h.map(e=>{let n=Q(e,`节点`),r=Ni(i?.nodes?n.node_id:n.id,`节点编号`);if(!Dr(r))throw Error(`节点编号必须是 1–${Er} 的整数`);let o=n.appDestination===void 0?void 0:Ni(n.appDestination,`应用目的节点`);if(o!==void 0&&!Dr(o))throw Error(`应用目的节点编号无效`);if(n.modelType!==void 0&&!F(n.modelType))throw Error(`节点 ${r} 的模型类型 modelType 无效`);let s=n.mobility===void 0?void 0:Q(n.mobility,`节点 ${r} 的移动模型`);if(s&&Object.keys(s).some(e=>e!==`type`))throw Error(`节点 ${r} 的移动模型仅保存 type；属性应放在节点 protocolAttributes 中`);let c=s===void 0?void 0:$(s.type,`节点 ${r} 的移动模型 TypeId`);if(c!==void 0&&!c.trim())throw Error(`节点 ${r} 的移动模型 TypeId 不能为空`);return{...o===void 0?{}:{appDestination:o},...n.modelType===void 0?{}:{modelType:n.modelType},...c===void 0?{}:{mobility:{type:c}},node_id:r,name:$(n.name??`Node-${r}`,`节点名称`),role:$(n.role??`node`,`节点角色`),x:Ni(n.x,`x`),y:Ni(n.y,`y`),z:Ni(n.z??0,`z`),phyId:i?.nodes?$(n.phyId??p.phyId,`phyId`):p.phyId,macId:i?.nodes?$(n.macId??p.macId,`macId`):p.macId,routingId:i?.nodes?$(n.routingId??p.routingId,`routingId`):p.routingId,appId:i?.nodes?X(`app`,$(n.appId??`none`,`appId`),t)||`none`:a(`app`,n.app??``),appAttrs:Pi(n.appAttrs),...n.protocolAttributes===void 0?{}:{protocolAttributes:Ii(n.protocolAttributes)}}}),_=Or(g.map(e=>({...e,id:e.node_id})));if(_.length)throw Error(_.join(`；`));(!i||i.version===1)&&(g=fi({...p,...m},g,t));let v=i?.selectedIds;if(v!==void 0&&(!Array.isArray(v)||v.some(e=>typeof e!=`number`)))throw Error(`选中节点格式错误`);return{form:p,nodes:g,selectedIds:Array.isArray(v)?v.filter(e=>g.some(t=>t.node_id===e)):g.slice(0,1).map(e=>e.node_id),activeCatalogId:i?.activeCatalogId===void 0?`mac:${p.macId}`:$(i.activeCatalogId,`activeCatalogId`),aquaSimHome:i?.aquaSimHome===void 0?void 0:$(i.aquaSimHome,`AQUA_SIM_HOME`),...i?.canvas===void 0?{}:{canvas:se(i.canvas)}}},zi=(e,t,n,r,i)=>{let a=x(``),o=x(!1),s=x(!1),c=0;z(()=>{c++});let l=()=>JSON.parse(JSON.stringify({form:e.experimentForm.value,nodes:e.editNodes.value,canvas:e.canvas.value,selectedIds:e.selectedIds.value,activeCatalogId:e.activeCatalogId.value,aquaSimHome:n.value})),u=L(()=>Li(l(),t.value)),d=t=>{t.aquaSimHome!==void 0&&t.aquaSimHome!==n.value&&r(t.aquaSimHome),e.canvas.value=t.canvas,e.experimentForm.value=t.form,e.editNodes.value=t.nodes,e.selectedIds.value=t.selectedIds,e.activeCatalogId.value=t.activeCatalogId,e.topologyError.value=``,i()};return{documentJson:u,message:a,failed:o,importing:s,newExperiment:()=>{d({form:zr(),nodes:[],selectedIds:[],activeCatalogId:``}),o.value=!1,a.value=`已新建空白实验，可添加节点或导入参数。`},importFile:async e=>{let n=++c;s.value=!0,o.value=!1,a.value=``;try{if(e.size>1e6)throw Error(`实验文件不能超过 1 MB`);let r=await e.text();if(n!==c)return;let i=Ri(r,t.value);d(i),a.value=`已导入 ${e.name}（${i.nodes.length} 个节点）。`}catch(e){if(n!==c)return;o.value=!0,a.value=`导入失败：${e instanceof Error?e.message:String(e)}。当前实验保持不变。`}finally{n===c&&(s.value=!1)}},exportFile:()=>{let e=URL.createObjectURL(new Blob([u.value],{type:`application/json`})),t=document.createElement(`a`);t.href=e,t.download=`experiment.json`,t.hidden=!0,document.body.appendChild(t),t.click(),t.remove(),window.setTimeout(()=>URL.revokeObjectURL(e),1e3),o.value=!1,a.value=`已发起实验参数下载。`}}},Bi={class:`experiment-files`},Vi={class:`control-btn-row`},Hi=[`disabled`],Ui=[`role`],Wi=M(l({__name:`ExperimentFiles`,props:{disabled:{type:Boolean},message:{},failed:{type:Boolean},importing:{type:Boolean}},emits:[`import`,`export`],setup(e,{emit:t}){let n=t,i=x(null),a=e=>{let t=e.target,r=t.files?.[0];t.value=``,r&&n(`import`,r)};return(t,o)=>(s(),u(`div`,Bi,[h(`div`,Vi,[h(`button`,{class:`btn btn-compact`,disabled:e.disabled||e.importing,onClick:o[0]||=e=>i.value?.click()},T(e.importing?`导入中…`:`导入参数`),9,Hi),h(`button`,{class:`btn btn-compact`,onClick:o[1]||=e=>n(`export`)},`导出参数`)]),h(`input`,{ref_key:`fileInput`,ref:i,type:`file`,accept:`.json,application/json`,"aria-label":`导入实验参数`,hidden:``,onChange:a},null,544),e.message?(s(),u(`p`,{key:0,role:e.failed?`alert`:`status`,class:`file-message`},T(e.message),9,Ui)):r(``,!0)]))}}),[[`__scopeId`,`data-v-e78d5da5`]]),Gi=[`aria-label`],Ki={key:0,class:`dock-title`},qi={key:0},Ji={key:1,class:`attribute-heading`},Yi={key:2,class:`attribute-hint`},Xi={key:3,class:`attribute-hint`},Zi=[`title`],Qi={class:`field-head`},$i={class:`field-param`},ea=[`value`,`placeholder`,`readonly`,`aria-invalid`,`data-protocol-attribute`,`onInput`],ta={key:0,class:`attribute-unit`},na={key:1,class:`attribute-error`},ra={key:2,class:`attribute-state`},ia=[`onClick`],aa={key:3,class:`attribute-state`},oa=[`onClick`],sa={class:`field-head`},ca={class:`field-param`},la=[`value`],ua={class:`attribute-state`},da=[`onClick`],fa=M(l({__name:`ProtocolAttributes`,props:{layers:{},form:{},node:{},ready:{type:Boolean},scope:{},layerId:{},embedded:{type:Boolean},hideHeading:{type:Boolean}},emits:[`change`],setup(e,{emit:t}){let n=e,a=t,o=e=>wr.some(t=>t===e),c=L(()=>Hn(n.layers).filter(e=>(!n.layerId||e.id===n.layerId)&&(n.scope===`node`?e.id===`app`:n.scope===`device-node`?o(e.id):n.scope===`mobility-node`?e.id===`mobility`:e.id!==`app`&&e.scope!==`node`)).flatMap(e=>(e.id===`channel`?[n.form.channelId,n.form.propagationId]:e.id===`app`?[n.node?.appId||`none`]:e.id===`mobility`?[n.node?.mobility?.type||``]:[String(n.form[e.field]||``)]).map(t=>{let r=Un(e.id,t,n.layers);if(!r?.typeId)return null;let i=(r.attributes||[]).map(t=>({...t,...Ir(r,t,e.id)})),a=e.id===`app`?n.node?.appAttrs||{}:n.scope===`device-node`||n.scope===`mobility-node`?n.node?.protocolAttributes?.[r.typeId]||{}:n.form.protocolAttributes?.[r.typeId]||{},o=new Set(i.map(e=>e.name)),s=Object.keys(a).filter(e=>!o.has(e));return{label:`${e.label} · ${r.label}`,layerId:e.id,item:r,attributes:i,values:a,unregistered:s,nodeId:e.id===`app`||n.scope===`device-node`||n.scope===`mobility-node`?n.node?.node_id:void 0}}).filter(e=>e!==null))),l={StartTime:`应用启动时间`,StopTime:`应用停止时间`,OnTime:`发送持续时间`,OffTime:`静默持续时间`,Interval:`发送间隔分布`,NodeCount:`节点数量`,InitialRoundDelay:`首轮延迟`,SlotNum:`时隙数量`,SlotLen:`时隙长度`,Token:`令牌标识`,transRange:`传输距离（m）`,Frequency:`频率`,devName:`串口设备`,DataRate:`发送速率（bit/s）`,PacketSize:`包大小（B，字节）`,RxProcessingDelay:`接收处理时间`,Position:`初始位置`,Velocity:`当前速度`,InitialVelocity:`初始速度`,Delay:`发送间隔`,traffic:`每秒发包数`,mode:`发送模式`,Nsend:`发送节点上限`,stopSend:`停止发送时间`,RXThresh:`接收阈值`,rxPower:`接收功耗`,idlePower:`空闲功耗`,MaxBytes:`最大发送字节数`},d=(e,t)=>{let r=Cr(t,t.defaultValue),i=t.name;if(n.scope!==`device-node`)return r;let a=n.form.protocolAttributes?.[e]?.[i];return a?.trim()?`继承统一：${Cr(t,a)}`:r},p=(e,t)=>{if(!t?.trim())return``;try{return xr(e,t),``}catch(e){return e instanceof Error?e.message:String(e)}};return(t,n)=>e.ready?(s(),u(`section`,{key:0,class:`protocol-attributes`,"aria-label":e.scope===`device-node`?`节点 ${e.node?.node_id} 协议覆盖`:void 0},[!e.embedded&&!e.hideHeading?(s(),u(`div`,Ki,T(e.scope===`node`?`节点应用属性`:e.scope===`device-node`?`节点协议属性`:`统一协议属性`),1)):r(``,!0),(s(!0),u(m,null,v(c.value,t=>(s(),i(N(e.embedded?`section`:`details`),{key:t.item.typeId,class:`attribute-group`,open:!e.embedded&&(e.scope===`node`||e.scope===`device-node`&&c.value.length===1)?!0:void 0},{default:f(()=>[e.embedded?c.value.length>1?(s(),u(`h3`,Ji,T(t.label),1)):r(``,!0):(s(),u(`summary`,qi,T(t.label),1)),t.item.requirement?(s(),u(`p`,Yi,T(t.item.requirement),1)):r(``,!0),t.attributes.length?r(``,!0):(s(),u(`p`,Xi,`此协议没有注册属性。`)),(s(!0),u(m,null,v(t.attributes,i=>(s(),u(`label`,{key:i.name,class:`field field-compact`,title:i.help},[h(`span`,Qi,[h(`span`,null,T(l[i.name]||`协议参数`),1),h(`span`,$i,T(i.name),1)]),h(`input`,{class:`select`,value:t.values[i.name]??``,placeholder:d(t.item.typeId,i),readonly:!i.editable,"aria-invalid":i.editable&&!!p(i,t.values[i.name]),"data-protocol-attribute":i.name,onInput:e=>i.editable&&a(`change`,t.item.typeId,i.name,e.target.value,t.nodeId)},null,40,ea),i.editable&&C(Sr)(i)?(s(),u(`span`,ta,T(C(Sr)(i)),1)):r(``,!0),i.editable&&p(i,t.values[i.name])?(s(),u(`span`,na,T(p(i,t.values[i.name])),1)):r(``,!0),i.editable?e.scope===`device-node`&&t.values[i.name]!==void 0?(s(),u(`span`,aa,[n[0]||=h(`span`,null,`节点覆盖`,-1),h(`button`,{type:`button`,class:`btn btn-compact`,onClick:e=>a(`change`,t.item.typeId,i.name,``,t.nodeId)},`恢复继承`,8,oa)])):r(``,!0):(s(),u(`span`,ra,[h(`span`,null,T(i.reason),1),t.values[i.name]===void 0?r(``,!0):(s(),u(`button`,{key:0,type:`button`,class:`btn btn-compact`,onClick:e=>a(`change`,t.item.typeId,i.name,``,t.nodeId)},`清除覆盖`,8,ia))]))],8,Zi))),128)),(s(!0),u(m,null,v(t.unregistered,e=>(s(),u(`label`,{key:`unregistered:${e}`,class:`field field-compact`},[h(`span`,sa,[n[1]||=h(`span`,null,`未注册属性`,-1),h(`span`,ca,T(e),1)]),h(`input`,{class:`select`,value:t.values[e],readonly:``},null,8,la),h(`span`,ua,[n[2]||=h(`span`,null,`已保存的覆盖值`,-1),h(`button`,{type:`button`,class:`btn btn-compact`,onClick:n=>a(`change`,t.item.typeId,e,``,t.nodeId)},`清除覆盖`,8,da)])]))),128))]),_:2},1032,[`open`]))),128))],8,Gi)):r(``,!0)}}),[[`__scopeId`,`data-v-ca054589`]]),pa={key:0,class:`node-protocol-details`},ma=[`disabled`],ha={key:0,class:`dock-title`},ga={class:`node-application`},_a={class:`field field-compact`},va=[`disabled`,`value`],ya={key:0,value:`none`},ba=[`value`],xa=[`value`],Sa={key:0,class:`node-scope`},Ca={key:0,class:`field field-compact`},wa=[`value`],Ta=[`value`],Ea=[`value`],Da={class:`node-mobility`},Oa={class:`field field-compact`},ka=[`disabled`,`value`],Aa=[`value`],ja=[`value`],Ma=M(l({__name:`NodeProtocolDetails`,props:{nodeId:{},nodes:{},layers:{},form:{},ready:{type:Boolean},disabled:{type:Boolean}},emits:[`application`,`attribute`,`destination`,`protocol-attribute`,`mobility`],setup(e,{emit:t}){let n=e,a=t,o=L(()=>n.nodes.find(({node_id:e})=>e===n.nodeId)),c=L(()=>n.layers.find(e=>e.id===`app`)?.items||[]),l=L(()=>Un(`app`,o.value?.appId||`none`,n.layers)),d=L(()=>l.value?.label||(o.value?.appId&&o.value.appId!==`none`?o.value.appId:`无独立应用`)),f=L(()=>Fr(l.value||void 0)),p=L(()=>o.value?.appDestination===void 0||n.nodes.some(e=>e.node_id===o.value?.appDestination)),g=L(()=>n.layers.find(e=>e.id===`mobility`)?.items||[]),_=L(()=>Un(`mobility`,o.value?.mobility?.type||``,n.layers)),y=L(()=>_.value?.label||o.value?.mobility?.type||`固定位置`);return(t,n)=>o.value?(s(),u(`div`,pa,[h(`fieldset`,{disabled:e.disabled},[e.ready?(s(),u(`div`,ha,`节点协议属性`)):r(``,!0),h(`details`,ga,[h(`summary`,null,`应用层 · `+T(d.value),1),h(`label`,_a,[n[6]||=h(`span`,{class:`field-head`},[h(`span`,null,`应用`),h(`span`,{class:`field-param`},`Application`)],-1),h(`select`,{class:`select`,"aria-label":`节点应用`,disabled:!e.ready,value:l.value?.id||o.value.appId||`none`,onChange:n[0]||=e=>a(`application`,o.value.node_id,e.target.value)},[!l.value&&(!o.value.appId||o.value.appId===`none`)?(s(),u(`option`,ya,`无独立应用`)):!l.value&&o.value.appId?(s(),u(`option`,{key:1,value:o.value.appId},T(o.value.appId)+`（`+T(e.ready?`未注册`:`待校验`)+`）`,9,ba)):r(``,!0),(s(!0),u(m,null,v(c.value,e=>(s(),u(`option`,{key:e.id,value:e.id},T(e.label),9,xa))),128))],40,va)]),e.ready?r(``,!0):(s(),u(`p`,Sa,`预编译后可选择应用并编辑注册属性。`)),o.value.appId&&o.value.appId!==`none`?(s(),u(m,{key:1},[f.value?(s(),u(`label`,Ca,[n[8]||=h(`span`,{class:`field-head`},[h(`span`,null,`目的节点`),h(`span`,{class:`field-param`},`Remote`)],-1),h(`select`,{class:`select`,"aria-label":`节点应用目的节点`,value:o.value.appDestination??``,onChange:n[1]||=e=>a(`destination`,o.value.node_id,e.target.value===``?void 0:Number(e.target.value))},[n[7]||=h(`option`,{value:``},`请选择目的节点`,-1),p.value?r(``,!0):(s(),u(`option`,{key:0,value:o.value.appDestination},`节点 `+T(o.value.appDestination)+`（已移除）`,9,Ta)),(s(!0),u(m,null,v(e.nodes,e=>(s(),u(`option`,{key:e.node_id,value:e.node_id},`节点 `+T(e.node_id)+` · `+T(e.name),9,Ea))),128))],40,wa)])):r(``,!0),O(fa,{embedded:``,scope:`node`,layers:e.layers,form:e.form,node:o.value,ready:e.ready,onChange:n[2]||=(e,t,n,r)=>a(`attribute`,e,t,n,r)},null,8,[`layers`,`form`,`node`,`ready`])],64)):r(``,!0)]),O(fa,{"hide-heading":``,scope:`device-node`,layers:e.layers,form:e.form,node:o.value,ready:e.ready,onChange:n[3]||=(t,n,r)=>a(`protocol-attribute`,t,n,r,e.nodeId)},null,8,[`layers`,`form`,`node`,`ready`]),h(`details`,Da,[h(`summary`,null,`移动模型 · `+T(y.value),1),h(`label`,Oa,[n[10]||=h(`span`,{class:`field-head`},[h(`span`,null,`移动模型`),h(`span`,{class:`field-param`},`MobilityModel`)],-1),h(`select`,{class:`select`,"aria-label":`节点移动模型`,disabled:!e.ready,value:_.value?.typeId||o.value.mobility?.type||``,onChange:n[4]||=e=>a(`mobility`,o.value.node_id,e.target.value)},[n[9]||=h(`option`,{value:``},`固定位置`,-1),o.value.mobility?.type&&!_.value?(s(),u(`option`,{key:0,value:o.value.mobility.type},T(o.value.mobility.type)+`（`+T(e.ready?`未注册`:`待校验`)+`）`,9,Aa)):r(``,!0),(s(!0),u(m,null,v(g.value,e=>(s(),u(`option`,{key:e.typeId,value:e.typeId},T(e.label),9,ja))),128))],40,ka)]),o.value.mobility?(s(),i(fa,{key:0,embedded:``,scope:`mobility-node`,layers:e.layers,form:e.form,node:o.value,ready:e.ready,onChange:n[5]||=(t,n,r)=>a(`protocol-attribute`,t,n,r,e.nodeId)},null,8,[`layers`,`form`,`node`,`ready`])):r(``,!0)])],8,ma)])):r(``,!0)}}),[[`__scopeId`,`data-v-250f8a13`]]),Na=()=>{let e=x(null),t=x(!1),n=x(``),r=null;return z(()=>{r?.abort(),r=null}),{listing:e,loading:t,error:n,browse:async i=>{r?.abort();let a=new AbortController;r=a,t.value=!0,n.value=``;try{let{ok:t,data:n}=await wi(`simulator/directories`,{aquaSimHome:i},a.signal);if(!t||!n.ok)throw Error(n.error||`无法浏览目录`);r===a&&!a.signal.aborted&&(e.value=n)}catch(e){a.signal.aborted||(n.value=e instanceof Error?e.message:String(e))}finally{r===a&&(t.value=!1,r=null)}}}},Pa={class:`picker-head`},Fa={class:`picker-actions`,"aria-label":`目录导航`},Ia=[`disabled`],La=[`disabled`],Ra=[`disabled`],za=[`disabled`],Ba={class:`picker-path`,"aria-label":`当前目录`},Va=[`aria-busy`],Ha={key:0,class:`picker-hint`,role:`status`},Ua={key:1,class:`picker-error`,role:`alert`},Wa={key:0,class:`picker-hint`},Ga={key:1,"aria-label":`子文件夹`},Ka=[`aria-label`,`onClick`],qa={class:`picker-hint`,role:`status`},Ja={class:`picker-footer`},Ya=[`disabled`],Xa=M(l({__name:`SimulatorDirectoryPicker`,props:{initialPath:{}},emits:[`select`,`close`],setup(e,{emit:a}){let o=e,c=a,l=x(null),{listing:d,loading:f,error:p,browse:g}=Na(),y=L(()=>!!d.value?.simulator.ok&&!f.value&&!p.value),b=()=>{y.value&&d.value&&c(`select`,d.value.home)};return _(()=>{l.value?.showModal(),g(o.initialPath)}),(a,o)=>(s(),i(n,{to:`body`},[h(`dialog`,{ref_key:`dialog`,ref:l,class:`directory-picker`,"aria-labelledby":`directory-picker-title`,onCancel:o[5]||=R(e=>c(`close`),[`prevent`])},[h(`div`,Pa,[o[6]||=h(`h2`,{id:`directory-picker-title`},`选择仿真目录`,-1),h(`button`,{class:`btn btn-compact`,autofocus:``,onClick:o[0]||=e=>c(`close`)},`取消`)]),o[9]||=h(`p`,{class:`picker-hint`},`浏览运行服务的机器，进入 aqua-sim-dev 文件夹后选用。`,-1),h(`nav`,Fa,[h(`button`,{class:`btn btn-compact`,disabled:C(f)||!C(d)?.parent,onClick:o[1]||=e=>C(g)(C(d).parent)},`上一级`,8,Ia),h(`button`,{class:`btn btn-compact`,disabled:C(f),onClick:o[2]||=e=>C(g)(`~`)},`用户目录`,8,La),h(`button`,{class:`btn btn-compact`,disabled:C(f),onClick:o[3]||=e=>C(g)(`.`)},`项目目录`,8,Ra),h(`button`,{class:`btn btn-compact`,disabled:C(f),onClick:o[4]||=e=>C(g)(``)},`默认目录`,8,za)]),h(`p`,Ba,T(C(d)?.home||e.initialPath||`服务器默认目录`),1),h(`div`,{class:`picker-folders`,"aria-busy":C(f)},[C(f)?(s(),u(`p`,Ha,`正在读取目录…`)):C(p)?(s(),u(`p`,Ua,T(C(p)),1)):C(d)?(s(),u(m,{key:2},[C(d).directories.length?(s(),u(`ul`,Ga,[(s(!0),u(m,null,v(C(d).directories,e=>(s(),u(`li`,{key:e.path},[h(`button`,{class:`folder-button`,"aria-label":`打开文件夹 ${e.name}`,onClick:t=>C(g)(e.path)},[o[7]||=h(`svg`,{viewBox:`0 0 24 24`,width:`18`,height:`18`,fill:`none`,stroke:`currentColor`,"stroke-width":`1.5`,"aria-hidden":`true`},[h(`path`,{d:`M3 7V5h7l2 2h9v13H3V7Z`})],-1),h(`span`,null,T(e.name),1),o[8]||=h(`span`,{"aria-hidden":`true`},`›`,-1)],8,Ka)]))),128))])):(s(),u(`p`,Wa,`此目录没有子文件夹。`))],64)):r(``,!0)],8,Va),h(`p`,qa,[!C(f)&&!C(p)&&C(d)?(s(),u(m,{key:0},[t(T(C(d).simulator.ok?`已找到 ns3 与 Aqua-Sim 模块，可选用此目录。`:`请进入包含 ns3 与 src/aqua-sim-tg 的仿真目录。`),1)],64)):r(``,!0)]),h(`div`,Ja,[h(`button`,{class:`btn btn-compact`,disabled:!y.value,onClick:b},`选用此目录`,8,Ya)])],544)]))}}),[[`__scopeId`,`data-v-4ba6343e`]]),Za={class:`simulator-settings`,"aria-label":`仿真环境`},Qa={class:`field field-compact`},$a={class:`directory-input-row`},eo=[`value`,`disabled`,`placeholder`,`title`],to=[`disabled`],no={class:`build-actions`},ro=[`disabled`],io=[`disabled`],ao=[`disabled`],oo={class:`directory-result`,role:`status`,"aria-live":`polite`},so={key:0,class:`build-progress`},co=[`value`],lo={key:1,"aria-label":`预编译进度`},uo={key:2},fo={key:1},po={key:2,class:`directory-ok`},mo={key:3,class:`directory-error`},ho={key:4,class:`directory-ok`},go={key:5,class:`directory-error`},_o={key:7,class:`directory-error`},vo=[`open`],yo=M(l({__name:`SimulatorSettings`,props:{modelValue:{},defaultHome:{},checking:{type:Boolean},buildStatus:{},buildLog:{},buildError:{},buildProgress:{},cleanStatus:{},cleanError:{},disabled:{type:Boolean},storageError:{},result:{}},emits:[`update:modelValue`,`precompile`,`clearBuild`,`reset`,`select`],setup(e,{emit:t}){let n=e,a=t,o=x(!1),c=x(!1),l=L(()=>Ei(n.buildError,n.buildLog,`预编译失败，请查看详情。`)),d=L(()=>Ei(n.cleanError,n.buildLog,`清除构建失败，请查看详情。`)),f=L(()=>Ei(n.result?.error,``,`目录检查失败，请查看详情。`)),p=L(()=>n.buildStatus===`fail`?l.value.details:n.cleanStatus===`fail`?d.value.details:n.result&&!n.result.ok?f.value.details:Ei(``,n.buildLog).details);y(()=>[n.modelValue,n.buildStatus,n.cleanStatus,n.buildLog],()=>{c.value=!1});let m=L(()=>n.disabled&&!(n.buildStatus===`building`&&n.buildProgress?.phase===`waiting`)),g=L(()=>n.buildProgress?.phase===`build`&&n.buildProgress.total>0?Math.round(n.buildProgress.completed/n.buildProgress.total*100):null),_=L(()=>{let e=n.buildProgress;return e?.phase===`waiting`?`正在等待当前任务完成，将自动继续预编译…`:e?.phase===`configure`?`正在配置构建环境…`:e?.phase===`catalog`?`正在读取注册协议…`:e?.phase===`build`&&e.total>0?`已编译 ${e.completed} / ${e.total}`:`正在构建…`}),v=e=>{a(`select`,e),o.value=!1};return(t,n)=>(s(),u(`section`,Za,[n[10]||=h(`div`,{class:`dock-title`},`仿真环境`,-1),h(`div`,Qa,[n[8]||=h(`label`,{class:`field-head`,for:`simulator-directory`},[h(`span`,null,`仿真目录`),h(`span`,{class:`field-param`},`AQUA_SIM_HOME`)],-1),h(`div`,$a,[h(`input`,{id:`simulator-directory`,class:`select directory-input`,value:e.modelValue,disabled:m.value,placeholder:e.defaultHome?`留空使用${e.defaultHome}`:`留空使用服务器默认目录`,title:e.defaultHome?`留空使用${e.defaultHome}`:`留空使用服务器默认目录`,spellcheck:`false`,onInput:n[0]||=e=>t.$emit(`update:modelValue`,e.target.value),onKeydown:n[1]||=S(R(n=>!e.disabled&&!e.checking&&t.$emit(`precompile`),[`prevent`]),[`enter`])},null,40,eo),h(`button`,{class:`btn btn-compact directory-choose`,disabled:m.value,onClick:n[2]||=e=>o.value=!0},`选择目录`,8,to)])]),h(`div`,no,[h(`button`,{class:`btn btn-compact`,disabled:e.checking||e.disabled,onClick:n[3]||=e=>t.$emit(`precompile`)},T(e.buildStatus===`building`?e.buildProgress?.phase===`waiting`?`等待中…`:`编译中…`:`预编译`),9,ro),h(`button`,{class:`btn btn-compact`,disabled:e.checking||e.disabled,title:`清除所选仿真目录的构建产物与配置缓存`,onClick:n[4]||=e=>t.$emit(`clearBuild`)},T(e.cleanStatus===`cleaning`?`清除中…`:`清除构建`),9,io),h(`button`,{class:`btn btn-compact`,disabled:!e.modelValue||m.value,onClick:n[5]||=e=>t.$emit(`reset`)},`恢复默认`,8,ao)]),h(`div`,oo,[e.buildStatus===`building`?(s(),u(`div`,so,[h(`span`,null,T(_.value),1),g.value===null?(s(),u(`progress`,lo)):(s(),u(`progress`,{key:0,"aria-label":`预编译进度`,value:g.value,max:`100`},null,8,co)),g.value===null?r(``,!0):(s(),u(`span`,uo,T(g.value)+`%`,1))])):e.cleanStatus===`cleaning`?(s(),u(`p`,fo,`正在清除构建…`)):e.cleanStatus===`ok`?(s(),u(`p`,po,`构建已清除，重新预编译后可运行仿真`)):e.cleanStatus===`fail`?(s(),u(`p`,mo,T(d.value.summary),1)):e.buildStatus===`ok`?(s(),u(`p`,ho,T(e.result?.buildReusable?`构建未变化，已复用`:`预编译完成`),1)):e.buildStatus===`fail`?(s(),u(`p`,go,T(l.value.summary),1)):e.result?(s(),u(`p`,{key:6,class:k(e.result.ok?`directory-ok`:`directory-error`)},T(e.result.ok?`目录检查通过（尚未验证编译）`:f.value.summary),3)):r(``,!0),e.storageError?(s(),u(`p`,_o,T(e.storageError),1)):r(``,!0)]),p.value?(s(),u(`details`,{key:0,class:`build-output`,open:c.value,onToggle:n[6]||=e=>c.value=e.target.open},[n[9]||=h(`summary`,null,`查看详情`,-1),h(`pre`,null,T(p.value),1)],40,vo)):r(``,!0),o.value&&!m.value?(s(),i(Xa,{key:1,"initial-path":e.modelValue,onSelect:v,onClose:n[7]||=e=>o.value=!1},null,8,[`initial-path`])):r(``,!0)]))}}),[[`__scopeId`,`data-v-6af547dc`]]),bo=(e,t)=>{let n=x([]),r=x(``),i=x(``),a=x(!1),o=x(``),s=null,c,l=!1,u=async u=>{if(l)return;s?.abort();let d=new AbortController;s=d,c=u,r.value=u||``,i.value=``,o.value=``,a.value=!0;let f=t();try{let{ok:t,data:a}=await wi(`simulator/source`,{aquaSimHome:e().trim(),typeId:f,...u?{path:u}:{}},d.signal);if(s!==d||d.signal.aborted||l)return;if(!t||!a.ok)throw Error(a.error||`无法读取协议源码`);if(a.typeId!==f||!Array.isArray(a.files)||typeof a.code!=`string`||typeof a.selectedPath!=`string`||!a.files.every(e=>e&&typeof e.path==`string`&&e.language===`cpp`)||!a.files.some(e=>e.path===a.selectedPath))throw Error(`仿真服务返回了无效的源码信息`);n.value=a.files,r.value=a.selectedPath,i.value=a.code}catch(e){s===d&&!d.signal.aborted&&!l&&(o.value=e instanceof Error?e.message:String(e))}finally{s===d&&(s=null,a.value=!1)}};return y([e,t],()=>{n.value=[],u()},{immediate:!0,flush:`sync`}),P(()=>{l=!0,s?.abort(),s=null}),{files:n,selectedPath:r,code:i,loading:a,error:o,selectFile:e=>{n.value.some(t=>t.path===e)&&(e===r.value&&!o.value||u(e))},retry:()=>{u(c)}}},xo={class:`source-header`},So={class:`source-heading`},Co={id:`protocol-source-title`},wo={class:`source-type-id`},To={id:`protocol-source-directory`,class:`source-directory`},Eo={key:0,class:`source-files`,"aria-label":`源码文件`},Do=[`aria-pressed`,`title`,`data-source-path`,`onClick`],Oo={class:`source-toolbar`},ko={class:`source-path`,"aria-label":`源码路径`},Ao=[`disabled`],jo=[`aria-busy`],Mo={key:0,class:`source-state`,role:`status`},No={key:1,class:`source-state source-error`},Po={role:`alert`},Fo={class:`source-footer`},Io=M(l({__name:`ProtocolSourceViewer`,props:{item:{},aquaSimHome:{},directoryLabel:{}},emits:[`close`],setup(e,{emit:t}){let a=e,o=t,c=x(null),l=x(null),{files:d,selectedPath:f,code:p,loading:g,error:b,selectFile:S,retry:w}=bo(()=>a.aquaSimHome,()=>a.item.typeId),E=x(``),D=x(!1),O=0,A=null,j=!1;y([p,f],()=>{O++,E.value=``,D.value=!1});let M=async()=>{if(g.value||b.value||!f.value)return;let e=++O;try{await navigator.clipboard.writeText(p.value),e===O&&(E.value=`源码已复制`,D.value=!1)}catch{e===O&&(E.value=`复制失败，请选中代码后手动复制。`,D.value=!0)}},N=e=>{let t=c.value?.getBoundingClientRect();return!!t&&(e.clientX<t.left||e.clientX>t.right||e.clientY<t.top||e.clientY>t.bottom)},P=e=>{j=N(e)},ee=e=>{j&&N(e)&&o(`close`),j=!1},te=e=>{e.stopPropagation(),e.key===`Escape`&&(e.preventDefault(),o(`close`))};_(()=>{A=document.activeElement instanceof HTMLElement?document.activeElement:null,c.value?.showModal(),l.value?.focus()}),z(()=>{O++,c.value?.close(),A?.isConnected&&A.focus({preventScroll:!0})});let F=e=>e.split(`/`).at(-1)||e;return(t,a)=>(s(),i(n,{to:`body`},[h(`dialog`,{ref_key:`dialog`,ref:c,class:`protocol-source-viewer`,"aria-labelledby":`protocol-source-title`,"aria-describedby":`protocol-source-directory`,onCancel:a[2]||=R(e=>o(`close`),[`prevent`]),onKeydown:te,onPointerdown:P,onClick:ee},[h(`header`,xo,[h(`div`,So,[h(`h2`,Co,T(e.item.label)+` 源码`,1),h(`p`,wo,T(e.item.typeId),1)]),h(`button`,{ref_key:`closeButton`,ref:l,class:`btn btn-compact`,type:`button`,"aria-label":`关闭协议源码`,onClick:a[0]||=e=>o(`close`)},`关闭`,512)]),h(`p`,To,[h(`span`,null,T(C(f).startsWith(`builtin/`)?`模型来源`:`仿真目录`),1),h(`code`,null,T(C(f).startsWith(`builtin/`)?`内置模型`:e.directoryLabel),1)]),C(d).length?(s(),u(`nav`,Eo,[(s(!0),u(m,null,v(C(d),e=>(s(),u(`button`,{key:e.path,class:k([`source-file`,{selected:e.path===C(f)}]),type:`button`,"aria-pressed":e.path===C(f),title:e.path,"data-source-path":e.path,onClick:t=>C(S)(e.path)},T(F(e.path)),11,Do))),128))])):r(``,!0),h(`div`,Oo,[h(`p`,ko,T(C(f)||(C(g)?`正在定位源码文件…`:`尚未读取源码路径`)),1),h(`button`,{class:`btn btn-compact`,type:`button`,disabled:C(g)||!!C(b)||!C(f),onClick:M},`复制源码`,8,Ao)]),h(`div`,{class:`source-content`,"aria-busy":C(g)},[C(g)?(s(),u(`p`,Mo,`正在读取源码…`)):C(b)?(s(),u(`div`,No,[h(`p`,Po,T(C(b)),1),h(`button`,{class:`btn btn-compact`,type:`button`,onClick:a[1]||=(...e)=>C(w)&&C(w)(...e)},`重试`)])):(s(),i(On,{key:2,class:`source-code`,code:C(p),language:`cpp`,"aria-label":`协议源码`},null,8,[`code`]))],8,jo),h(`footer`,Fo,[a[3]||=h(`span`,null,`只读 · C++`,-1),h(`span`,{class:k([`source-copy-message`,{failed:D.value}]),role:`status`},T(E.value),3)])],544)]))}}),[[`__scopeId`,`data-v-8add024c`]]),Lo=()=>({gps:{port:``,baudRate:9600,dataBits:8,stopBits:1,parity:`none`,pollIntervalMs:1e3},atomic:{port:``,baudRate:57600,dataBits:8,stopBits:1,parity:`none`,pollIntervalMs:1e3}}),Ro=e=>e.port.trim()?!Number.isInteger(e.baudRate)||e.baudRate<300||e.baudRate>4e6?`波特率必须是 300–4000000 的整数。`:[5,6,7,8].includes(e.dataBits)?[1,2].includes(e.stopBits)?[`none`,`even`,`odd`].includes(e.parity)?!Number.isInteger(e.pollIntervalMs)||e.pollIntervalMs<200||e.pollIntervalMs>6e4?`查询间隔必须为 200–60000 ms。`:``:`校验位设置无效。`:`停止位必须为 1 或 2。`:`数据位必须为 5、6、7 或 8。`:`请填写或选择运行服务的机器上的串口。`,zo=e=>{let t=Lo();if(!e)return t;try{let n=JSON.parse(e);for(let e of[`gps`,`atomic`]){let r=n?.[e];if(!r||typeof r.port!=`string`)continue;let i={port:r.port,baudRate:r.baudRate,dataBits:r.dataBits,stopBits:r.stopBits,parity:r.parity,pollIntervalMs:r.pollIntervalMs};Ro({...i,port:i.port||`unselected`})||(t[e]=i)}}catch{}return t},Bo=e=>!e||!Number.isFinite(Date.parse(e))?`—`:new Date(e).toISOString().replace(`T`,` `).replace(`Z`,``),Vo=(e,t)=>t?`服务未连接`:e?.connected?e.stale?`数据过期`:e.error?`数据异常`:e.lastReceivedAt?`已连接`:`等待数据`:`未连接`,Ho=5e3,Uo=`设备服务未连接，请通过 Go 服务打开真实试验页面。`,Wo=()=>{let e=null,t=x(``);try{e=localStorage.getItem(B.fieldDevices)}catch{t.value=`串口设置仅在本次页面中保留。`}let n=D(zo(e)),r=x(null),i=x(``),a=x(``),o=x(``),s=x(!1),c=x([]),l=x(!1),u=x(``),d=x(0),f=x(Date.now()),p=L(()=>!!i.value||!d.value||f.value-d.value>Ho),m=!1,h=0,g,v=null,y=new Set,b=async(e,t,n=new AbortController)=>{y.add(n);let r=setTimeout(()=>n.abort(),Ho);try{let r=await fetch(`/api/field/${e}`,{method:t===void 0?`GET`:`POST`,signal:n.signal,cache:`no-store`,...t===void 0?{}:{headers:{"Content-Type":`application/json`},body:JSON.stringify(t)}});if(!(r.headers.get(`content-type`)||``).includes(`application/json`))throw Error(Uo);let i=await r.json();if(!r.ok||i?.ok!==!0)throw Error(typeof i?.error==`string`?i.error:`设备请求失败（${r.status}）`);return i}catch(e){throw n.signal.aborted?Error(`设备服务请求超时或已取消。`):e}finally{clearTimeout(r),y.delete(n)}},S=async()=>{if(m||v)return;f.value=Date.now();let e=h,t=new AbortController;v=t;try{let n=await b(`status`,void 0,t);if(m||e!==h)return;if(!n.gps||!n.atomic||typeof n.systemTime!=`string`||!Number.isFinite(Date.parse(n.systemTime)))throw Error(`设备服务返回的数据无效。`);r.value=n,i.value=``,d.value=Date.now(),document.dispatchEvent(new CustomEvent(`aquasim:field-status`,{detail:n}))}catch(t){!m&&e===h&&(i.value=t instanceof Error?t.message:Uo,document.dispatchEvent(new CustomEvent(`aquasim:field-error`,{detail:i.value})))}finally{v===t&&(v=null),m||(clearTimeout(g),g=setTimeout(()=>{S()},1e3))}},C=()=>{clearTimeout(g),S()},w=async()=>{if(!(m||l.value)){l.value=!0,u.value=``;try{let e=await b(`ports`);if(!m){if(!Array.isArray(e.ports)||!e.ports.every(e=>typeof e==`string`))throw Error(`串口列表无效。`);c.value=e.ports}}catch(e){m||(u.value=e instanceof Error?e.message:`无法读取串口列表。`)}finally{m||(l.value=!1)}}},T=()=>{try{localStorage.setItem(B.fieldDevices,JSON.stringify(n)),t.value=``}catch{t.value=`浏览器无法保存串口设置，本次仍可使用。`}},E=async(e,t,n)=>{if(!(m||s.value)){s.value=!0,a.value=``,o.value=``,h++,v?.abort();try{await b(e,t),m||(o.value=n,T())}catch(e){m||(a.value=e instanceof Error?e.message:`设备操作失败。`)}finally{m||(s.value=!1,C())}}};return _(C),z(()=>{m=!0,h++,clearTimeout(g),y.forEach(e=>e.abort()),y.clear()}),{preferences:n,status:r,serviceError:i,actionError:a,message:o,busy:s,ports:c,portsLoading:l,portsError:u,storageError:t,statusStale:p,loadPorts:w,connect:e=>{let t=n[e],r=Ro(t);if(r){a.value=r;return}E(`connect`,{device:e,...t,port:t.port.trim()},`${e===`gps`?`GPS`:`原子钟`}串口已连接，等待设备数据。`)},disconnect:e=>{E(`disconnect`,{device:e},`串口已断开。`)},synchronize:e=>{E(`atomic-sync`,{source:e},`校时指令已发送，请核对后续原子钟读数。`)},refresh:C,savePreferences:T}},Go={class:`field-head`},Ko={class:`reading`},qo={class:`coordinate`},Jo={key:0},Yo={class:`reading`},Xo={class:`reading`},Zo=[`title`],Qo={class:`ports-action`},$o=[`disabled`],es={class:`hint`},ts={key:0,class:`error`,role:`alert`},ns={id:`field-device-ports`},rs=[`value`],is={class:`device-settings`},as={key:0,class:`connected-port`},os=[`disabled`],ss={class:`port-field`},cs=[`onUpdate:modelValue`,`aria-label`],ls=[`onUpdate:modelValue`,`aria-label`],us=[`onUpdate:modelValue`,`aria-label`],ds=[`value`],fs=[`onUpdate:modelValue`,`aria-label`],ps=[`onUpdate:modelValue`,`aria-label`],ms={key:0,class:`port-field`},hs={class:`serial-actions`},gs=[`disabled`,`onClick`],_s=[`disabled`,`onClick`],vs={key:1,class:`error`},ys={class:`hint`},bs={class:`mono`},xs={class:`sync-section`},Ss={class:`sync-actions`},Cs=[`disabled`],ws=[`disabled`],Ts={key:0,class:`hint`},Es={key:1},Ds={key:1,class:`error`,role:`status`},Os={key:2,class:`error`,role:`alert`},ks={key:3,class:`message`,role:`status`},As={key:4,class:`hint`},js=M(l({__name:`FieldDevices`,setup(a){let o=Wo(),{status:c,preferences:l,serviceError:d,actionError:f,message:g,busy:_,ports:y,portsLoading:w,portsError:E,storageError:D,statusStale:O}=o,A=x(null),j=x(!1),M=x(null),N=[{id:`gps`,name:`GPS`},{id:`atomic`,name:`原子钟`}],P=L(()=>{let e=c.value?.gps;return!Number.isFinite(e?.latitude)||!Number.isFinite(e?.longitude)?`经纬度 —`:`${!e?.fixValid||e.stale?`上次位置 `:``}${e.longitude.toFixed(6)}°, ${e.latitude.toFixed(6)}°`}),ee=L(()=>{let e=c.value?.gps;return!e?.connected||e.stale||d.value||e.error?Vo(e,d.value):e.fixValid?`已定位`:`未定位`}),te=L(()=>Vo(c.value?.atomic,d.value)),F=L(()=>c.value?.gps.validTime===!1?`—`:Bo(c.value?.gps.utcTime)),ne=L(()=>c.value?.atomic.validTime===!1?`—`:Bo(c.value?.atomic.utcTime)),z=L(()=>!_.value&&!O.value&&c.value?.atomic.connected&&c.value?.gps.connected&&c.value.gps.validTime&&!c.value.gps.stale),B=L(()=>!_.value&&!O.value&&c.value?.atomic.connected),re=async()=>{j.value=!0,await p(),A.value?.showModal(),o.loadPorts()},ie=()=>{o.savePreferences(),A.value?.close(),j.value=!1,M.value?.focus()};return(a,p)=>(s(),u(`section`,{class:`field-devices`,"aria-label":`真实试验设备状态`,onPointerdown:p[5]||=R(()=>{},[`stop`]),onWheel:p[6]||=R(()=>{},[`stop`])},[h(`header`,Go,[h(`button`,{ref_key:`settingsButton`,ref:M,class:`btn btn-compact field-settings`,onClick:re},`硬件设置`,512)]),h(`dl`,{class:k([`readings`,{stale:C(O)}])},[h(`div`,Ko,[h(`dt`,null,[p[9]||=t(`GPS `,-1),h(`span`,{class:k({warning:!C(c)?.gps.fixValid||C(c)?.gps.stale})},T(ee.value),3)]),h(`dd`,null,T(F.value),1)]),h(`div`,qo,[t(T(P.value),1),C(c)?.gps.satellites===void 0?r(``,!0):(s(),u(`span`,Jo,` · `+T(C(c).gps.satellites)+` 星`,1))]),h(`div`,Yo,[h(`dt`,null,[p[10]||=t(`原子钟 `,-1),h(`span`,{class:k({warning:C(c)?.atomic.stale||!C(c)?.atomic.connected})},T(te.value),3)]),h(`dd`,null,T(ne.value),1)]),h(`div`,Xo,[h(`dt`,null,[p[11]||=t(`系统时间 `,-1),h(`span`,null,T(C(O)?`未更新`:`服务端`),1)]),h(`dd`,null,T(C(Bo)(C(c)?.systemTime))+` UTC`,1)])],2),C(d)?(s(),u(`p`,{key:0,class:`service-error`,title:C(d),role:`status`},T(C(d)),9,Zo)):r(``,!0),(s(),i(n,{to:`body`},[j.value?(s(),u(`dialog`,{key:0,ref_key:`dialog`,ref:A,class:`field-dialog`,"aria-labelledby":`field-settings-title`,onCancel:R(ie,[`prevent`]),onKeydown:p[4]||=S(R(()=>{},[`stop`]),[`esc`])},[h(`header`,{class:`dialog-head`},[p[12]||=h(`h2`,{id:`field-settings-title`},`真实试验 · 设备设置`,-1),h(`button`,{class:`btn btn-compact`,autofocus:``,onClick:ie},`关闭`)]),p[25]||=h(`p`,{class:`hint`},`连接运行服务的机器上的串口。设备读数与系统时间统一以 UTC 显示；切换板块不会关闭已连接的设备。`,-1),h(`div`,Qo,[h(`button`,{class:`btn btn-compact`,disabled:C(w)||C(_),onClick:p[0]||=(...e)=>C(o).loadPorts&&C(o).loadPorts(...e)},T(C(w)?`正在查找…`:`刷新串口`),9,$o),h(`span`,es,T(C(y).length?`发现 ${C(y).length} 个串口`:`可手动输入串口路径`),1)]),C(E)?(s(),u(`p`,ts,T(C(E)),1)):r(``,!0),h(`datalist`,ns,[(s(!0),u(m,null,v(C(y),e=>(s(),u(`option`,{key:e,value:e},null,8,rs))),128))]),h(`div`,is,[(s(),u(m,null,v(N,n=>h(`section`,{key:n.id,class:`serial-card`},[h(`header`,null,[h(`h3`,null,T(n.name),1),h(`span`,null,T(C(Vo)(C(c)?.[n.id],C(d))),1)]),C(c)?.[n.id].connected?(s(),u(`p`,as,T(C(c)?.[n.id].port)+` · `+T(C(c)?.[n.id].baudRate)+` baud`,1)):r(``,!0),h(`fieldset`,{disabled:C(_)||C(c)?.[n.id].connected},[h(`label`,ss,[p[13]||=h(`span`,null,[t(`串口 `),h(`small`,{class:`field-param`},`port`)],-1),e(h(`input`,{"onUpdate:modelValue":e=>C(l)[n.id].port=e,class:`select`,list:`field-device-ports`,"aria-label":`${n.name} 串口`,placeholder:`/dev/ttyUSB0 或 COM3`,autocomplete:`off`},null,8,cs),[[I,C(l)[n.id].port]])]),h(`label`,null,[p[14]||=h(`span`,null,[t(`波特率 `),h(`small`,{class:`field-param`},`baud`)],-1),e(h(`input`,{"onUpdate:modelValue":e=>C(l)[n.id].baudRate=e,class:`select`,type:`number`,min:`300`,max:`4000000`,"aria-label":`${n.name} 波特率`},null,8,ls),[[I,C(l)[n.id].baudRate,void 0,{number:!0}]])]),h(`label`,null,[p[15]||=h(`span`,null,[t(`数据位 `),h(`small`,{class:`field-param`},`data bits`)],-1),e(h(`select`,{"onUpdate:modelValue":e=>C(l)[n.id].dataBits=e,class:`select`,"aria-label":`${n.name} 数据位`},[(s(),u(m,null,v([5,6,7,8],e=>h(`option`,{key:e,value:e},T(e),9,ds)),64))],8,us),[[b,C(l)[n.id].dataBits,void 0,{number:!0}]])]),h(`label`,null,[p[17]||=h(`span`,null,[t(`停止位 `),h(`small`,{class:`field-param`},`stop bits`)],-1),e(h(`select`,{"onUpdate:modelValue":e=>C(l)[n.id].stopBits=e,class:`select`,"aria-label":`${n.name} 停止位`},[...p[16]||=[h(`option`,{value:1},`1`,-1),h(`option`,{value:2},`2`,-1)]],8,fs),[[b,C(l)[n.id].stopBits,void 0,{number:!0}]])]),h(`label`,null,[p[19]||=h(`span`,null,[t(`校验位 `),h(`small`,{class:`field-param`},`parity`)],-1),e(h(`select`,{"onUpdate:modelValue":e=>C(l)[n.id].parity=e,class:`select`,"aria-label":`${n.name} 校验位`},[...p[18]||=[h(`option`,{value:`none`},`无`,-1),h(`option`,{value:`even`},`偶校验`,-1),h(`option`,{value:`odd`},`奇校验`,-1)]],8,ps),[[b,C(l)[n.id].parity]])]),n.id===`atomic`?(s(),u(`label`,ms,[p[20]||=h(`span`,null,[t(`查询间隔 `),h(`small`,{class:`field-param`},`ms`)],-1),e(h(`input`,{"onUpdate:modelValue":p[1]||=e=>C(l).atomic.pollIntervalMs=e,class:`select`,type:`number`,min:`200`,max:`60000`,step:`100`,"aria-label":`原子钟查询间隔`},null,512),[[I,C(l).atomic.pollIntervalMs,void 0,{number:!0}]])])):r(``,!0)],8,os),h(`div`,hs,[C(c)?.[n.id].connected?(s(),u(`button`,{key:1,class:`btn`,disabled:C(_),onClick:e=>C(o).disconnect(n.id)},`断开`+T(n.name),9,_s)):(s(),u(`button`,{key:0,class:`btn`,disabled:C(_)||!C(l)[n.id].port.trim(),onClick:e=>C(o).connect(n.id)},`连接`+T(n.name),9,gs))]),C(c)?.[n.id].error?(s(),u(`p`,vs,T(C(c)?.[n.id].error),1)):r(``,!0),h(`p`,ys,[p[21]||=t(`最近接收：`,-1),h(`span`,bs,T(C(Bo)(C(c)?.[n.id].lastReceivedAt)),1)])])),64))]),h(`section`,xs,[p[23]||=h(`h3`,null,`原子钟校时`,-1),p[24]||=h(`p`,{class:`hint`},`选择时间源后向原子钟发送设置指令。发送完成后请核对返回读数；系统时钟保持原值。`,-1),h(`div`,Ss,[h(`button`,{class:`btn btn-compact`,disabled:!z.value,onClick:p[2]||=e=>C(o).synchronize(`gps`)},`使用 GPS 时间校时`,8,Cs),h(`button`,{class:`btn btn-compact`,disabled:!B.value,onClick:p[3]||=e=>C(o).synchronize(`system`)},`使用服务端系统时间校时`,8,ws)]),C(c)?.atomic.lastSync?(s(),u(`p`,Ts,`最近指令：`+T(C(c).atomic.lastSync.source===`gps`?`GPS`:`系统时间`)+` → `+T(C(Bo)(C(c).atomic.lastSync.targetUtcTime))+` UTC（已发送）`,1)):r(``,!0),C(c)?.atomic.raw?(s(),u(`details`,Es,[p[22]||=h(`summary`,null,`原子钟原始回复`,-1),h(`pre`,null,T(C(c).atomic.raw),1)])):r(``,!0)]),C(d)?(s(),u(`p`,Ds,T(C(d)),1)):r(``,!0),C(f)?(s(),u(`p`,Os,T(C(f)),1)):r(``,!0),C(g)?(s(),u(`p`,ks,T(C(g)),1)):r(``,!0),C(D)?(s(),u(`p`,As,T(C(D)),1)):r(``,!0)],544)):r(``,!0)]))],32))}}),[[`__scopeId`,`data-v-362b9649`]]),Ms=ee(null),Ns={class:`deck-canvas`},Ps={class:`dock dock-left`},Fs=[`title`,`aria-label`,`aria-expanded`],Is={viewBox:`0 0 6 10`,width:`6`,height:`10`,"aria-hidden":`true`},Ls=[`d`],Rs={class:`dock dock-top cmd-bar`},zs=[`disabled`],Bs=[`disabled`],Vs=[`disabled`],Hs=[`disabled`],Us=[`title`,`aria-label`,`aria-expanded`],Ws={viewBox:`0 0 6 10`,width:`6`,height:`10`,"aria-hidden":`true`},Gs=[`d`],Ks={class:`dock-body`},qs=[`aria-label`],Js={class:`statusbar`},Ys={class:`sb-item`},Xs={class:`sb-item`},Zs={class:`sb-item`},Qs={class:`sb-item`},$s=M(l({__name:`ExperimentPage`,props:{mode:{default:`simulation`}},setup(n){let a=n.mode===`field`,o=x(null),c={left:232,top:24,right:300,bottom:0},l=wn(),{catalog:d,catalogReady:p,aquaSimHome:m,defaultHome:g,storageError:_,checking:v,result:y,precompile:b,buildStatus:S,buildLog:E,buildError:D,buildProgress:j,clearBuild:M,cleanStatus:N,cleanError:P,resetDirectory:ee,selectDirectory:F}=Mi(a?ji:void 0,{storageKey:a?B.fieldAquaSimHome:B.aquaSimHome,autoBuild:!a}),I=L(()=>S.value===`building`||N.value===`cleaning`),R=L(()=>d.value.filter(e=>e.scope!==`node`)),re=Ci(d,a?yi:void 0),{editNodes:V,canvas:se,selectedIds:ce,experimentForm:le,activeCatalogId:fe,selectedEditNode:pe,selectedSummary:me,canAddNode:he,topologyError:ge,canvasNodes:_e,nodeVisuals:ve,protocolStack:ye,stackBrief:be,onSelectionChange:xe,onNodeSelect:Se,onNodesMove:Ce,onNodeMove:we,onNodeCoordinate:Te,addNode:Ee,removeSelected:De,assignItem:Oe,onProtocolDrop:H,replaceTopology:ke,setField:Ae,setProtocolAttribute:U,setNodeDestination:je,setNodeProtocolAttribute:Me,onNodeRename:Ne,onNodeModelChange:Pe,setNodeMobility:Fe}=re,Ie=x(0),Le=L(()=>gi(le.value,d.value)),Re=L(()=>Object.fromEntries(V.value.map(e=>[e.node_id,gi(le.value,d.value,e)]))),ze=x(!0),Be=x(!0),Ve=x(null),He=L(()=>y.value?.home||m.value.trim()||g.value||`服务器默认目录`),Ue=x(null),W=x(!1),We=x(180),Ge=x(!1),Ke=0,qe=0,Je=e=>{let t=Math.max(160,(Ue.value?.clientHeight??window.innerHeight)*.5);We.value=Math.min(t,Math.max(120,qe+(Ke-e.clientY)))},Ye=()=>{Ge.value=!1,window.removeEventListener(`pointermove`,Je),window.removeEventListener(`pointerup`,Ye),window.removeEventListener(`pointercancel`,Ye),document.body.style.userSelect=``},Xe=e=>{e.button===0&&(Ge.value=!0,Ke=e.clientY,qe=We.value,document.body.style.userSelect=`none`,window.addEventListener(`pointermove`,Je),window.addEventListener(`pointerup`,Ye,{once:!0}),window.addEventListener(`pointercancel`,Ye,{once:!0}))};z(Ye);let Ze=L(()=>Ur(le.value,V.value,d.value)),Qe=L(()=>Wr(Ze.value,d.value)),$e=L(()=>[...Qe.value,...ge.value?[ge.value]:[]]),et=L(()=>{try{return hi(Ze.value,d.value)}catch(e){return`// ${e instanceof Error?e.message:String(e)}`}}),tt=(e,t)=>{de.pendingReplayApply=null,de.pendingReplayLog=e,de.pendingReplayName=t,l.push(`/replay`)},{runStatus:G,runLog:nt,runExperiment:rt}=Ti({getSpec:()=>Ze.value,getAquaSimHome:()=>m.value,onSuccess:(e,t)=>{a?o.value={log:e,name:t}:tt(e,t)}}),it=L(()=>G.value!==`idle`||!!nt.value),at=L(()=>({running:`运行中`,ok:`成功`,fail:`失败`,idle:``})[G.value]),ot=async()=>{V.value.length<2||!p.value||I.value||Qe.value.length||(o.value=null,await rt(),W.value=!0)},st=()=>{let e=de.replayNodes;!Array.isArray(e)||!e.length||(Ie.value++,ke(xi(e,le.value)))},ct=()=>{de.pendingReplayApply=V.value.map(bi),de.pendingReplayLog=null,de.pendingReplayName=``,l.push(`/replay`)},{documentJson:lt,message:ut,failed:dt,importing:ft,newExperiment:pt,importFile:mt,exportFile:ht}=zi(re,d,m,F,()=>{Ie.value++,o.value=null,G.value=`idle`,nt.value=``,W.value=!1});return(n,l)=>(s(),u(`section`,{class:k([`page`,{"field-page":a}])},[h(`div`,{ref_key:`stageEl`,ref:Ue,class:`deck`},[h(`div`,Ns,[(s(),i(ue,{key:Ie.value,"initial-state":C(se),"persist-state":!0,onCanvasState:l[2]||=e=>se.value=e,nodes:C(_e),"node-visuals":C(ve),"visible-packets":[],"current-time":0,"default-range-m":Le.value??void 0,"range-by-node":Re.value,"range-scope":Ie.value,"theme-key":C(ie),"fx-level":`standard`,"edit-mode":!0,"allow-gps":a,"gps-required":a,"gps-source":a?C(Ms)??void 0:void 0,"preference-scope":a?`field`:`simulation`,onGpsSource:l[3]||=e=>a&&(Ms.value=e),"allow-delete-nodes":!0,"allow-rename":C(G)!==`running`&&!I.value,"allow-coordinate-edit":C(G)!==`running`&&!I.value,"allow-position-lock":!0,"allow-place-node":C(he),"box-select":!0,"original-positions":[],"selected-node-id":C(pe)?.node_id??void 0,"selected-node-ids":C(ce),"sound-speed-mps":1500,"view-padding":c,onNodeMove:C(we),onNodesMove:C(Ce),onNodeSelect:C(Se),onNodePlace:C(Ee),onSelectionChange:C(xe),onNodesDelete:C(De),onNodeRename:C(Ne),onNodeCoordinate:C(Te),onProtocolDrop:C(H)},{"node-actions":f(({node:e})=>[O(oe,{node:e,disabled:C(G)===`running`||I.value,onChange:C(Pe)},null,8,[`node`,`disabled`,`onChange`])]),"node-details":f(({node:e})=>[O(Ma,{"node-id":e.node_id,nodes:C(V),form:C(le),layers:C(d),ready:C(p),disabled:C(G)===`running`||I.value,onApplication:l[0]||=(e,t)=>C(Oe)({layer:`app`,id:t},[e]),onAttribute:C(U),onDestination:C(je),onProtocolAttribute:l[1]||=(e,t,n,r)=>C(Me)(e,t,n,[r]),onMobility:C(Fe)},null,8,[`node-id`,`nodes`,`form`,`layers`,`ready`,`disabled`,`onAttribute`,`onDestination`,`onMobility`])]),_:1},8,[`initial-state`,`nodes`,`node-visuals`,`default-range-m`,`range-by-node`,`range-scope`,`theme-key`,`gps-source`,`preference-scope`,`allow-rename`,`allow-coordinate-edit`,`allow-place-node`,`selected-node-id`,`selected-node-ids`,`onNodeMove`,`onNodesMove`,`onNodeSelect`,`onNodePlace`,`onSelectionChange`,`onNodesDelete`,`onNodeRename`,`onNodeCoordinate`,`onProtocolDrop`]))]),h(`div`,{class:k([`dock-unit dock-unit-l`,{closed:!ze.value}])},[h(`div`,Ps,[O(gr,{layers:R.value,ready:C(p),"active-id":C(fe),"applied-protocols":C(ye),onAssign:C(Oe),onViewSource:l[4]||=e=>Ve.value=e},{"protocol-settings":f(({layerId:e})=>[O(fa,{embedded:``,scope:`scene`,"layer-id":e,layers:C(d),form:C(le),node:null,ready:C(p),onChange:C(U)},null,8,[`layer-id`,`layers`,`form`,`ready`,`onChange`])]),_:1},8,[`layers`,`ready`,`active-id`,`applied-protocols`,`onAssign`])]),h(`button`,{class:`panel-ear ear-left`,title:ze.value?`收起协议目录`:`展开协议目录`,"aria-label":ze.value?`收起协议目录`:`展开协议目录`,"aria-expanded":ze.value,onClick:l[5]||=e=>ze.value=!ze.value},[(s(),u(`svg`,Is,[h(`path`,{d:ze.value?`M5 1L1 5l4 4`:`M1 1l4 4-4 4`,fill:`none`,stroke:`currentColor`,"stroke-width":`1.5`,"stroke-linecap":`round`,"stroke-linejoin":`round`},null,8,Ls)])),l[15]||=h(`span`,{class:`ear-label`},`协议`,-1)],8,Fs)],2),h(`div`,Rs,[h(`button`,{class:`btn btn-compact`,"data-testid":`exp-add-node`,disabled:!C(he),onClick:l[6]||=e=>C(Ee)()},`添加节点`,8,zs),h(`button`,{class:`btn btn-compact`,disabled:C(ce).length===0,"aria-keyshortcuts":`Delete Backspace`,title:`删除选中节点（Delete / Backspace）`,onClick:l[7]||=(...e)=>C(De)&&C(De)(...e)},`删除选中`,8,Bs),l[16]||=h(`span`,{class:`cmd-sep`,"aria-hidden":`true`},null,-1),h(`button`,{class:`btn btn-compact`,disabled:C(G)===`running`||I.value||C(ft),onClick:l[8]||=(...e)=>C(pt)&&C(pt)(...e)},`新建实验`,8,Vs),h(`button`,{class:`run-btn`,"data-testid":`exp-run`,disabled:C(V).length<2||!C(p)||C(G)===`running`||I.value||Qe.value.length>0,onClick:ot},T(C(G)===`running`?`运行中…`:a?`运行试验`:`运行仿真`),9,Hs),a&&o.value?(s(),u(`button`,{key:0,class:`btn btn-compact`,onClick:l[9]||=e=>tt(o.value.log,o.value.name)},`查看运行回放`)):r(``,!0)]),h(`div`,{class:k([`dock-unit dock-unit-r experiment-inspector`,{closed:!Be.value}]),style:w(a?{bottom:`calc(88px - var(--dock-gap))`}:void 0)},[h(`button`,{class:`panel-ear`,title:Be.value?`收起属性面板`:`展开属性面板`,"aria-label":Be.value?`收起属性面板`:`展开属性面板`,"aria-expanded":Be.value,onClick:l[10]||=e=>Be.value=!Be.value},[(s(),u(`svg`,Ws,[h(`path`,{d:Be.value?`M1 1l4 4-4 4`:`M5 1L1 5l4 4`,fill:`none`,stroke:`currentColor`,"stroke-width":`1.5`,"stroke-linecap":`round`,"stroke-linejoin":`round`},null,8,Gs)])),l[17]||=h(`span`,{class:`ear-label`},`属性`,-1)],8,Us),O(ae,{class:`dock-right`,"default-width":300,min:240,max:480,"storage-key":a?C(B).fieldSplitInspect:C(B).splitInspect},{default:f(()=>[h(`aside`,Ks,[O(yo,{modelValue:C(m),"onUpdate:modelValue":l[11]||=e=>te(m)?m.value=e:null,"default-home":C(g),checking:C(v),disabled:C(G)===`running`||I.value,"build-status":C(S),"build-log":C(E),"build-error":C(D),"build-progress":C(j),"clean-status":C(N),"clean-error":C(P),"storage-error":C(_),result:C(y),onPrecompile:C(b),onClearBuild:C(M),onReset:C(ee),onSelect:C(F)},null,8,[`modelValue`,`default-home`,`checking`,`disabled`,`build-status`,`build-log`,`build-error`,`build-progress`,`clean-status`,`clean-error`,`storage-error`,`result`,`onPrecompile`,`onClearBuild`,`onReset`,`onSelect`]),O(Bn,{form:C(le),"spec-json":C(lt),"scratch-cc":et.value,warnings:$e.value,"node-count":C(V).length,"selected-count":C(ce).length,"selected-summary":C(me),"run-status":C(G),onUpdateField:C(Ae),onRun:ot,onSyncFromReplay:st,onApplyToReplay:ct,onAddNode:l[12]||=()=>C(Ee)(),onRemoveNode:C(De)},{"experiment-files":f(()=>[O(Wi,{disabled:C(G)===`running`||I.value,message:C(ut),failed:C(dt),importing:C(ft),onImport:C(mt),onExport:C(ht)},null,8,[`disabled`,`message`,`failed`,`importing`,`onImport`,`onExport`])]),_:1},8,[`form`,`spec-json`,`scratch-cc`,`warnings`,`node-count`,`selected-count`,`selected-summary`,`run-status`,`onUpdateField`,`onRemoveNode`])])]),_:1},8,[`storage-key`])],6),O(A,{name:`console`},{default:f(()=>[it.value?(s(),u(`footer`,{key:0,class:k([`dock console`,{collapsed:!W.value,dragging:Ge.value}]),style:w(W.value?{height:We.value+`px`}:void 0)},[e(h(`div`,{class:`console-grip`,role:`separator`,"aria-orientation":`horizontal`,"aria-label":`调整控制台高度`,title:`拖拽调整高度`,onPointerdown:Xe},null,544),[[ne,W.value]]),h(`div`,{class:`console-head`,onClick:l[13]||=e=>W.value=!W.value},[l[19]||=h(`span`,{class:`console-title`},`输出`,-1),at.value?(s(),u(`span`,{key:0,class:k([`run-badge`,`is-${C(G)}`])},T(at.value),3)):r(``,!0),h(`button`,{class:`console-toggle`,type:`button`,"aria-label":W.value?`收起输出`:`展开输出`},[(s(),u(`svg`,{viewBox:`0 0 10 6`,width:`10`,height:`6`,"aria-hidden":`true`,style:w({transform:W.value?`none`:`rotate(180deg)`})},[...l[18]||=[h(`path`,{d:`M1 5l4-4 4 4`,fill:`none`,stroke:`currentColor`,"stroke-width":`1.5`,"stroke-linecap":`round`},null,-1)]],4))],8,qs)]),e(h(`pre`,{class:`run-log`},T(C(nt)),513),[[ne,W.value]])],6)):r(``,!0)]),_:1})],512),Ve.value?(s(),i(Io,{key:0,item:Ve.value,"aqua-sim-home":C(m),"directory-label":He.value,onClose:l[14]||=e=>Ve.value=null},null,8,[`item`,`aqua-sim-home`,`directory-label`])):r(``,!0),h(`footer`,Js,[h(`span`,Ys,[h(`span`,{class:k([`sb-dot`,`is-${C(G)}`])},null,2),t(T(at.value||`就绪`),1)]),h(`span`,Xs,[l[20]||=t(`节点 `,-1),h(`b`,null,T(C(V).length),1)]),h(`span`,Zs,[l[21]||=t(`选中 `,-1),h(`b`,null,T(C(ce).length),1)]),a?(s(),i(js,{key:1})):l[22]||=h(`span`,{class:`sb-spacer`},null,-1),h(`span`,Qs,T(C(be)),1)])],2))}}),[[`__scopeId`,`data-v-aa670b00`]]),ec=Cn({history:Ut(),routes:[{path:`/`,name:`experiment`,component:$s},{path:`/field`,name:`field`,component:$s,props:{mode:`field`}},{path:`/replay`,name:`replay`,component:()=>me(()=>import(`./ReplayPage-BtOt03An.js`),__vite__mapDeps([0,1,2,3,4,5,6]))}]});E(Te).use(ec).mount(`#app`);