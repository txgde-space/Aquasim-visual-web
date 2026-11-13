import assert from 'node:assert/strict'
import {h} from 'vue'
import {renderToString} from '@vue/server-renderer'

export async function checkSimulatorDiagnostics(server) {
  const [{simulatorFailure},{default:Settings}] = await Promise.all([
    '/src/features/experiment/lib/simulatorDiagnostics.ts','/src/features/experiment/components/SimulatorSettings.vue',
  ].map(file=>server.ssrLoadModule(file)))
  const compiler="error: PCH file '/test/cmake_pch.hxx.pch' built from a different branch ((clang-2100.3.34.2)) than the compiler ((clang-2100.4.1.1))"
  const raw='Error: 读取注册协议失败：\n\u001b[33m-- Using default output directory /test/build\u001b[0m\n'+compiler
  const failure=simulatorFailure(raw,'Finished executing ns3 build')
  assert.ok(failure.summary.length<100 && !failure.summary.includes('/test'))
  assert.match(failure.summary,/编译器版本.*预编译头/)
  assert.match(failure.details,/Finished executing/)
  assert.match(failure.details,/clang-2100.3.34.2/)
  assert.doesNotMatch(failure.details,/\u001b\[/)
  assert.deepEqual(simulatorFailure('compiler failed','useful compiler output'),{summary:'compiler failed',details:'useful compiler output'})
  const props={modelValue:'/test',defaultHome:'',checking:false,buildStatus:'fail',buildError:raw,buildLog:'Finished executing ns3 build',buildProgress:null,
    cleanStatus:'idle',cleanError:'',disabled:false,storageError:'',result:null}
  const html=await renderToString(h(Settings,props))
  assert.match(html,/<summary[^>]*>查看详情<\/summary>/)
  assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/,'failure details must start collapsed')
  const red=html.match(/<p class="directory-error"[^>]*>([\s\S]*?)<\/p>/)?.[1]
  assert.ok(red && red.length<160 && !red.includes('clang-'))
  assert.match(html,/<pre[^>]*>[\s\S]*clang-2100.4.1.1/,'full compiler diagnostics remain available in the details')
  const clean=await renderToString(h(Settings,{...props,buildStatus:'idle',buildError:'',cleanStatus:'fail',cleanError:'clean failed\n'+Array(30).fill('output').join('\n'),buildLog:'cleanup output'}))
  assert.match(clean,/清除构建失败，请查看详情/)
  assert.match(clean,/cleanup output/)
  console.log('Simulator diagnostics passed: concise red status, collapsed details, full catalog/compiler output, ANSI cleanup and legacy combined errors.')
}
