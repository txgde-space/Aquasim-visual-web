import{f as e}from"./math.scalar.functions-Cad0mLhT.js";import{t}from"./shaderStore-Co-je9bU.js";import"./bonesDeclaration-BaCOnVGA.js";import"./bakedVertexAnimation-C7dk_TyU.js";import"./morphTargetsVertexGlobalDeclaration-CfsVrN6q.js";import"./morphTargetsVertexDeclaration-BitlvVPp.js";import"./morphTargetsVertexGlobal-DBtqMM7J.js";import"./morphTargetsVertex-BTrE16YZ.js";import"./bonesVertex-CGUqgW42.js";import"./instancesDeclaration-CvnSYUr_.js";import"./instancesVertex-CFVME-6E.js";var n=e({iblVoxelGridVertexShader:()=>a}),r=`iblVoxelGridVertexShader`,i=`attribute vec3 position;varying vec3 vNormalizedPosition;
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<instancesDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
uniform mat4 invWorldScale;uniform mat4 viewMatrix;void main(void) {vec3 positionUpdated=position;
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(positionUpdated,1.0);gl_Position=viewMatrix*invWorldScale*worldPos;vNormalizedPosition.xyz=gl_Position.xyz*0.5+0.5;
#ifdef IS_NDC_HALF_ZRANGE
gl_Position.z=gl_Position.z*0.5+0.5;
#endif
}`;t.ShadersStore[r]||(t.ShadersStore[r]=i);var a={name:r,shader:i};export{n as t};