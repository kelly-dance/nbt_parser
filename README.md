# nbt-parser

Simple module used to parse nbt data in Deno.

Based on https://github.com/sjmulder/nbt-js

## How to use

```js
import { parse, simplify,  } from 'https://raw.githubusercontent.com/mcbobby123/nbt-parser/master/index.ts';

const data: UInt8Array; // Some NBT data represented as a UInt8Array

const nbt = parse(data);

// To remove type tags use

const simpleNbt = simplify(nbt);
```

## Other

```js
import { TagTypes, TagTypeTypes } from 'https://raw.githubusercontent.com/mcbobby123/nbt-parser/master/index.ts';

// TagTypes is an Enum containing the ids of each tag type

TagTypes.byte  // 1
TagTypes.short // 2
TagTypes.int   // 3
// ... etc

// TagTypeTypes maps the ids to their respective types

type IntTag = TagTypeTypes[TagTypes.int]; // { type:3, value: number }
```

## TODO

The return type for `simplify` is not quite correct. If your data contains a list of lists for some reason it may be an issue. 
