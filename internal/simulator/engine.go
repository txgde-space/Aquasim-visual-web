package simulator

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/dop251/goja"
)

//go:embed engine.js
var engineSource string
var compiled *goja.Program
var compileErr error
var compileOnce sync.Once

// Every operation gets an isolated VM. No filesystem/network/OS APIs are exposed.
func engineCall(method string, args ...any) (result goja.Value, err error) {
	compileOnce.Do(func() { compiled, compileErr = goja.Compile("aquasim-shared-generator", engineSource, true) })
	if compileErr != nil {
		return nil, compileErr
	}
	vm := goja.New()
	timer := time.AfterFunc(5*time.Second, func() { vm.Interrupt("代码生成超过时限") })
	defer timer.Stop()
	if _, err = vm.RunProgram(compiled); err != nil {
		return nil, err
	}
	obj := vm.Get("Aquasim").ToObject(vm)
	if method == "probe" || method == "sources" {
		return obj.Get(method), nil
	}
	callable, ok := goja.AssertFunction(obj.Get(method))
	if !ok {
		return nil, fmt.Errorf("unknown generator operation")
	}
	values := make([]goja.Value, len(args))
	for i, arg := range args {
		values[i] = vm.ToValue(arg)
	}
	return callable(obj, values...)
}
func probeSource() (string, error) {
	v, e := engineCall("probe")
	if e != nil {
		return "", e
	}
	return v.String(), nil
}
func parseCatalog(stdout string) (json.RawMessage, error) {
	v, e := engineCall("catalog", stdout)
	if e != nil {
		return nil, e
	}
	return json.RawMessage(v.String()), nil
}
func generate(spec any, catalog json.RawMessage, logName string) (string, error) {
	var layers any
	if e := json.Unmarshal(catalog, &layers); e != nil {
		return "", e
	}
	v, e := engineCall("generate", spec, layers, logName)
	if e != nil {
		return "", e
	}
	return v.String(), nil
}
