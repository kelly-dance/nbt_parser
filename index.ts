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

type test = string | number | test[];

const tagTypeNames = Object.keys(tagTypes) as (keyof typeof tagTypes)[];
type dataTypesStrings = 'Int8' | 'Uint8' | 'Int16' | 'Uint16' | 'Int32' | 'Uint32' | 'Float32' | 'Float64';
type getDataTypesStrings = 'getInt8' | 'getUint8' | 'getInt16' | 'getUint16' | 'getInt32' | 'getUint32' | 'getFloat32' | 'getFloat64';

type end = void;
type byte = number;
type ubyte = number;
type short = number;
type int = number;
type float = number;
type double = number;
type long = [number, number];
type byteArray = number[] | Uint8Array;
type intArray = number[];
type longArray = [number, number][];
type list = {type: keyof typeof tagTypes, value: value} | value[];
type compound = {[key: string]: ({type: keyof typeof tagTypes, value: value}) | value};
type value = end | byte | ubyte | short | int | float | double | long | byteArray | intArray | longArray | string | list | compound;

function hasGzipHeader(data: Uint8Array) {
  return data[0] === 0x1f && data[1] === 0x8b;
}

function decodeUTF8(array: Uint8Array) {
  const codepoints = [];
  for (let i = 0; i < array.length; i++) {
    if ((array[i] & 0x80) === 0) {
      codepoints.push(array[i] & 0x7F);
    } else if (i+1 < array.length &&
          (array[i]   & 0xE0) === 0xC0 &&
          (array[i+1] & 0xC0) === 0x80) {
      codepoints.push(
        ((array[i]   & 0x1F) << 6) |
        ( array[i+1] & 0x3F));
    } else if (i+2 < array.length &&
          (array[i]   & 0xF0) === 0xE0 &&
          (array[i+1] & 0xC0) === 0x80 &&
          (array[i+2] & 0xC0) === 0x80) {
      codepoints.push(
        ((array[i]   & 0x0F) << 12) |
        ((array[i+1] & 0x3F) <<  6) |
        ( array[i+2] & 0x3F));
    } else if (i+3 < array.length &&
          (array[i]   & 0xF8) === 0xF0 &&
          (array[i+1] & 0xC0) === 0x80 &&
          (array[i+2] & 0xC0) === 0x80 &&
          (array[i+3] & 0xC0) === 0x80) {
      codepoints.push(
        ((array[i]   & 0x07) << 18) |
        ((array[i+1] & 0x3F) << 12) |
        ((array[i+2] & 0x3F) <<  6) |
        ( array[i+3] & 0x3F));
    }
  }
  return String.fromCharCode(...codepoints);
}

class nbt{
  offset: number;
  dataView: DataView;
  arrayView: Uint8Array;
  showTypes: boolean;
  constructor (buffer: Uint8Array, showTypes: boolean){
    this.arrayView = buffer;
    this.dataView = new DataView(buffer.buffer);
    this.offset = 0;
    this.showTypes = showTypes;
  }
  read(type: dataTypesStrings, size: number){
    const val = this.dataView[('get' + type) as getDataTypesStrings](this.offset);
    this.offset += size;
    return val;
  }
  byte(): byte{
    return this.read('Int8', 1);
  }
  ubyte(): ubyte{
    return this.read('Uint8', 1);
  }
  short(): short{
    return this.read('Int16', 2);
  }
  int(): int{
    return this.read('Int32', 4);
  }
  float(): float{
    return this.read('Float32', 4);
  }
  double(): double{
    return this.read('Float64', 8);
  }
  long(): long{
    return [this.int(), this.int()];
  }
  byteArray(): byteArray{
    const length = this.int();
    const bytes = [];
    for (let i = 0; i < length; i++) bytes.push(this.byte());
    return bytes;
  }
  intArray(): intArray{
    const length = this.int();
    const ints = [];
    for (let i = 0; i < length; i++)  ints.push(this.int());
    return ints;
  }
  longArray(): longArray {
    const length = this.int();
    const longs = [];
    for (let i = 0; i < length; i++) longs.push(this.long());
    return longs;
  }
  string(): string {
    const length = this.short();
    const slice = this.arrayView.slice(this.offset, this.offset + length);
    this.offset += length;
    return decodeUTF8(slice);
  }
  list(): list {
    const type = this.byte();
    const length = this.int();
    const values = [];
    for (let i = 0; i < length; i++) values.push(this[tagTypeNames[type]]());
    return this.showTypes ? { type: tagTypeNames[type], value: values } : values;
  }
  compound(): compound {
    let values: compound = {};
    while (true) {
      const type = this.byte();
      if (type === tagTypes.end) break;
      const name = this.string();
      const value = this[tagTypeNames[type]]();
      values[name] = this.showTypes ? { type: tagTypeNames[type], value } : value;
    }
    return values;
  }
  end(){}
}

function parse(data: number[], showTypes: boolean = false){
  let arr = new Uint8Array(data);
  if(hasGzipHeader(arr)) arr = pako.inflate(arr);
  const reader = new nbt(arr, showTypes);
  const type = reader.byte();
  if(type !== tagTypes.compound) throw new Error('Top tag should be a compoud');
  reader.string();
  return reader.compound();
}

export default parse;