/*
  config.js — app settings that you may want to change without touching code.

  RULE: only js/views/graph.js reads the `graphing` section. No other file may
  know which graphing library is used.

  Desmos (or another library) can be added back later by changing `provider`
  here and the inside of graph.js. Nothing else in the app needs to change.
*/

export const config = {
  graphing: {
    // Which library graph.js should use. Only "jsxgraph" is implemented for now.
    // JSXGraph is loaded from a CDN in index.html and needs no API key.
    provider: "jsxgraph",
  },
};
