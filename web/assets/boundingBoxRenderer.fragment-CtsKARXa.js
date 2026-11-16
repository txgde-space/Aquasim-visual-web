import{f as e}from"./math.scalar.functions-Cad0mLhT.js";import{t}from"./shaderStore-Co-je9bU.js";import"./boundingBoxRendererUboDeclaration-D4bWSj1y.js";var n=`boundingBoxRendererFragmentDeclaration`,r=`uniform vec4 color;
`;t.IncludesShadersStore[n]||(t.IncludesShadersStore[n]=r);var i=e({boundingBoxRendererPixelShader:()=>s}),a=`boundingBoxRendererPixelShader`,o=`#include<__decl__boundingBoxRendererFragment>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
gl_FragColor=color;
#define CUSTOM_FRAGMENT_MAIN_END
}`;t.ShadersStore[a]||(t.ShadersStore[a]=o);var s={name:a,shader:o};export{i as t};