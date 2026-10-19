import { z } from "zod";
import type { Pool, PoolClient } from "pg";

const required = (max: number) => z.string().trim().min(1).max(max);
const currency = z.string().regex(/^[A-Z]{3}$/);
const draftInput = z.object({
  currency, supportedCurrencies:z.array(currency).min(1).max(20)
    .refine(values=>new Set(values).size===values.length,"Supported currencies must be distinct.").optional(),
  recipient:required(500), instructions:required(4000),
  referenceInstructions:z.string().trim().max(1000).default(""),
  active:z.literal(false).default(false), qrFileId:z.string().uuid().nullish(),
  depositFundingConfirmed:z.boolean().default(false),
}).strict();
const activationInput = z.object({
  confirmImageReviewed:z.literal(true), confirmReceivingAccount:z.literal(true),
  confirmCurrencies:z.literal(true), confirmInstructions:z.literal(true), reason:required(2000),
}).strict();
const reasonInput = z.object({reason:required(2000)}).strict();

// All lifecycle operations use the existing table, files and financial audit.
export class ManualWiseConfiguration {
  constructor(private pool:Pool,
    private authorize:(db:Pick<PoolClient,"query">, actor:string)=>Promise<unknown>,
    private error:(status:number,message:string)=>never) {}

  private async tx<T>(actor:string,fn:(db:PoolClient)=>Promise<T>) {
    const db=await this.pool.connect();
    try {
      await db.query("BEGIN");
      await this.authorize(db,actor);
      await db.query("SELECT pg_advisory_xact_lock(hashtext('manual-wise-config'))");
      const result=await fn(db);
      await db.query("COMMIT");
      return result;
    } catch(e) {await db.query("ROLLBACK"); throw e;} finally {db.release();}
  }
  private async audit(db:PoolClient,actor:string,event:string,details:unknown) {
    await db.query("INSERT INTO manual_wise_audit(actor_id,event,details) VALUES($1,$2,$3)",
      [actor,event,JSON.stringify(details)]);
  }
  private async draft(db:PoolClient,actor:string,input:unknown,source:string|null=null,reason:string|null=null) {
    const v=draftInput.parse(input);
    const currencies=Array.from(new Set(v.supportedCurrencies??[v.currency])).sort();
    if(!currencies.includes(v.currency))return this.error(422,"Primary currency must be included in supported currencies.");
    if(v.qrFileId && !(await db.query("SELECT id FROM manual_wise_files WHERE id=$1 AND purpose='qr'",[v.qrFileId])).rowCount)
      return this.error(422,"Configured QR image not found.");
    const active=(await db.query("SELECT id,currency FROM manual_wise_config WHERE active AND currency=ANY($1::text[])",[currencies])).rows;
    const base=Object.fromEntries(currencies.map(c=>[c,active.find(r=>r.currency===c)?.id??null]));
    const row=(await db.query(`INSERT INTO manual_wise_config(currency,supported_currencies,recipient,instructions,
      reference_instructions,qr_file_id,active,deposit_funding_confirmed,created_by,config_status,base_versions,source_config_id,change_reason)
      VALUES($1,$2,$3,$4,$5,$6,false,$7,$8,'draft',$9,$10,$11) RETURNING *`,
      [v.currency,currencies,v.recipient,v.instructions,v.referenceInstructions,v.qrFileId??null,
        v.depositFundingConfirmed,actor,JSON.stringify(base),source,reason])).rows[0];
    await this.audit(db,actor,source?"wise_configuration_restore_drafted":"wise_configuration_drafted",
      {configId:row.id,sourceConfigId:source,currencies,reason});
    return row;
  }
  save(actor:string,input:unknown) {return this.tx(actor,db=>this.draft(db,actor,input));}
  async list(actor:string) {
    await this.authorize(this.pool,actor);
    // Never hide an active version behind a history limit.
    return {items:(await this.pool.query(`SELECT c.*,f.uploaded_by,f.created_at AS uploaded_at
      FROM manual_wise_config c LEFT JOIN manual_wise_files f ON f.id=c.qr_file_id
      ORDER BY c.active DESC,c.created_at DESC,c.id DESC`)).rows};
  }
  async activate(actor:string,id:string,input:unknown) {
    z.string().uuid().parse(id);
    const v=activationInput.parse(input);
    return this.tx(actor,async db=>{
      const draft=(await db.query("SELECT * FROM manual_wise_config WHERE id=$1 FOR UPDATE",[id])).rows[0];
      if(!draft)return this.error(404,"Configuration not found.");
      if(draft.config_status!=="draft")return this.error(409,"Only an unactivated draft can be reviewed for activation.");
      if(!draft.qr_file_id || !(await db.query("SELECT id FROM manual_wise_files WHERE id=$1 AND purpose='qr'",[draft.qr_file_id])).rowCount)
        return this.error(422,"Upload and review a QR image before activating.");
      const current=(await db.query("SELECT id,currency FROM manual_wise_config WHERE active AND currency=ANY($1::text[])",
        [draft.supported_currencies])).rows;
      for(const c of draft.supported_currencies) {
        if((current.find(r=>r.currency===c)?.id??null)!==(draft.base_versions[c]??null))
          return this.error(409,"Active receiving settings changed since this draft was saved. Save and review a fresh draft.");
      }
      const items=[];
      for(const c of draft.supported_currencies) {
        const previousActive=current.find(r=>r.currency===c)?.id??null;
        const previous=previousActive??(await db.query(`SELECT id FROM manual_wise_config
          WHERE currency=$1 AND config_status='inactive'
          ORDER BY coalesce(activated_at,created_at) DESC,id DESC LIMIT 1`,[c])).rows[0]?.id??null;
        if(previousActive)await db.query(`UPDATE manual_wise_config SET active=false,config_status='inactive',
          deactivated_by=$2,deactivated_at=now(),deactivation_reason=$3 WHERE id=$1`,[previous,actor,v.reason]);
        const row=(await db.query(`INSERT INTO manual_wise_config(currency,supported_currencies,recipient,instructions,
          reference_instructions,qr_file_id,active,deposit_funding_confirmed,created_by,config_status,previous_version_id,
          source_config_id,activated_by,activated_at,change_reason)
          VALUES($1,$2,$3,$4,$5,$6,true,$7,$8,'active',$9,$10,$8,now(),$11) RETURNING *`,
          [c,draft.supported_currencies,draft.recipient,draft.instructions,draft.reference_instructions,
            draft.qr_file_id,draft.deposit_funding_confirmed,actor,previous,id,v.reason])).rows[0];
        items.push(row);
        await this.audit(db,actor,"wise_configuration_activated",{configId:row.id,draftId:id,
          previousVersionId:previous,currency:c,confirmations:v,restoredFrom:draft.source_config_id});
      }
      await db.query("UPDATE manual_wise_config SET config_status='reviewed' WHERE id=$1",[id]);
      return {items};
    });
  }
  async deactivate(actor:string,id:string,input:unknown) {
    z.string().uuid().parse(id);
    const {reason}=reasonInput.parse(input);
    return this.tx(actor,async db=>{
      const selected=(await db.query("SELECT * FROM manual_wise_config WHERE id=$1 AND active FOR UPDATE",[id])).rows[0];
      if(!selected)return this.error(409,"Configuration is not active.");
      const rows=(await db.query(`UPDATE manual_wise_config SET active=false,config_status='inactive',
        revoked_at=now(),deactivated_at=now(),deactivated_by=$2,deactivation_reason=$3
        WHERE active AND (id=$1 OR source_config_id=$4) RETURNING *`,
        [id,actor,reason,selected.source_config_id??null])).rows;
      for(const row of rows)await this.audit(db,actor,"wise_configuration_revoked",
        {configId:row.id,currency:row.currency,reason,requestedConfigId:id});
      return {...rows.find(row=>row.id===id),affectedCurrencies:rows.map(row=>row.currency)};
    });
  }
  async restore(actor:string,id:string,input:unknown) {
    z.string().uuid().parse(id);
    const {reason}=reasonInput.parse(input);
    return this.tx(actor,async db=>{
      const old=(await db.query("SELECT * FROM manual_wise_config WHERE id=$1",[id])).rows[0];
      if(!old)return this.error(404,"Configuration not found.");
      if(old.config_status!=="inactive")return this.error(409,"Only a previous receiving configuration can be restored.");
      return this.draft(db,actor,{currency:old.currency,supportedCurrencies:old.supported_currencies,
        recipient:old.recipient,instructions:old.instructions,referenceInstructions:old.reference_instructions,
        active:false,qrFileId:old.qr_file_id,depositFundingConfirmed:old.deposit_funding_confirmed},id,reason);
    });
  }
}
