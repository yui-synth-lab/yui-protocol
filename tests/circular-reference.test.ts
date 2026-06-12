import { describe, it, expect } from 'vitest';
import { removeCircularReferences } from '../src/kernel/session-storage.js';

describe('removeCircularReferences', () => {
  describe('primitive values', () => {
    it('should pass through string unchanged', () => {
      const input = 'hello';
      const result = removeCircularReferences(input);
      expect(result).toBe('hello');
    });

    it('should pass through number unchanged', () => {
      const input = 42;
      const result = removeCircularReferences(input);
      expect(result).toBe(42);
    });

    it('should pass through boolean unchanged', () => {
      const input = true;
      const result = removeCircularReferences(input);
      expect(result).toBe(true);
    });

    it('should pass through null unchanged', () => {
      const input = null;
      const result = removeCircularReferences(input);
      expect(result).toBeNull();
    });
  });

  describe('special object types', () => {
    it('should convert Date to ISO string', () => {
      const date = new Date('2023-01-15T10:30:00Z');
      const result = removeCircularReferences(date);
      expect(result).toBe('2023-01-15T10:30:00.000Z');
    });

    it('should convert Symbol to string', () => {
      const sym = Symbol('test');
      const result = removeCircularReferences(sym);
      expect(result).toBe('Symbol(test)');
    });

    it('should pass through Function unchanged (typeof check)', () => {
      const func = () => {};
      const result = removeCircularReferences(func);
      // Functions have typeof 'function', so they pass through unchanged
      // before the explicit function type check
      expect(typeof result).toBe('function');
      expect(result).toBe(func);
    });

    it('should convert RegExp to [RegExp]', () => {
      const regex = /test/g;
      const result = removeCircularReferences(regex);
      expect(result).toBe('[RegExp]');
    });

    it('should convert Error to [Error]', () => {
      const error = new Error('test error');
      const result = removeCircularReferences(error);
      expect(result).toBe('[Error]');
    });

    it('should convert Map to [Map]', () => {
      const map = new Map([['key', 'value']]);
      const result = removeCircularReferences(map);
      expect(result).toBe('[Map]');
    });

    it('should convert Set to [Set]', () => {
      const set = new Set([1, 2, 3]);
      const result = removeCircularReferences(set);
      expect(result).toBe('[Set]');
    });
  });

  describe('true circular references', () => {
    it('should detect self-reference', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      const result = removeCircularReferences(obj);
      expect(result.name).toBe('test');
      expect(result.self).toBe('[Circular Reference]');
    });

    it('should detect mutual circular references', () => {
      const obj1: any = { name: 'obj1' };
      const obj2: any = { name: 'obj2' };
      obj1.ref = obj2;
      obj2.ref = obj1;
      const result = removeCircularReferences(obj1);
      expect(result.name).toBe('obj1');
      expect((result.ref as any).name).toBe('obj2');
      expect((result.ref as any).ref).toBe('[Circular Reference]');
    });

    it('should detect nested circular reference in array', () => {
      const obj: any = { items: [] };
      obj.items.push(obj);
      const result = removeCircularReferences(obj);
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items[0]).toBe('[Circular Reference]');
    });
  });

  describe('shared references (non-cyclic DAG)', () => {
    it('should serialize shared object reference at both locations', () => {
      const sharedObj = { value: 'shared' };
      const container = { ref1: sharedObj, ref2: sharedObj };
      const result = removeCircularReferences(container);
      expect((result.ref1 as any).value).toBe('shared');
      expect((result.ref2 as any).value).toBe('shared');
      // Both should be objects, not '[Circular Reference]'
      expect(typeof result.ref1).toBe('object');
      expect(typeof result.ref2).toBe('object');
    });

    it('should serialize array with shared object reference', () => {
      const sharedObj = { id: 1, name: 'shared' };
      const array = [sharedObj, sharedObj, { id: 2 }];
      const result = removeCircularReferences(array);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect((result[0] as any).id).toBe(1);
      expect((result[1] as any).id).toBe(1);
      expect((result[2] as any).id).toBe(2);
      // All should be objects, not '[Circular Reference]'
      expect(typeof result[0]).toBe('object');
      expect(typeof result[1]).toBe('object');
    });

    it('should serialize deeply nested objects with shared reference', () => {
      const shared = { content: 'shared data' };
      const nested = {
        level1: {
          level2: {
            ref: shared
          }
        },
        otherRef: shared
      };
      const result = removeCircularReferences(nested);
      expect(((result.level1 as any).level2 as any).ref as any).toEqual({ content: 'shared data' });
      expect((result.otherRef as any).content).toBe('shared data');
    });
  });

  describe('real-world session data structure (the bug case)', () => {
    it('should handle metadata with shared array references', () => {
      const sharedArray = ['ref1', 'ref2', 'ref3'];
      const metadata = {
        reasoning: 'test reasoning',
        references: sharedArray,
        assumptions: sharedArray,
        confidence: 0.8
      };
      const result = removeCircularReferences(metadata);

      // Both references and assumptions should be arrays
      expect(Array.isArray(result.references)).toBe(true);
      expect(Array.isArray(result.assumptions)).toBe(true);

      // Contents should match
      expect(result.references).toEqual(['ref1', 'ref2', 'ref3']);
      expect(result.assumptions).toEqual(['ref1', 'ref2', 'ref3']);

      // Should NOT be '[Circular Reference]'
      expect(result.references).not.toBe('[Circular Reference]');
      expect(result.assumptions).not.toBe('[Circular Reference]');
    });

    it('should handle complex message-like structure with shared metadata', () => {
      const sharedMetadataArray = ['logical reasoning', 'systematic analysis'];
      const message = {
        id: 'msg-123',
        agentId: 'agent-1',
        content: 'This is the message content',
        metadata: {
          reasoning: 'I approached this logically',
          references: sharedMetadataArray,
          assumptions: sharedMetadataArray,
          stageData: {
            agentId: 'agent-1',
            references: sharedMetadataArray,
            assumptions: sharedMetadataArray
          }
        }
      };

      const result = removeCircularReferences(message);

      // All array references should be properly serialized
      expect(Array.isArray((result.metadata as any).references)).toBe(true);
      expect(Array.isArray((result.metadata as any).assumptions)).toBe(true);
      expect(Array.isArray(((result.metadata as any).stageData as any).references)).toBe(true);
      expect(Array.isArray(((result.metadata as any).stageData as any).assumptions)).toBe(true);

      // None should be '[Circular Reference]'
      expect((result.metadata as any).references).not.toBe('[Circular Reference]');
      expect((result.metadata as any).assumptions).not.toBe('[Circular Reference]');
      expect(((result.metadata as any).stageData as any).references).not.toBe('[Circular Reference]');
      expect(((result.metadata as any).stageData as any).assumptions).not.toBe('[Circular Reference]');
    });

    it('should serialize to valid JSON', () => {
      const sharedArray = ['a', 'b', 'c'];
      const obj = {
        id: '1',
        refs: sharedArray,
        assumptions: sharedArray,
        nested: { arr: sharedArray }
      };

      const result = removeCircularReferences(obj);

      // Should be able to JSON.stringify without errors
      expect(() => JSON.stringify(result)).not.toThrow();

      const jsonString = JSON.stringify(result);
      const reparsed = JSON.parse(jsonString);

      expect(reparsed.id).toBe('1');
      expect(reparsed.refs).toEqual(['a', 'b', 'c']);
      expect(reparsed.assumptions).toEqual(['a', 'b', 'c']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty object', () => {
      const obj = {};
      const result = removeCircularReferences(obj);
      expect(result).toEqual({});
    });

    it('should handle empty array', () => {
      const arr = [];
      const result = removeCircularReferences(arr);
      expect(result).toEqual([]);
    });

    it('should handle object with undefined values', () => {
      const obj = { a: 'test', b: undefined };
      const result = removeCircularReferences(obj);
      expect(result.a).toBe('test');
      expect(result.b).toBeUndefined();
    });

    it('should handle deeply nested structure without cycles', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep'
              }
            }
          }
        }
      };
      const result = removeCircularReferences(obj);
      expect(((((result.level1 as any).level2 as any).level3 as any).level4 as any).value).toBe('deep');
    });

    it('should handle mixed types in array', () => {
      const obj = { shared: 'ref' };
      const arr = [obj, 'string', 42, true, null, obj];
      const result = removeCircularReferences(arr);
      expect(result.length).toBe(6);
      expect((result[0] as any).shared).toBe('ref');
      expect(result[1]).toBe('string');
      expect(result[2]).toBe(42);
      expect(result[3]).toBe(true);
      expect(result[4]).toBeNull();
      expect((result[5] as any).shared).toBe('ref');
    });
  });
});
