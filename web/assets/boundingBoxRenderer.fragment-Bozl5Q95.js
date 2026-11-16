import{f as e}from"./math.scalar.functions-Cad0mLhT.js";import{t}from"./shaderStore-Co-je9bU.js";var n=e({boundingBoxRendererPixelShaderWGSL:()=>a}),r=`boundingBoxRendererPixelShader`,i=`uniform color: vec4f;
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
fragmentOutputs.color=uniforms.color;
#define CUSTOM_FRAGMENT_MAIN_END
}`;t.ShadersStoreWGSL[r]||(t.ShadersStoreWGSL[r]=i);var a={name:r,shader:i};export{n as t};