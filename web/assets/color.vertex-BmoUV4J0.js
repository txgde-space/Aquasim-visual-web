import{f as e}from"./math.scalar.functions-Cad0mLhT.js";import{t}from"./shaderStore-Co-je9bU.js";import"./bakedVertexAnimationDeclaration-C1sVEZUX.js";import"./bakedVertexAnimation-C4MqGst-.js";import"./instancesDeclaration-DppXgCSW.js";import"./instancesVertex-e_n3-KH_.js";import"./bonesDeclaration-CY19sFI4.js";import"./bonesVertex-0FSj_TBw.js";import"./clipPlaneVertex-JrCLGM7w.js";import"./clipPlaneVertexDeclaration-Z0bQCjQR.js";import"./fogVertexDeclaration-B4Iurh5G.js";import"./fogVertex-DpWO1FuC.js";import"./vertexColorMixing-C1ZvJ65b.js";var n=e({colorVertexShaderWGSL:()=>a}),r=`colorVertexShader`,i=`attribute position: vec3f;
#ifdef VERTEXCOLOR
attribute color: vec4f;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<clipPlaneVertexDeclaration>
#include<fogVertexDeclaration>
#ifdef FOG
uniform view: mat4x4f;
#endif
#include<instancesDeclaration>
uniform viewProjection: mat4x4f;
#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
varying vColor: vec4f;
#endif
#define CUSTOM_VERTEX_DEFINITIONS
@vertex
fn main(input : VertexInputs)->FragmentInputs {
#define CUSTOM_VERTEX_MAIN_BEGIN
#ifdef VERTEXCOLOR
var colorUpdated: vec4f=vertexInputs.color;
#endif
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
var worldPos: vec4f=finalWorld* vec4f(vertexInputs.position,1.0);vertexOutputs.position=uniforms.viewProjection*worldPos;
#include<clipPlaneVertex>
#include<fogVertex>
#include<vertexColorMixing>
#define CUSTOM_VERTEX_MAIN_END
}`;t.ShadersStoreWGSL[r]||(t.ShadersStoreWGSL[r]=i);var a={name:r,shader:i};export{n as t};