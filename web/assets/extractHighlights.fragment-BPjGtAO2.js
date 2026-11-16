import{f as e}from"./math.scalar.functions-Cad0mLhT.js";import{t}from"./shaderStore-Co-je9bU.js";import"./helperFunctions-c-jI7M-T.js";var n=e({extractHighlightsPixelShader:()=>a}),r=`extractHighlightsPixelShader`,i=`#include<helperFunctions>
varying vec2 vUV;uniform sampler2D textureSampler;uniform float threshold;uniform float exposure;
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) 
{gl_FragColor=texture2D(textureSampler,vUV);float luma=dot(LuminanceEncodeApprox,gl_FragColor.rgb*exposure);gl_FragColor.rgb=step(threshold,luma)*gl_FragColor.rgb;}`;t.ShadersStore[r]||(t.ShadersStore[r]=i);var a={name:r,shader:i};export{n as t};