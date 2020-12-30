# nbt_parser

Simple module used to parse nbt data in Deno.

Based on https://github.com/sjmulder/nbt-js

https://deno.land/x/nbt_parser

## How to use

```ts
import { parse, simplify } from 'https://raw.githubusercontent.com/mcbobby123/nbt_parser/master/index.ts';

const data: UInt8Array; // Some NBT data represented as a UInt8Array

const nbt = parse(data);

// To remove type tags use

const simpleNbt = simplify(nbt);
```

## Typing

```ts
import { Tag, Types, Create, Constant, SimplifiedType } from 'https://raw.githubusercontent.com/mcbobby123/nbt_parser/master/index.ts';

// Tag is an Enum containing the ids of each tag type

Tag.byte  // 1
Tag.short // 2
Tag.int   // 3
// ... etc

// Types maps the ids to their respective types

type IntTag = Types[Tag.int]; // { type: 3, value: number }

// Define a schema for your NBT data

type Mystic = Create<{
  id: Tag.short,
  Count: Tag.byte,
  tag: {
    ench: Tag.end[],
    Unbreakable: Constant<Tag.short, 1>, // or [Tag.short, 1]
    HideFlags: Constant<Tag.short, 254>,
    display: {
      Lore: Tag.string[],
      Name: Tag.string,
    },
    ExtraAttributes: {
      Nonce: Tag.int,
      Lives: Tag.int,
      CustomEnchants: {
        Level: Tag.int,
        Key: Tag.string
      }[],
      UpdateTier: Tag.int,
      MaxLives: Tag.int,
      UpgradeGemsUses?: Constant<Tag.int, 1>,
    }
  },
  Damage: Tag.short
}>;

// remove type layers from a schema

type SimplifiedMystic = SimplifiedType<Mystic>

```
