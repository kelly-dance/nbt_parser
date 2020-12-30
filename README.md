# nbt_parser

Simple module used to parse nbt data in Deno.

Based on https://github.com/sjmulder/nbt-js

https://deno.land/x/nbt_parser

## How to use

```js
import { parse, simplify,  } from 'https://raw.githubusercontent.com/mcbobby123/nbt_parser/master/index.ts';

const data: UInt8Array; // Some NBT data represented as a UInt8Array

const nbt = parse(data);

// To remove type tags use

const simpleNbt = simplify(nbt);
```

## Other

```js
import { Tag, Types } from 'https://raw.githubusercontent.com/mcbobby123/nbt_parser/master/index.ts';

// Tag is an Enum containing the ids of each tag type

Tag.byte  // 1
Tag.short // 2
Tag.int   // 3
// ... etc

// Types maps the ids to their respective types

type IntTag = Types[Tag.int]; // { type: 3, value: number }
```

## TODO

The return type for `simplify` is not quite correct. If your data contains a list of lists for some reason it may be an issue. 
