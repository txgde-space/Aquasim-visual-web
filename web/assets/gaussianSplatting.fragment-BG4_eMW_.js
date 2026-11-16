import{f as e}from"./math.scalar.functions-Cad0mLhT.js";import{t}from"./shaderStore-Co-je9bU.js";import"./clipPlaneFragment-pIKm9rE-.js";import"./clipPlaneFragmentDeclaration-9E8fAWCL.js";import"./fogFragmentDeclaration-BL7fnEDE.js";import"./logDepthDeclaration-D5TxzFaM.js";import"./logDepthFragment-CGbfpt33.js";import"./fogFragment-C7dz37xo.js";var n=`gaussianSplattingFragmentDeclaration`,r=`vec4 gaussianColor(vec4 inColor)
{float A=-dot(vPosition,vPosition);if (A<-4.0) discard;float B=exp(A)*inColor.a;
#include<logDepthFragment>
vec3 color=inColor.rgb;
#ifdef FOG
#include<fogFragment>
#endif
return vec4(color,B);}
`;t.IncludesShadersStore[n]||(t.IncludesShadersStore[n]=r);var i=e({gaussianSplattingPixelShader:()=>s}),a=`gaussianSplattingPixelShader`,o=`#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>
varying vec4 vColor;varying vec2 vPosition;
#define CUSTOM_FRAGMENT_DEFINITIONS
#include<gaussianSplattingFragmentDeclaration>
void main () {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
vec4 finalColor=gaussianColor(vColor);
#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR
gl_FragColor=finalColor;
#define CUSTOM_FRAGMENT_MAIN_END
}
`;t.ShadersStore[a]||(t.ShadersStore[a]=o);var s={name:a,shader:o};export{i as t};