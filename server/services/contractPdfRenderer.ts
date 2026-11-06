import PdfPrinter from "pdfmake";
import { parseDocument } from "htmlparser2";
import { createRequire } from "node:module";
import { sanitizeTemplateBody } from "./contractMergeService";

const require = createRequire(import.meta.url);
// Bundled pdfmake VFS fonts work in production without system fonts or Chromium.
const fontModule = require("pdfmake/build/vfs_fonts.js");
const vfs = fontModule.pdfMake?.vfs ?? fontModule;
const font = (name: string) => Buffer.from(vfs[name], "base64");
const printer = new PdfPrinter({ Roboto: {
  normal: font("Roboto-Regular.ttf"), bold: font("Roboto-Medium.ttf"),
  italics: font("Roboto-Italic.ttf"), bolditalics: font("Roboto-MediumItalic.ttf"),
} });

function children(node: any): any[] { return node.children ?? []; }
function inline(node: any, style: any = {}): any[] {
  if (node.type === "text") return [{ text: node.data, ...style }];
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
  if (node.type === "text") return node.data.trim() ? [{ text: node.data }] : [];
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
  content.push({ text:"Signatures",bold:true,fontSize:16,pageBreak:"before",margin:[0,0,0,20] });
  for (const role of roles) content.push({unbreakable:true,stack:[
    {text:role === "onspot" ? "OnSpot" : role[0].toUpperCase()+role.slice(1),bold:true,margin:[0,8,0,12]},
    {text:"Signature: __________________________________________",margin:[0,0,0,12]},
    {text:"Full legal name: _____________________________________",margin:[0,0,0,12]},
    {text:"Title (if applicable): _________________________________",margin:[0,0,0,12]},
    {text:"Date: ______________________________________________",margin:[0,0,0,20]},
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
  return new Promise<Buffer>((resolve,reject)=>{
    const chunks:Buffer[]=[]; pdf.on("data",(c:Buffer)=>chunks.push(c));pdf.on("error",reject);
    pdf.on("end",()=>resolve(Buffer.concat(chunks)));pdf.end();
  });
}
