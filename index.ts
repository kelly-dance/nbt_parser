import { inflate } from "https://deno.land/x/compress@v0.3.3/mod.ts";

export enum Tag{ end, byte, short, int, long, float, double, byteArray, string, list, compound, intArray, longArray };
export type Pair<Tg extends Tag, Type> = {type: Tg, value: Type};
export type List<T extends Tag> = (Pair<Tag.list, Types[T][]> & { listType: T }) | (Pair<Tag.list, []> & { listType: Tag.end });
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
  [Tag.compound]: Pair<Tag.compound, {[key in string]?: Types[Tag]}>;
  [Tag.intArray]: Pair<Tag.intArray, number[]>;
  [Tag.longArray]: Pair<Tag.longArray, bigint[]>;
}

export class NBTReader{
  data: DataView;
  offset: number = 0;

  constructor(data: Uint8Array){
    this.data = new DataView(data.buffer);
  }

  [Tag.end](){ return { value: 0, type: Tag.end } as Types[Tag.end]; }
  [Tag.byte](){
    const value = this.data.getInt8(this.offset);
    this.offset +=1 ;
    return { value, type: Tag.byte } as Types[Tag.byte];
  }
  [Tag.short](){
    const value = this.data.getInt16(this.offset);
    this.offset += 2;
    return { value, type: Tag.short } as Types[Tag.short];
  }
  [Tag.int]() {
    const value = this.data.getInt32(this.offset);
    this.offset += 4;
    return { value, type: Tag.int } as Types[Tag.int];
  }
  [Tag.long](){
    const value = this.data.getBigInt64(this.offset);
    this.offset += 4;
    return { value, type: Tag.long } as Types[Tag.long];
  }
  [Tag.float](){
    const value = this.data.getFloat32(this.offset);
    this.offset += 4;
    return { value, type: Tag.float } as Types[Tag.float];
  }
  [Tag.double](){
    const value = this.data.getFloat64(this.offset);
    this.offset += 8;
    return { value, type: Tag.double } as Types[Tag.double];
  }
  [Tag.byteArray](){
    const len = this[Tag.int]().value;
    const value: number[] = [];
    for(let i = 0; i < len; i++) value.push(this[Tag.byte]().value);
    return { value, type: Tag.byteArray } as Types[Tag.byteArray];
  }
  [Tag.string](){
    const len = this[Tag.short]().value;
    const slice = this.data.buffer.slice(this.offset, this.offset + len);
    this.offset += len;
    return { value: (new TextDecoder('utf-8')).decode(slice), type: Tag.string } as Types[Tag.string];
  }
  [Tag.list](){
    const type: Tag = this[Tag.byte]().value;
    const len = this[Tag.int]().value;
    const value: Types[Tag][] = [];
    for(let i = 0; i < len; i++) value.push(this[type]()); 
    return { value, type: Tag.list, listType: type } as Types[Tag.list];
  }
  [Tag.compound](){
    const tag: {[key: string]: Types[Tag]} = {};
    while(true){
      const type: Tag = this[Tag.byte]().value;
      if(type === Tag.end) break;
      tag[this[Tag.string]().value] = this[type]();
    }
    return { value: tag, type: Tag.compound } as Types[Tag.compound];
  }
  [Tag.intArray](){
    const len = this[Tag.int]().value;
    const value: number[] = [];
    for(let i = 0; i < len; i++) value.push(this[Tag.int]().value);
    return { value, type: Tag.intArray } as Types[Tag.intArray];
  }
  [Tag.longArray](){
    const len = this[Tag.int]().value;
    const value: bigint[] = [];
    for(let i = 0; i < len; i++) value.push(this[Tag.long]().value);
    return { value, type: Tag.longArray } as Types[Tag.longArray];
  }
}

export const parse = (data: Uint8Array) => {
  if(data[0] === 0x1f && data[1] === 0x8b) data = inflate(data);
  const reader = new NBTReader(data);
  const type: Tag = reader[Tag.byte]().value;
  if(type !== Tag.compound) throw new Error('Top tag should be a compoud');
  reader[Tag.string]();
  return reader[Tag.compound]();
}

export type SimplifiedType<T extends Types[Tag]> =
  T extends Types[Tag.list]
    ? T["value"] extends (infer R)[] ? R extends Types[Tag] ? SimplifiedType<R>[] : never : never
  : T extends Types[Tag.compound]
    ? { [K in keyof T['value']]: SimplifiedType<T['value'][K] extends Types[Tag] ? T['value'][K] : never> } 
    : T['value'];

export const simplify = <T extends Types[Tag]>(tag: T): SimplifiedType<T> => {
  if(tag.type === Tag.compound)
    return Object.fromEntries(Object.entries(tag.value).filter(([_, value]) => !!value).map(([key, value]) => {
      return [key, simplify(value as Types[Tag])]
    })) as any as SimplifiedType<T>;
  else if(tag.type === Tag.list)
    return (tag as any).value.map((v: any) => simplify(v)) as any as SimplifiedType<T>;
  else
    return tag.value as any as SimplifiedType<T>;
}

export type Constant<T extends Exclude<Tag, Tag.compound | Tag.list>, V> = V extends Types[T]['value'] ? [T, V] : never;
export type Blueprint = { [x: string]: Blueprint } | Tag | Blueprint[] | [Tag, Types[Tag]['value']] | undefined;
export type Create<T extends Blueprint> =
  T extends [infer A, infer B]
    ? { type: A, value: B }
  : T extends Blueprint[]
    ? { listType: T extends Tag ? T : T extends [any] ? Tag.list : Tag.compound, type: Tag.list, value: Create<T extends (infer I)[] ? I extends Blueprint ? I : never : never>[] }
  : T extends { [x: string]: Blueprint }
    ? { type: Tag.compound, value: { [K in keyof T]: Create<T[K]> }}
  : T extends Tag
    ? Types[T]
  : T extends undefined
    ? undefined
    : never
