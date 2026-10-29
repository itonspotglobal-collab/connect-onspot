/** Shared without importing transactional services or initializing a database. */
export class HiringPaymentError extends Error {
  constructor(public status:number,public code:string,message:string,public details?:Record<string,unknown>){super(message);}
}
