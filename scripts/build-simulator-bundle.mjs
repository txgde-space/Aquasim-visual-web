// Developer-only build: preserve one implementation of protocol validation/code generation.
// The resulting JavaScript runs inside the Go binary; no Node runtime is needed on N100.
import { build } from 'rolldown'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('..', import.meta.url))
const target = path.join(root, 'standalone/internal/simulator/engine.js')
mkdirSync(path.dirname(target), { recursive: true })
const source = `
import { generateAquaVisualCc } from ${JSON.stringify(path.join(root, 'src/features/experiment/lib/generateScratch.ts'))};
import { parseExperimentTime, topologyIssues } from ${JSON.stringify(path.join(root, 'src/features/experiment/lib/experimentValidation.ts'))};
import { TYPEID_LAYERS, PROTOCOL_LABELS } from ${JSON.stringify(path.join(root, 'src/features/experiment/lib/typeIdCatalog.ts'))};
import { BUILTIN_PROTOCOL_CC, BUILTIN_PROTOCOL_SOURCES } from ${JSON.stringify(path.join(root, 'src/features/experiment/lib/builtinProtocols.ts'))};
globalThis.Aquasim = {
 preflight(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || !Array.isArray(spec.nodes)) throw new Error('缺少有效的实验配置与节点列表');
  const issues = topologyIssues(spec.nodes, 2);
  if (issues.length) throw new Error(issues.join('；'));
  parseExperimentTime(spec.simStop, '仿真时长 simStop');
  for (const layer of ['phy','mac','routing']) if (!spec.stack || !spec.stack[layer] || typeof spec.stack[layer].type !== 'string' || !spec.stack[layer].type) throw new Error('请选择 ' + layer + ' 协议');
  if (!spec.channel || typeof spec.channel.type !== 'string' || !spec.channel.type || typeof spec.channel.propagation !== 'string' || !spec.channel.propagation) throw new Error('请选择信道与传播模型');
  return true;
 },
 generate(spec, layers, logName) { return generateAquaVisualCc(spec, layers, logName); },
 probe: BUILTIN_PROTOCOL_CC + '\\n' + ${JSON.stringify(readFileSync(path.join(root, 'server/templates/typeidCatalog.cc'), 'utf8'))},
 sources: BUILTIN_PROTOCOL_SOURCES,
 catalog(stdout) {
  const match = stdout.match(/AQUASIM_CATALOG_BEGIN\\s*([\\s\\S]*?)\\s*AQUASIM_CATALOG_END/);
  if (!match) throw new Error('未能读取 ns-3 注册协议，请查看编译输出');
  const rows = JSON.parse(match[1]);
  if (!Array.isArray(rows)) throw new Error('无效的协议目录');
  const layers = TYPEID_LAYERS.map(layer => ({ ...layer, items: layer.id === 'app' ? [{id:'none',typeId:'',label:'无独立应用',source:''}] : [] }));
  for (const row of rows) {
   const layer = layers.find(item => item.id === (row.layer === 'propagation' ? 'channel' : row.layer));
   if (!layer || !/^ns3::[A-Za-z0-9_:]+$/.test(row.typeId)) continue;
   layer.items.push({ id: row.typeId, typeId: row.typeId, label: PROTOCOL_LABELS[row.typeId] || row.typeId.replace('ns3::',''), source:'', field:row.layer === 'propagation' ? 'propagationId' : layer.field, attributes:row.attributes, parentTypeId:row.parentTypeId,groupName:row.groupName });
  }
  if (!layers.find(layer => layer.id === 'mac')?.items.length) throw new Error('当前 ns-3 未注册可用的 Aqua-Sim MAC');
  return JSON.stringify(layers);
 }
};`
await build({ input: 'aquasim-engine', plugins: [{ name: 'shared-simulator-engine', resolveId(id) { if (id === 'aquasim-engine') return '\0aquasim-engine' }, load(id) { if (id === '\0aquasim-engine') return source } }], output: { file: target, format: 'iife', sourcemap: false, minify: false } })
console.log('Bundled shared simulator generator into standalone/internal/simulator/engine.js')
