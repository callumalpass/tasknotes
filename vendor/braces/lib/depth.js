'use strict';

// Hard ceiling, deliberately independent of caller-supplied options. This is
// comfortably below the stack limit of the recursive upstream AST walkers.
const MAX_DEPTH = 128;

const assertDepth = depth => {
  if (depth > MAX_DEPTH) {
    const error = new SyntaxError(`Brace pattern nesting exceeds maximum depth (${MAX_DEPTH})`);
    error.code = 'ERR_BRACES_MAX_DEPTH';
    throw error;
  }
};

// Public methods also accept ASTs not created by our parser. Check child edges
// iteratively before entering a recursive walker; parent/prev backreferences
// in ordinary parser-produced ASTs are deliberately not traversed.
const assertAstDepth = ast => {
  const active = new Set();
  const stack = [{ node: ast, depth: 0, exit: false }];
  while (stack.length) {
    const { node, depth, exit } = stack.pop();
    if (!node || typeof node !== 'object' || !Array.isArray(node.nodes)) continue;
    if (exit) {
      active.delete(node);
      continue;
    }
    assertDepth(depth);
    if (active.has(node)) {
      const error = new SyntaxError('Cyclic brace AST');
      error.code = 'ERR_BRACES_AST_CYCLE';
      throw error;
    }
    active.add(node);
    stack.push({ node, depth, exit: true });
    for (let i = node.nodes.length - 1; i >= 0; i--) {
      stack.push({ node: node.nodes[i], depth: depth + 1, exit: false });
    }
  }
};

module.exports = { MAX_DEPTH, assertDepth, assertAstDepth };
