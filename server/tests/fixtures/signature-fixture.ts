import {deflateSync} from "node:zlib";
/** Synthetic transparent PNG with a dark stroke; no person's signature. */
export function signatureFixturePng() {
  function crc(bytes:Buffer){let value=0xffffffff;for(let i=0;i<bytes.length;i++){value^=bytes[i];for(let n=0;n<8;n++)value=(value>>>1)^((value&1)?0xedb88320:0);}return(value^0xffffffff)>>>0;}
  function chunk(name:string,data:Buffer){const type=Buffer.from(name),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,sum]);}
  const header=Buffer.alloc(13);header.writeUInt32BE(32,0);header.writeUInt32BE(16,4);header[8]=8;header[9]=6;
  const scan=Buffer.alloc((1+32*4)*16);
  for(let y=0;y<16;y++)for(let x=0;x<32;x++){const p=y*129+1+x*4;scan[p+3]=Math.abs(x-y*2)<3?255:0;}
  return "data:image/png;base64,"+Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),chunk("IHDR",header),chunk("IDAT",deflateSync(scan)),chunk("IEND",Buffer.alloc(0))]).toString("base64");
}
