// Ambient declaration for esbuild's `.woff2` dataurl loader (see build.mjs).
// Not a real module — tsc just needs to know the default export is a string.
declare module '*.woff2' {
  const url: string;
  export default url;
}