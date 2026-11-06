import {PDFDocument} from "pdf-lib";
import type {PoolClient} from "pg";
import {ContractError} from "./hiringContractService";

/** Bounded PNG data only. Never accept URLs, SVG, or an image instead of consent. */
export async function signatureEvidence(input:any) {
  const title=input?.signerTitle==null?"":input.signerTitle;
  if(typeof title!=="string"||title.trim().length>160||/[\x00-\x1f]/.test(title))
    throw new ContractError(422,{error:"invalid_signer_title",message:"Use a title of at most 160 characters."});
  const image=input?.drawnSignature;
  if(image==null||image==="")return {title:title.trim()||null,png:null};
  const fail=()=>new ContractError(422,{error:"invalid_drawn_signature",message:"Use a PNG signature no larger than 128 KB and 1200 × 600 pixels."});
  if(typeof image!=="string"||image.length>175000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw fail();
  const bytes=Buffer.from(image.slice(22),"base64");
  if(bytes.length>128*1024||bytes.length<33||bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a"||
    bytes.subarray(12,16).toString()!=="IHDR"||bytes.readUInt32BE(16)<1||bytes.readUInt32BE(16)>1200||
    bytes.readUInt32BE(20)<1||bytes.readUInt32BE(20)>600)throw fail();
  let offset=8,chunks=0,ended=false;
  while(offset+12<=bytes.length) {
    const length=bytes.readUInt32BE(offset),type=bytes.subarray(offset+4,offset+8).toString();
    if(++chunks>512||length>bytes.length-offset-12||["acTL","fcTL","fdAT"].includes(type))throw fail();
    offset+=length+12;
    if(type==="IEND"){ended=true;break;}
  }
  if(!ended||offset!==bytes.length)throw fail();
  try {const pdf=await PDFDocument.create();const png=await pdf.embedPng(bytes);await pdf.save();
    if(png.width>1200||png.height>600)throw fail();
  } catch {throw fail();}
  return {title:title.trim()||null,png:`data:image/png;base64,${bytes.toString("base64")}`};
}
export async function signerProfile(db:Pick<PoolClient,"query">,userId:string,role:string|null,organizationId?:string) {
  const user=(await db.query("SELECT first_name,last_name FROM users WHERE id=$1",[userId])).rows[0];
  let profile:any;
  if(role==="talent")profile=(await db.query("SELECT legal_full_name AS name FROM candidates WHERE user_id=$1",[userId])).rows[0];
  else if(role==="organization"&&organizationId)profile=(await db.query("SELECT signatory_name AS name,signatory_title AS title FROM organizations WHERE id=$1",[organizationId])).rows[0];
  else if(role==="client")profile=(await db.query("SELECT signatory_name AS name,signatory_title AS title FROM client_profiles WHERE user_id=$1",[userId])).rows[0];
  return {userId,legalName:String(profile?.name||[user?.first_name,user?.last_name].filter(Boolean).join(" ")||"").trim(),title:String(profile?.title||"").trim()};
}
