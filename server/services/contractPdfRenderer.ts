import PdfPrinter from "pdfmake";
import { parseDocument } from "htmlparser2";
import { createRequire } from "node:module";
import { sanitizeTemplateBody } from "./contractMergeService";
import {PDFDocument,PDFName,PDFString,rgb,StandardFonts} from "pdf-lib";
import {readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {ContractError} from "./hiringContractService";

const require = createRequire(import.meta.url);
// Bundled pdfmake VFS fonts work in production without system fonts or Chromium.
const fontModule = require("pdfmake/build/vfs_fonts.js");
const vfs = fontModule.pdfMake?.vfs ?? fontModule;
const font = (name: string) => Buffer.from(vfs[name], "base64");
const cssPath=require.resolve("@fontsource/noto-sans-sc/400.css");
const fallbackFonts:any={},ranges:Array<{font:string;ranges:number[][]}>=[];
for(const block of readFileSync(cssPath,"utf8").split("@font-face").slice(1)) {
  const file=block.match(/url\(\.\/([^)]*\.woff)\)/)?.[1],range=block.match(/unicode-range:\s*([^;]+)/)?.[1];
  if(!file||!range)continue;
  const name=`Noto${ranges.length}`,path=join(dirname(cssPath),file);
  fallbackFonts[name]={normal:path,bold:path,italics:path,bolditalics:path};
  ranges.push({font:name,ranges:range.split(",").map(part=>{const [start,end]=part.trim().replace(/^U\+/i,"").split("-");return[parseInt(start,16),parseInt(end??start,16)];})});
}
const printer = new PdfPrinter({ ...fallbackFonts,Roboto: {
  normal: font("Roboto-Regular.ttf"), bold: font("Roboto-Medium.ttf"),
  italics: font("Roboto-Italic.ttf"), bolditalics: font("Roboto-MediumItalic.ttf"),
} });
const fallbackCache=new Map<number,string>();
function unicodeText(text:string,style:any={}) {
  const spans:any[]=[];
  for(const character of Array.from(text)) {
    const code=character.codePointAt(0)!;
    let family="Roboto";
    if(code>0x2ff) {
      family=fallbackCache.get(code)??ranges.find(entry=>entry.ranges.some(([a,b])=>code>=a&&code<=b))?.font??"";
      if(!family)throw new ContractError(422,{error:"unsupported_document_character",message:"A document character is not supported by the bundled PDF fonts. No executed copy was produced; contact OnSpot to add the required font."});
      fallbackCache.set(code,family);
    }
    const last=spans[spans.length-1];
    if(last?.font===family)last.text+=character;else spans.push({text:character,...style,font:family});
  }
  return spans;
}

function children(node: any): any[] { return node.children ?? []; }
function inline(node: any, style: any = {}): any[] {
  if (node.type === "text") return unicodeText(node.data,style);
  if (node.name === "br") return [{ text: "\n", ...style }];
  const next = { ...style, ...(["b","strong"].includes(node.name) ? { bold: true } : {}),
    ...(["i","em"].includes(node.name) ? { italics: true } : {}),
    ...(node.name === "u" ? { decoration: "underline" } : {}) };
  const result=children(node).flatMap(child => inline(child, next));
  if(["p","li"].includes(node.name))result.push({text:"\n"});
  return result;
}
function descendants(node: any, name: string): any[] {
  return children(node).flatMap(child => child.name === name ? [child] : descendants(child, name));
}
function blocks(node: any): any[] {
  if (node.type === "text") return node.data.trim() ? [{ text: unicodeText(node.data) }] : [];
  if (node.attribs?.["data-page-break"]==="before") {
    const copy={...node,attribs:{...node.attribs,"data-page-break":undefined}};
    return [{stack:blocks(copy),pageBreak:"before"}];
  }
  if (node.name === "table") {
    const rows = descendants(node, "tr").map(row => children(row).filter(cell => ["td","th"].includes(cell.name)));
    const width = Math.max(0, ...rows.map(row => row.reduce((n, cell) => n + Math.min(20, Math.max(1, Number(cell.attribs?.colspan) || 1)), 0)));
    if (!width || width > 20 || rows.length > 1000) throw new Error("Unsupported contract table dimensions");
    const body = rows.map(row => {
      const cells: any[] = [];
      for (const cell of row) {
        // Rowspans cannot be silently discarded in a legal document.
        if (Number(cell.attribs?.rowspan ?? 1) !== 1) throw new Error("Contract tables with row spans require revision before PDF rendering");
        const span = Math.min(20, Math.max(1, Number(cell.attribs?.colspan) || 1));
        cells.push({ text: children(cell).flatMap(c => inline(c)), bold: cell.name === "th",
          margin: [4,4,4,4], colSpan: span });
        for (let i=1;i<span;i++) cells.push({});
      }
      while (cells.length < width) cells.push({text:""});
      return cells;
    });
    return [{ table: { widths: Array(width).fill("*"), body }, margin: [0,6,0,10], layout: "lightHorizontalLines" }];
  }
  if (["ul","ol"].includes(node.name)) return [{ [node.name]: children(node).filter(n => n.name === "li")
    .map(n => ({text:children(n).flatMap(c => inline(c))})), margin:[0,4,0,8] }];
  if (/^h[1-4]$/.test(node.name)) return [{text:children(node).flatMap(c => inline(c)),bold:true,
    fontSize:node.name === "h1" ? 19 : 13, margin:[0,12,0,7], headlineLevel:1}];
  if (["p","blockquote"].includes(node.name)) return [{text:children(node).flatMap(c => inline(c)),margin:[0,0,0,8]}];
  return children(node).flatMap(blocks);
}
export async function renderContractPdf(html: string, kind: string, version: string, roles: string[]) {
  const content = blocks(parseDocument(sanitizeTemplateBody(html)));
  for (const role of roles) content.push({pageBreak:"before",stack:[
    {text:"Signatures",bold:true,fontSize:16,margin:[0,0,0,20]},
    {text:role === "onspot" ? "OnSpot" : role[0].toUpperCase()+role.slice(1),bold:true,fontSize:12},
    {text:"Reserved for this party's electronic signature, legal name, title and signing date.",fontSize:9,margin:[0,12,0,0]},
  ]});
  const pdf = printer.createPdfKitDocument({
    pageSize:"A4",pageMargins:[44,54,44,54],defaultStyle:{font:"Roboto",fontSize:10,lineHeight:1.25},
    header:{text:"OnSpot Connect",bold:true,color:"#474ead",margin:[44,22,44,0]},
    footer:(page:number,pages:number)=>({columns:[
      {text:`OnSpot Connect • ${kind} • v${version}`,width:"*"},
      {text:`${page} / ${pages}`,alignment:"right",width:"auto"},
    ],fontSize:8,color:"#64748b",margin:[44,16,44,0]}),
    content,
  } as any);
  const raw=await new Promise<Buffer>((resolve,reject)=>{
    const chunks:Buffer[]=[]; pdf.on("data",(c:Buffer)=>chunks.push(c));pdf.on("error",reject);
    pdf.on("end",()=>resolve(Buffer.concat(chunks)));pdf.end();
  });
  const final=await PDFDocument.load(raw);
  const slots=roles.map((role,index)=>({role,page:final.getPageCount()-roles.length+index,x:44,y:350,width:507,height:340}));
  const labelFont=await final.embedFont(StandardFonts.Helvetica);
  for(const slot of slots) {
    const page=final.getPage(slot.page);
    page.drawRectangle({x:slot.x,y:slot.y,width:slot.width,height:slot.height,borderWidth:0.7,borderColor:rgb(.7,.72,.8)});
    page.drawText("Signature:",{x:slot.x+16,y:slot.y+slot.height-16,size:9,font:labelFont});
  }
  final.catalog.set(PDFName.of("OnSpotSignatureSlots"),PDFString.of(JSON.stringify(slots)));
  return Buffer.from(await final.save());
}

/** Literal text with embedded Unicode fonts, not interpreted HTML. */
export async function renderSignatureTextPdf(signature:any) {
  const pdf=printer.createPdfKitDocument({pageSize:{width:475,height:200},pageMargins:[0,0,0,0],
    defaultStyle:{font:"Roboto",fontSize:10},content:[
      {text:unicodeText(`${signature.signer_role}: ${signature.legal_name}`),bold:true,margin:[0,0,0,12]},
      ...(signature.signer_title?[{text:unicodeText(`Title: ${signature.signer_title}`),margin:[0,0,0,12]}]:[]),
      {text:`Signed: ${new Date(signature.signed_at).toISOString()}`,margin:[0,0,0,12]},
      {text:signature.signature_png?"Method: typed name, explicit consent and optional drawn signature":"Method: typed name and explicit consent",fontSize:9},
    ]} as any);
  return new Promise<Buffer>((resolve,reject)=>{const chunks:Buffer[]=[];pdf.on("data",(chunk:Buffer)=>chunks.push(chunk));
    pdf.on("error",reject);pdf.on("end",()=>resolve(Buffer.concat(chunks)));pdf.end();});
}
