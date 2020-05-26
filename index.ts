import pako from 'https://raw.githubusercontent.com/mcbobby123/deno-pako/master/index.js';

const tagTypes = {
  'end': 0,
  'byte': 1,
  'short': 2,
  'int': 3,
  'long': 4,
  'float': 5,
  'double': 6,
  'byteArray': 7,
  'string': 8,
  'list': 9,
  'compound': 10,
  'intArray': 11,
  'longArray': 12
};
const tagTypeNames = Object.keys(tagTypes) as (keyof typeof tagTypes)[];
type dataTypesStrings = 'Int8' | 'Uint8' | 'Int16' | 'Uint16' | 'Int32' | 'Uint32' | 'Float32' | 'Float64';
type getDataTypesStrings = 'getInt8' | 'getUint8' | 'getInt16' | 'getUint16' | 'getInt32' | 'getUint32' | 'getFloat32' | 'getFloat64';
type value = {
  end: void;
  byte: number;
  ubyte: number;
  short: number;
  int: number;
  float: number;
  double: number;
  long: [number, number];
  byteArray: number[] | Uint8Array;
  intArray: number[];
  longArray: [number, number][];
  string: string;
  list: {type: keyof typeof tagTypes, value: value[keyof value][]};
  compound: {[key: string]: {type: keyof typeof tagTypes, value: value[keyof value]}};
}
type typePair<T, K extends keyof T> = {type: K, value: T[K]};

function hasGzipHeader(data: Uint8Array) {
  return data[0] === 0x1f && data[1] === 0x8b;
}

const decodeUTF8 = (src: ArrayLike<number>) => Array.prototype.map.call(src, n => String.fromCharCode(n)).join('');

class nbt{
  offset: number;
  dataView: DataView;
  arrayView: Uint8Array;
  constructor (buffer: Uint8Array){
    this.arrayView = buffer;
    this.dataView = new DataView(buffer.buffer);
    this.offset = 0;
  }
  read(type: dataTypesStrings, size: number){
    const val = this.dataView[('get' + type) as getDataTypesStrings](this.offset);
    this.offset += size;
    return val;
  }
  byte(): value['byte']{
    return this.read('Int8', 1);
  }
  ubyte(): value['ubyte']{
    return this.read('Uint8', 1);
  }
  short(): value['short']{
    return this.read('Int16', 2);
  }
  int(): value['int']{
    return this.read('Int32', 4);
  }
  float(): value['float']{
    return this.read('Float32', 4);
  }
  double(): value['double']{
    return this.read('Float64', 8);
  }
  long(): value['long']{
    return [this.int(), this.int()];
  }
  byteArray(): value['byteArray'] {
    const length = this.int();
    const bytes = [];
    for (let i = 0; i < length; i++) bytes.push(this.byte());
    return bytes;
  }
  intArray(): value['intArray'] {
    const length = this.int();
    const ints = [];
    for (let i = 0; i < length; i++)  ints.push(this.int());
    return ints;
  }
  longArray(): value['longArray'] {
    const length = this.int();
    const longs = [];
    for (let i = 0; i < length; i++) longs.push(this.long());
    return longs;
  }
  string(): value['string'] {
    const length = this.short();
    const slice = this.arrayView.slice(this.offset, this.offset + length);
    this.offset += length;
    return decodeUTF8(slice);
  }
  list(): value['list'] {
    const type = this.byte();
    const length = this.int();
    const values = [];
    for (let i = 0; i < length; i++) values.push(this[tagTypeNames[type]]());
    return { type: tagTypeNames[type], value: values };
  }
  compound(): value['compound'] {
    let values: value['compound'] = {};
    while (true) {
      const type = this.byte();
      if (type === tagTypes.end) break;
      const name = this.string();
      const value = this[tagTypeNames[type]]();
      values[name] = { type: tagTypeNames[type], value: value };
    }
    return values;
  }
  end(){}
}

function parse(data: number[]){
  let arr = new Uint8Array(data);
  if(hasGzipHeader(arr)) arr = pako.inflate(arr);
  const reader = new nbt(arr);
  const type = reader.byte();
  if(type !== tagTypes.compound) throw new Error('Top tag should be a compoud');
  return {
    name: reader.string(),
    value: reader.compound(),
  }
}

export default parse;