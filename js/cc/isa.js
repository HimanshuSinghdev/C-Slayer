/* C-Slayer · instruction set shared by the compiler and the VM.
 * A stack machine. Operand-stack values are JS numbers (int/uint/float/double/pointer) or BigInts (64-bit ints).
 * Value classes: 0 I (int32) · 1 U (uint32 / pointer) · 2 L (int64) · 3 UL (uint64) · 4 F (float32) · 5 D (double)
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};

  const NAMES = [
    // stack & constants
    'ICONST', 'KCONST', 'POP', 'DUP', 'DUPX1', 'SWAP',
    // locals (frame-relative) and memory
    'LEAL', 'LLOAD', 'LSTORE', 'LSTOREP', 'LOAD', 'STORE', 'STOREP',
    // int32 arithmetic
    'ADD_I', 'SUB_I', 'MUL_I', 'DIV_I', 'MOD_I', 'AND_I', 'OR_I', 'XOR_I', 'SHL_I', 'SHR_I',
    // uint32 / pointer arithmetic
    'ADD_U', 'SUB_U', 'MUL_U', 'DIV_U', 'MOD_U', 'AND_U', 'OR_U', 'XOR_U', 'SHL_U', 'SHR_U',
    // int64
    'ADD_L', 'SUB_L', 'MUL_L', 'DIV_L', 'MOD_L', 'AND_L', 'OR_L', 'XOR_L', 'SHL_L', 'SHR_L',
    // uint64
    'ADD_UL', 'SUB_UL', 'MUL_UL', 'DIV_UL', 'MOD_UL', 'AND_UL', 'OR_UL', 'XOR_UL', 'SHL_UL', 'SHR_UL',
    // float / double
    'ADD_F', 'SUB_F', 'MUL_F', 'DIV_F', 'ADD_D', 'SUB_D', 'MUL_D', 'DIV_D',
    // comparisons: EQ NE LT GT LE GE for each class
    'EQ_I', 'NE_I', 'LT_I', 'GT_I', 'LE_I', 'GE_I',
    'EQ_U', 'NE_U', 'LT_U', 'GT_U', 'LE_U', 'GE_U',
    'EQ_L', 'NE_L', 'LT_L', 'GT_L', 'LE_L', 'GE_L',
    'EQ_F', 'NE_F', 'LT_F', 'GT_F', 'LE_F', 'GE_F',
    // unary: NEG BNOT LNOT TOBOOL, one per class (operand = class)
    'NEG', 'BNOT', 'LNOT', 'TOBOOL', 'CONV', 'NARROW',
    // control
    'JMP', 'JZ', 'JNZ', 'SWITCH', 'CALL', 'CALLI', 'CALLB', 'ENTER', 'RET',
    // memory blocks
    'MEMCPY', 'MEMZERO', 'ALLOCA', 'LINE', 'HALT',
    // fused (created only by the post-pass in compile.js; never emitted directly)
    'JCLL', 'JCLC', 'ADDLC', 'JCMP'
  ];
  const OP = {};
  NAMES.forEach((n, i) => { OP[n] = i; });

  // number of inline operands for each op
  const ARGS = new Array(NAMES.length).fill(0);
  const set = (names, n) => names.forEach(x => { ARGS[OP[x]] = n; });
  set(['ICONST', 'KCONST', 'LEAL', 'LOAD', 'STORE', 'STOREP', 'NEG', 'BNOT', 'LNOT', 'TOBOOL', 'CONV', 'NARROW', 'JMP', 'JZ', 'JNZ', 'SWITCH', 'CALLI', 'ENTER', 'MEMCPY', 'MEMZERO', 'ALLOCA', 'LINE'], 1);
  set(['LLOAD', 'LSTORE', 'LSTOREP', 'CALL', 'CALLB', 'ADDLC'], 2);
  set(['JCLL', 'JCLC'], 4);
  set(['JCMP'], 2);

  const CLS = { I: 0, U: 1, L: 2, UL: 3, F: 4, D: 5 };
  const BINOP = { '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV', '%': 'MOD', '&': 'AND', '|': 'OR', '^': 'XOR', '<<': 'SHL', '>>': 'SHR' };
  const CMPOP = { '==': 'EQ', '!=': 'NE', '<': 'LT', '>': 'GT', '<=': 'LE', '>=': 'GE' };
  const CLSNAME = ['I', 'U', 'L', 'UL', 'F', 'D'];

  CC.OP = OP; CC.OPNAMES = NAMES; CC.OPARGS = ARGS; CC.CLS = CLS; CC.BINOP = BINOP; CC.CMPOP = CMPOP; CC.CLSNAME = CLSNAME;

  /** opcode for a binary arithmetic operator on a value class */
  CC.binOpcode = function (op, cls) {
    const nm = BINOP[op] + '_' + CLSNAME[cls];
    return OP[nm];
  };
  /** opcode for a comparison on a value class (UL compares like L unsigned handled by BigInt semantics, D like F) */
  CC.cmpOpcode = function (op, cls) {
    const c = cls === 3 ? 'L' : cls === 5 ? 'F' : CLSNAME[cls];
    return OP[CMPOP[op] + '_' + c];
  };

  // memory kinds
  CC.MEM = { LOW: 0x10000, RO_BASE: 0x10000, RO_SIZE: 0x100000, FUNC_BASE: 0x1000, FUNC_STRIDE: 16 };
})(typeof globalThis !== 'undefined' ? globalThis : self);
