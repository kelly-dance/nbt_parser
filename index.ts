import { inflate } from "https://deno.land/x/compress@v0.3.3/mod.ts";

export enum Tag { end, byte, short, int, long, float, double, byteArray, string, list, compound, intArray, longArray };
type Pair<Tg extends Tag, Type> = { type: Tg, value: Type };
type List<T extends Tag> = T extends Tag.end ? Pair<Tag.list, []> & { listType: Tag.end } : (Pair<Tag.list, Types[T][]> & { listType: T }) | List<Tag.end>;
export type Types = {
  [Tag.end]: Pair<Tag.end, 0>;
  [Tag.byte]: Pair<Tag.byte, number>;
  [Tag.short]: Pair<Tag.short, number>;
  [Tag.int]: Pair<Tag.int, number>;
  [Tag.long]: Pair<Tag.long, bigint>;
  [Tag.float]: Pair<Tag.float, number>;
  [Tag.double]: Pair<Tag.double, number>;
  [Tag.byteArray]: Pair<Tag.byteArray, number[]>;
  [Tag.string]: Pair<Tag.string, string>;
  [Tag.list]: List<Tag>;
  [Tag.compound]: Pair<Tag.compound, {[key: string]: undefined | Types[Tag]}>;
  [Tag.intArray]: Pair<Tag.intArray, number[]>;
  [Tag.longArray]: Pair<Tag.longArray, bigint[]>;
}

class NBTReader {
  data: DataView;
  offset: number = 0;

  constructor(data: Uint8Array){
    this.data = new DataView(data.buffer);
  }

  [Tag.end](): Types[Tag.end] {
    return { value: 0, type: Tag.end };
  }
  [Tag.byte](): Types[Tag.byte] {
    const value = this.data.getInt8(this.offset);
    this.offset +=1 ;
    return { value, type: Tag.byte };
  }
  [Tag.short](): Types[Tag.short] {
    const value = this.data.getInt16(this.offset);
    this.offset += 2;
    return { value, type: Tag.short };
  }
  [Tag.int](): Types[Tag.int] {
    const value = this.data.getInt32(this.offset);
    this.offset += 4;
    return { value, type: Tag.int };
  }
  [Tag.long](): Types[Tag.long] {
    const value = this.data.getBigInt64(this.offset);
    this.offset += 8;
    return { value, type: Tag.long };
  }
  [Tag.float](): Types[Tag.float] {
    const value = this.data.getFloat32(this.offset);
    this.offset += 4;
    return { value, type: Tag.float };
  }
  [Tag.double](): Types[Tag.double] {
    const value = this.data.getFloat64(this.offset);
    this.offset += 8;
    return { value, type: Tag.double };
  }
  [Tag.byteArray](): Types[Tag.byteArray] {
    const len = this[Tag.int]().value;
    const value: number[] = [];
    for(let i = 0; i < len; i++) value.push(this[Tag.byte]().value);
    return { value, type: Tag.byteArray };
  }
  [Tag.string](): Types[Tag.string] {
    const len = this[Tag.short]().value;
    const slice = this.data.buffer.slice(this.offset, this.offset + len);
    this.offset += len;
    return { value: (new TextDecoder('utf-8')).decode(slice), type: Tag.string };
  }
  [Tag.list](): Types[Tag.list] {
    const type: Tag = this[Tag.byte]().value;
    if(!isValidTagType(type)) throw new Error(`Invalid Tag Type! type: ${type}`);
    const len = this[Tag.int]().value;
    const value: Types[Tag][] = [];
    for(let i = 0; i < len; i++) {
      const cur = this[type]();
      value.push(cur);
    }
    return { value, type: Tag.list, listType: type } as Types[Tag.list];
  }
  [Tag.compound](): Types[Tag.compound] {
    const tag: {[key: string]: Types[Tag]} = {};
    while(true){
      const type: Tag = this[Tag.byte]().value;
      if(!isValidTagType(type)) throw new Error(`Invalid Tag Type! type: ${type}`);
      if(type === Tag.end) break;
      const key = this[Tag.string]().value;
      const value = this[type]();
      tag[key] = value;
    }
    return { value: tag, type: Tag.compound };
  }
  [Tag.intArray](): Types[Tag.intArray] {
    const len = this[Tag.int]().value;
    const value: number[] = [];
    for(let i = 0; i < len; i++) value.push(this[Tag.int]().value);
    return { value, type: Tag.intArray };
  }
  [Tag.longArray](): Types[Tag.longArray] {
    const len = this[Tag.int]().value;
    const value: bigint[] = [];
    for(let i = 0; i < len; i++) value.push(this[Tag.long]().value);
    return { value, type: Tag.longArray };
  }
}

export const isValidTagType = (tag: number): tag is Tag => tag in Tag;

export const parse = (data: Uint8Array) => {
  if(data[0] === 0x1f && data[1] === 0x8b) data = inflate(data);
  const reader = new NBTReader(data);
  const type: Tag = reader[Tag.byte]().value;
  if(type !== Tag.compound) throw new Error('Top tag should be a compoud');
  reader[Tag.string]();
  return reader[Tag.compound]();
}

export const simplify = <T extends Types[Tag]>(tag: T): any => {
  if(tag.type === Tag.compound)
    return Object.fromEntries(Object.entries(tag.value).filter(([_, value]) => !!value).map(([key, value]) => {
      return [key, simplify(value as Types[Tag])]
    }));
  else if(tag.type === Tag.list)
    return (tag as any).value.map((v: any) => simplify(v));
  else
    return tag.value;
}
