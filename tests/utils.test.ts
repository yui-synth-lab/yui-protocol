import { describe, it, expect } from 'vitest';
import { removeCircularReferences } from '../src/kernel/session-storage.js';

describe('Utility Functions', () => {
  describe('removeCircularReferences', () => {
    it('should remove circular references from objects', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      obj.nested = { parent: obj };

      const cleaned = removeCircularReferences(obj);

      expect(cleaned.name).toBe('test');
      expect(cleaned.self).toBe('[Circular Reference]');
      expect(cleaned.nested.parent).toBe('[Circular Reference]');
    });

    it('should handle arrays with circular references', () => {
      const arr: any = [1, 2, 3];
      arr.push(arr);
      arr.push({ backToArray: arr });

      const cleaned = removeCircularReferences(arr);

      expect(cleaned[0]).toBe(1);
      expect(cleaned[1]).toBe(2);
      expect(cleaned[2]).toBe(3);
      expect(cleaned[3]).toBe('[Circular Reference]');
      expect(cleaned[4].backToArray).toBe('[Circular Reference]');
    });

    it('should convert Date objects to ISO strings', () => {
      const date = new Date('2023-01-01T00:00:00.000Z');
      const obj = {
        date,
        nested: { date }
      };

      const cleaned = removeCircularReferences(obj);

      expect(cleaned.date).toBe('2023-01-01T00:00:00.000Z');
      expect(cleaned.nested.date).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should handle null and undefined values', () => {
      const obj = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zero: 0,
        falseValue: false
      };

      const cleaned = removeCircularReferences(obj);

      expect(cleaned.nullValue).toBeNull();
      expect(cleaned.undefinedValue).toBeUndefined();
      expect(cleaned.emptyString).toBe('');
      expect(cleaned.zero).toBe(0);
      expect(cleaned.falseValue).toBe(false);
    });

    it('should handle primitive values', () => {
      const obj = {
        string: 'test',
        number: 42,
        boolean: true,
        symbol: Symbol('test')
      };

      const cleaned = removeCircularReferences(obj);

      expect(cleaned.string).toBe('test');
      expect(cleaned.number).toBe(42);
      expect(cleaned.boolean).toBe(true);
      expect(cleaned.symbol).toBe('Symbol(test)');
    });

    it('should handle nested objects and arrays', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              value: 'deep'
            }
          }
        },
        array: [
          { item: 1 },
          { item: 2 },
          { nested: { value: 'array' } }
        ]
      };

      const cleaned = removeCircularReferences(obj);

      expect(cleaned.level1.level2.level3.value).toBe('deep');
      expect(cleaned.array[0].item).toBe(1);
      expect(cleaned.array[1].item).toBe(2);
      expect(cleaned.array[2].nested.value).toBe('array');
    });

    it('should handle complex circular reference scenarios', () => {
      const obj1: any = { name: 'obj1' };
      const obj2: any = { name: 'obj2' };
      const obj3: any = { name: 'obj3' };

      obj1.ref1 = obj2;
      obj2.ref2 = obj3;
      obj3.ref3 = obj1;
      obj1.ref4 = obj1;

      const cleaned = removeCircularReferences(obj1);

      expect(cleaned.name).toBe('obj1');
      expect(cleaned.ref1.name).toBe('obj2');
      expect(cleaned.ref1.ref2.name).toBe('obj3');
      expect(cleaned.ref1.ref2.ref3).toBe('[Circular Reference]');
      expect(cleaned.ref4).toBe('[Circular Reference]');
    });

    it('should handle functions and other non-serializable types', () => {
      const obj = {
        func: () => 'test',
        regex: /test/,
        error: new Error('test'),
        map: new Map([['key', 'value']]),
        set: new Set([1, 2, 3])
      };

      const cleaned = removeCircularReferences(obj);

      expect(
        typeof cleaned.func === 'function' ||
        (typeof cleaned.func === 'string' && cleaned.func.startsWith('[Function'))
      ).toBe(true);
      expect(cleaned.regex).toBe('[RegExp]');
      expect(cleaned.error).toBe('[Error]');
      expect(cleaned.map).toBe('[Map]');
      expect(cleaned.set).toBe('[Set]');
    });

    it('should handle empty objects and arrays', () => {
      const obj = {
        emptyObj: {},
        emptyArr: [],
        nestedEmpty: { empty: {} }
      };

      const cleaned = removeCircularReferences(obj);

      expect(cleaned.emptyObj).toEqual({});
      expect(cleaned.emptyArr).toEqual([]);
      expect(cleaned.nestedEmpty.empty).toEqual({});
    });

    it('should preserve object structure', () => {
      const original = {
        a: 1,
        b: { c: 2, d: [3, 4] },
        e: { f: { g: 5 } }
      };

      const cleaned = removeCircularReferences(original);

      expect(cleaned).toEqual(original);
      expect(cleaned.b).toEqual({ c: 2, d: [3, 4] });
      expect(cleaned.e.f.g).toBe(5);
    });
  });
}); 