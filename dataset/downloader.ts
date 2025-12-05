import axios from 'axios';
import fs from 'fs';
import { PromisePool } from '@supercharge/promise-pool';

async function downloadSchematic(id: string) {
    try {
        const res = await axios.request({
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://www.minecraft-schematics.com/schematic/${id}/download/action/?type=schematic`,
            responseType: 'arraybuffer',
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'cache-control': 'no-cache',
                'dnt': '1',
                'pragma': 'no-cache',
                'priority': 'u=0, i',
                'referer': `https://www.minecraft-schematics.com/schematic/${id}/download/`,
                'sec-ch-ua': '"Not_A Brand";v="99", "Chromium";v="142"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
                'Cookie': 'PHPSESSID=adff5da8e261563b0fa7350e94cdb773; cf_clearance=dYUEr8RGwbik4uR4OdBHBV7_iNyA399dwOn8cKJwhHE-1764942979-1.2.1.1-fW.4fhFeDGxy3iTfRTM7cp0ItCGZyh.U1p56Rs8aoG7.WmEZLKLfdYlY3j7AGpelQpLpr9OQPWAb32fhSkxH.SsIxnwCY1seYS1OdU2c_WxzZKgpV6o37KXAuyNPjOxRj.C4HjvjLVnYpuBldaRgm7hh.og3fT_hKLBc7nRqvdpuYPIkgMvi9Uv6OtX42qhQ65S3F96yfBpIPShri3dQKStOp.Ti0Zn7GbblXSAMCrE; uid=2720821; ukey=5kzsp2nhkkao7ltxbl33gtq3ej308xzydiaw49ppqm3m5; utoken=3sr3jkhir7skxb44asl8; _awl=2.1764943385.5-f17f3533e274abfa4794f8e3095383e8-6763652d6575726f70652d7765737431-0; PHPSESSID=4affab379d863a789d31b949366c09d5'
            },
        });

        if (res.headers['content-disposition']) {
            const filename = res.headers['content-disposition'].split('filename=')[1].split(';')[0];
            const buffer = Buffer.from(res.data);
            //if size more than 10 kb, skip
            if (buffer.length > 10 * 1024) {
                console.log(`Skipped: ${filename} (size: ${buffer.length} bytes)`);
                return;
            }
            fs.writeFileSync("schematics/" + filename, buffer);
            console.log(`Downloaded: ${filename}`);
        }
    } catch (error) {
        console.error(`Failed to download schematic ${id}`);
    }
}

let names: {
    [id: string]: {
        name: string;
        description: string;
    };
} = {};

async function downloadName(id: string) {
    try {
        const res = await axios.request({
            method: 'get',
            url: `https://www.minecraft-schematics.com/schematic/${id}/`,
        });

        const data = res.data;
        const name = data.split(`<li class="active">`)[1].split(`</li>`)[0].trim();
        if(name.includes('<a href="/">')) {
            return;
        }
        const description = data.split(`<p><legend>Description</legend></p>`)[1].split(`<p>`)[1].split(`</p>`)[0].trim();
        names[id] = {
            name: name,
            description: description
        };

        fs.writeFileSync("names.json", JSON.stringify(names, null, 2));
        console.log(`Downloaded: ${id}`);
    } catch (error) {
        console.error(`Failed to download schematic ${id}`);
    }
}


async function downloadAll(ids: string[]) {
    const { errors } = await PromisePool
        .withConcurrency(100)
        .for(ids)
        .process(async (id) => {
            await downloadName(id);
        });

    if (errors.length > 0) {
        console.log(`Completed with ${errors.length} errors`);
    }
}

// Пример: качаем схемы с id от 1 до 1000
const ids = Array.from({ length: 30000 }, (_, i) => String(i + 1));
downloadAll(ids);