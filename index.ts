import { inflate } from "https://deno.land/x/compress@v0.3.3/mod.ts";

export enum TagTypes{ end, byte, short, int, long, float, double, byteArray, string, list, compound, intArray, longArray };
export type Pair<Tag, Type> = {type: Tag, value: Type};
export type List<Tag extends TagTypes> = Pair<TagTypes.list, TagTypeTypes[Tag][]> & {listType: Tag};
export type TagTypeTypes = {
  [TagTypes.end]: Pair<TagTypes.end, 0>;
  [TagTypes.byte]: Pair<TagTypes.byte, number>;
  [TagTypes.short]: Pair<TagTypes.short, number>;
  [TagTypes.int]: Pair<TagTypes.int, number>;
  [TagTypes.long]: Pair<TagTypes.long, bigint>;
  [TagTypes.float]: Pair<TagTypes.float, number>;
  [TagTypes.double]: Pair<TagTypes.double, number>;
  [TagTypes.byteArray]: Pair<TagTypes.byteArray, number[]>;
  [TagTypes.string]: Pair<TagTypes.string, string>;
  [TagTypes.list]: List<TagTypes>;
  [TagTypes.compound]: Pair<TagTypes.compound, {[key in string]?: TagTypeTypes[TagTypes]}>;
  [TagTypes.intArray]: Pair<TagTypes.intArray, number[]>;
  [TagTypes.longArray]: Pair<TagTypes.longArray, bigint[]>;
}

export class NBTReader{
  data: DataView;
  offset: number = 0;

  constructor(data: Uint8Array){
    this.data = new DataView(data.buffer);
  }

  [TagTypes.end](){ return { value: 0, type: TagTypes.end } as TagTypeTypes[TagTypes.end]; }
  [TagTypes.byte](){
    const value = this.data.getInt8(this.offset);
    this.offset +=1 ;
    return { value, type: TagTypes.byte } as TagTypeTypes[TagTypes.byte];
  }
  [TagTypes.short](){
    const value = this.data.getInt16(this.offset);
    this.offset += 2;
    return { value, type: TagTypes.short } as TagTypeTypes[TagTypes.short];
  }
  [TagTypes.int]() {
    const value = this.data.getInt32(this.offset);
    this.offset += 4;
    return { value, type: TagTypes.int } as TagTypeTypes[TagTypes.int];
  }
  [TagTypes.long](){
    const value = this.data.getBigInt64(this.offset);
    this.offset += 4;
    return { value, type: TagTypes.long } as TagTypeTypes[TagTypes.long];
  }
  [TagTypes.float](){
    const value = this.data.getFloat32(this.offset);
    this.offset += 4;
    return { value, type: TagTypes.float } as TagTypeTypes[TagTypes.float];
  }
  [TagTypes.double](){
    const value = this.data.getFloat64(this.offset);
    this.offset += 8;
    return { value, type: TagTypes.double } as TagTypeTypes[TagTypes.double];
  }
  [TagTypes.byteArray](){
    const len = this[TagTypes.int]().value;
    const value: number[] = [];
    for(let i = 0; i < len; i++) value.push(this[TagTypes.byte]().value);
    return { value, type: TagTypes.byteArray } as TagTypeTypes[TagTypes.byteArray];
  }
  [TagTypes.string](){
    const len = this[TagTypes.short]().value;
    const slice = this.data.buffer.slice(this.offset, this.offset + len);
    this.offset += len;
    return { value: (new TextDecoder('utf-8')).decode(slice), type: TagTypes.string } as TagTypeTypes[TagTypes.string];
  }
  [TagTypes.list](){
    const type: TagTypes = this[TagTypes.byte]().value;
    const len = this[TagTypes.int]().value;
    const value: TagTypeTypes[TagTypes][] = [];
    for(let i = 0; i < len; i++) value.push(this[type]()); 
    return { value, type: TagTypes.list } as TagTypeTypes[TagTypes.list];
  }
  [TagTypes.compound](){
    const tag: {[key: string]: TagTypeTypes[TagTypes]} = {};
    while(true){
      const type: TagTypes = this[TagTypes.byte]().value;
      if(type === TagTypes.end) break;
      tag[this[TagTypes.string]().value] = this[type]();
    }
    return { value: tag, type: TagTypes.compound } as TagTypeTypes[TagTypes.compound];
  }
  [TagTypes.intArray](){
    const len = this[TagTypes.int]().value;
    const value: number[] = [];
    for(let i = 0; i < len; i++) value.push(this[TagTypes.int]().value);
    return { value, type: TagTypes.intArray } as TagTypeTypes[TagTypes.intArray];
  }
  [TagTypes.longArray](){
    const len = this[TagTypes.int]().value;
    const value: bigint[] = [];
    for(let i = 0; i < len; i++) value.push(this[TagTypes.long]().value);
    return { value, type: TagTypes.longArray } as TagTypeTypes[TagTypes.longArray];
  }
}

export const parse = (data: Uint8Array) => {
  if(data[0] === 0x1f && data[1] === 0x8b) data = inflate(data);
  const reader = new NBTReader(data);
  const type: TagTypes = reader[TagTypes.byte]().value;
  if(type !== TagTypes.compound) throw new Error('Top tag should be a compoud');
  reader[TagTypes.string]();
  return reader[TagTypes.compound]();
}

export type simplifiedTypes = {
  [TagTypes.list]: simplifiedMatcher<Exclude<TagTypes, TagTypes.list>>[] //this is bad and not nessesarily true
  [TagTypes.compound]: { [x: string]: simplifiedMatcher<TagTypes> }
}
export type simplifiedMatcher<T extends TagTypes> = T extends keyof simplifiedTypes ? simplifiedTypes[T] : TagTypeTypes[T]['value'];

export const simplify = <T extends TagTypes>(tag: TagTypeTypes[T]): simplifiedMatcher<T> => {
  if(tag.type === TagTypes.compound){
    return Object.fromEntries(Object.entries(tag.value).filter(([_, value]) => !!value).map(([key, value]) => {
      return [key, simplify(value as TagTypeTypes[TagTypes])]
    })) as any as simplifiedMatcher<T>;
  }else if(tag.type === TagTypes.list){
    return (tag as TagTypeTypes[TagTypes.list]).value.map(simplify)  as any as simplifiedMatcher<T>;;
  }else{
    return tag.value as any as simplifiedMatcher<T>;;
  }
}
