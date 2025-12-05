import nbt from 'prismarine-nbt';
import fs from 'fs';

// Упрощаем имя блока
function simplifyBlockName(name: string): string {
  return name.replace('minecraft:', '').replace(/\[.*\]/, '');
}

// Парсим .schem формат
function parseSchem(parsed: any): { blocks: number[], palette: string[], width: number, height: number, length: number } {
  const schematic = parsed.value.Schematic.value;
  const width = schematic.Width.value;
  const height = schematic.Height.value;
  const length = schematic.Length.value;
  
  const blocksData = schematic.Blocks.value;
  
  // Palette: blockName -> id
  const paletteMap: Record<string, number> = {};
  for (const [blockName, entry] of Object.entries(blocksData.Palette.value)) {
    paletteMap[blockName] = (entry as any).value;
  }
  
  // id -> blockName
  const palette: string[] = [];
  for (const [name, id] of Object.entries(paletteMap)) {
    palette[id] = name;
  }
  
  return { blocks: blocksData.Data.value, palette, width, height, length };
}

// Парсим .litematic формат
function parseLitematic(parsed: any): { blocks: number[], palette: string[], width: number, height: number, length: number } {
  const regions = parsed.value.Regions.value;
  const regionName = Object.keys(regions)[0];
  const region = regions[regionName].value;
  
  // Размеры (могут быть отрицательными)
  const width = Math.abs(region.Size.value.x.value);
  const height = Math.abs(region.Size.value.y.value);
  const length = Math.abs(region.Size.value.z.value);
  
  // Palette
  const paletteList = region.BlockStatePalette.value.value;
  const palette: string[] = paletteList.map((entry: any) => entry.Name.value);
  
  // Распаковываем BlockStates из longArray
  const blockStates: [number, number][] = region.BlockStates.value;
  const totalBlocks = width * height * length;
  const bitsPerBlock = Math.max(2, Math.ceil(Math.log2(palette.length)));
  
  const blocks = unpackBlockStates(blockStates, totalBlocks, bitsPerBlock);
  
  return { blocks, palette, width, height, length };
}

// Распаковываем блоки из packed long array
function unpackBlockStates(longs: [number, number][], totalBlocks: number, bitsPerBlock: number): number[] {
  const blocks: number[] = [];
  const mask = (1 << bitsPerBlock) - 1;
  
  // Конвертируем [low, high] в BigInt для работы с 64-bit числами
  const longValues: bigint[] = longs.map(([low, high]) => {
    const lowBig = BigInt(low >>> 0);
    const highBig = BigInt(high >>> 0);
    return (highBig << 32n) | lowBig;
  });
  
  let bitIndex = 0;
  
  for (let i = 0; i < totalBlocks; i++) {
    const longIndex = Math.floor(bitIndex / 64);
    const bitOffset = bitIndex % 64;
    
    if (longIndex >= longValues.length) break;
    
    let value = Number((longValues[longIndex] >> BigInt(bitOffset)) & BigInt(mask));
    
    // Если значение переходит границу long
    if (bitOffset + bitsPerBlock > 64 && longIndex + 1 < longValues.length) {
      const remainingBits = 64 - bitOffset;
      const nextBits = bitsPerBlock - remainingBits;
      const nextValue = Number(longValues[longIndex + 1] & BigInt((1 << nextBits) - 1));
      value |= nextValue << remainingBits;
    }
    
    blocks.push(value);
    bitIndex += bitsPerBlock;
  }
  
  return blocks;
}

// Конвертируем в послойный формат
function toLayerFormat(
  blocks: number[],
  palette: string[],
  width: number,
  height: number,
  length: number
): string {
  const layers: string[] = [];

  for (let y = 0; y < height; y++) {
    const rows: string[] = [];
    
    for (let z = 0; z < length; z++) {
      const row: string[] = [];
      
      for (let x = 0; x < width; x++) {
        const index = (y * length + z) * width + x;
        const blockId = blocks[index] ?? 0;
        const blockName = simplifyBlockName(palette[blockId] ?? 'air');
        row.push(blockName);
      }
      
      rows.push(row.join(', '));
    }
    
    layers.push(`layer ${y + 1}\n\n${rows.join('\n')}`);
  }

  return layers.join('\n\n');
}

// Main
const filename = '26027.litematic';
const data = fs.readFileSync(filename);
const res = await nbt.parse(data) as any;

fs.writeFileSync('parsed.json', JSON.stringify(res, null, 2));

let result: { blocks: number[], palette: string[], width: number, height: number, length: number };

if (filename.endsWith('.litematic')) {
  result = parseLitematic(res.parsed);
} else {
  result = parseSchem(res.parsed);
}

console.log(`Size: ${result.width}x${result.height}x${result.length}`);
console.log(`Palette: ${result.palette.length} blocks`);
console.log(`Total blocks: ${result.blocks.length}`);

const layerText = toLayerFormat(result.blocks, result.palette, result.width, result.height, result.length);
fs.writeFileSync('layers.txt', layerText);
console.log('Saved to layers.txt');
