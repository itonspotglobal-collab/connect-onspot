import {PDFDocument,PDFName,PDFString,rgb,StandardFonts} from "pdf-lib";
import {renderSignatureTextPdf} from "./contractPdfRenderer";

/** Generated documents have bounded reserved slots. Never guess where an uploaded
 * agreement's signature lines are: append clearly labelled signature pages instead. */
export async function stampContractSignatures(pdf:PDFDocument,document:any,signatures:any[]) {
  let slots:any[]=[];
  const metadata=pdf.catalog.get(PDFName.of("OnSpotSignatureSlots"));
  if(document.template_id&&metadata instanceof PDFString) {
    try {slots=JSON.parse(metadata.decodeText());}catch{throw new Error("Invalid signature block metadata");}
    if(!Array.isArray(slots)||slots.length>4||new Set(slots.map(s=>s.role)).size!==slots.length)throw new Error("Invalid signature blocks");
    for(const s of slots) {
      const page=Number.isInteger(s.page)&&s.page>=0&&s.page<pdf.getPageCount()?pdf.getPage(s.page):null;
      if(!page||![s.x,s.y,s.width,s.height].every(Number.isFinite)||s.x<0||s.y<0||s.width<200||s.height<280||
        s.x+s.width>page.getWidth()||s.y+s.height>page.getHeight())throw new Error("Invalid signature block geometry");
    }
  }
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  for(const signature of signatures) {
    if(!["talent","client","organization","onspot"].includes(signature.signer_role)||
      signature.document_sha256!==document.sha256)throw new Error("Signature does not match original PDF");
    let slot=slots.find(s=>s.role===signature.signer_role);
    if(!slot) {
      const page=pdf.addPage([595,842]);
      page.drawText("OnSpot electronic signature block",{x:44,y:790,size:16,font});
      page.drawText("Applies to the unchanged original agreement identified in the audit record.",{x:44,y:763,size:9,font});
      slot={page:pdf.getPageCount()-1,x:44,y:350,width:507,height:340};
      page.drawRectangle({...slot,borderWidth:.7,borderColor:rgb(.7,.72,.8)});
    }
    const page=pdf.getPage(slot.page);
    const layer=await PDFDocument.load(await renderSignatureTextPdf(signature));
    const [text]=await pdf.embedPages([layer.getPage(0)]);
    page.drawPage(text,{x:slot.x+16,y:slot.y+14,width:slot.width-32,height:200});
    if(signature.signature_png) {
      const image=await pdf.embedPng(signature.signature_png);
      const scale=Math.min((slot.width-32)/image.width,90/image.height);
      page.drawImage(image,{x:slot.x+16,y:slot.y+slot.height-110,width:image.width*scale,height:image.height*scale});
    }
  }
}
