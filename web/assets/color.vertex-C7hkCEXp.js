import{f as e}from"./math.scalar.functions-Cad0mLhT.js";import{t}from"./shaderStore-Co-je9bU.js";import"./bonesDeclaration-BaCOnVGA.js";import"./bakedVertexAnimation-C7dk_TyU.js";import"./bonesVertex-CGUqgW42.js";import"./clipPlaneVertex-DuEqBTbd.js";import"./clipPlaneVertexDeclaration-BYIfVny6.js";import"./instancesDeclaration-CvnSYUr_.js";import"./fogVertexDeclaration-C1L6E0TG.js";import"./instancesVertex-CFVME-6E.js";import"./fogVertex-lVDC1f--.js";import"./vertexColorMixing-ChnuQnPS.js";var n=e({colorVertexShader:()=>a}),r=`colorVertexShader`,i=`attribute vec3 position;
#ifdef VERTEXCOLOR
attribute vec4 color;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<clipPlaneVertexDeclaration>
#include<fogVertexDeclaration>
#ifdef FOG
uniform mat4 view;
#endif
#include<instancesDeclaration>
uniform mat4 viewProjection;
#ifdef MULTIVIEW
uniform mat4 viewProjectionR;
#endif
#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
varying vec4 vColor;
#endif
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
#ifdef VERTEXCOLOR
vec4 colorUpdated=color;
#endif
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(position,1.0);
#ifdef MULTIVIEW
if (gl_ViewID_OVR==0u) {gl_Position=viewProjection*worldPos;} else {gl_Position=viewProjectionR*worldPos;}
#else
gl_Position=viewProjection*worldPos;
#endif
#include<clipPlaneVertex>
#include<fogVertex>
#include<vertexColorMixing>
#define CUSTOM_VERTEX_MAIN_END
}`;t.ShadersStore[r]||(t.ShadersStore[r]=i);var a={name:r,shader:i};export{n as t};