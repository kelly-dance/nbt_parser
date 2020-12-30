import { inflate } from "https://deno.land/x/compress@v0.3.3/mod.ts";

export enum Tag{ end, byte, short, int, long, float, double, byteArray, string, list, compound, intArray, longArray };
export type Pair<Tg extends Tag, Type> = {type: Tg, value: Type};
export type List<T extends Tag> = Pair<Tag.list, Types[T][]> & {listType: Tag};
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
    return { value, type: Tag.list } as Types[Tag.list];
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

export type simplifiedTypes = {
  [Tag.list]: simplifiedMatcher<Exclude<Tag, Tag.list>>[] //this is bad and not nessesarily true
  [Tag.compound]: { [x: string]: simplifiedMatcher<Tag> }
}
export type simplifiedMatcher<T extends Tag> = T extends keyof simplifiedTypes ? simplifiedTypes[T] : Types[T]['value'];

export const simplify = <T extends Tag>(tag: Types[T]): simplifiedMatcher<T> => {
  if(tag.type === Tag.compound){
    return Object.fromEntries(Object.entries(tag.value).filter(([_, value]) => !!value).map(([key, value]) => {
      return [key, simplify(value as Types[Tag])]
    })) as any as simplifiedMatcher<T>;
  }else if(tag.type === Tag.list){
    return (tag as Types[Tag.list]).value.map(simplify)  as any as simplifiedMatcher<T>;;
  }else{
    return tag.value as any as simplifiedMatcher<T>;;
  }
}
