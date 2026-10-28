/**
 * Executes the actual production route callbacks, not mirrored offer logic.
 * Authentication middleware and outbound notifications are intentionally NOT
 * exercised here. Actors are synthetic and all SQL goes to the owned fixture.
 */
import ts from "typescript";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {pool,query} from "./hiring-db";
import * as guard from "../../services/formalPipelineGuard";
import * as currency from "../../../shared/currency";
import {requireHiringStage,issueAcceptedOfferDeposit,lockOnboarding} from "../../services/contractorOnboardingPolicy";
import {requireVerifiedHiringPayment} from "../../services/hiringPaymentService";
import {hiringPaymentFailure} from "../../routes/hiringPayments";
import {queueHiringLifecycleEvent} from "../../services/hiringLifecycleEvents";
const source=ts.createSourceFile("routes.ts",readFileSync("server/routes.ts","utf8"),ts.ScriptTarget.Latest,true);

export async function offerHandler(method:"post"|"patch",path:string,actor:string,candidate:string,body:any,id?:string) {
  let callback="";
  const declarations:string[]=[];
  function visit(node:ts.Node) {
    if(ts.isFunctionDeclaration(node)&&["loadTalentOwnedOffer","respondUsdOnly"].includes(node.name?.text??""))
      declarations.push(node.getText(source));
    if(ts.isCallExpression(node)&&node.expression.getText(source)===`app.${method}`&&
      ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text===path)callback=node.arguments.at(-1)!.getText(source);
    ts.forEachChild(node,visit);
  }
  visit(source);
  assert.ok(callback,`Missing actual ${method} ${path}`);
  const deps={
    pool,query,...guard,...currency,requireHiringStage,issueAcceptedOfferDeposit,lockOnboarding,
    requireVerifiedHiringPayment,hiringPaymentFailure,queueHiringLifecycleEvent,
    dispatchHiringLifecycleEvents:async()=>{},
    storage:{createNotification:async()=>{}},
    require:(name:string)=>{
      if(name.includes("microsoftGraphEmailService"))return {isEmailServiceConfigured:()=>false};
      if(name.includes("emailVariableResolver"))return {};
      throw new Error(`Unexpected route import ${name}`);
    },
  };
  const compiled=ts.transpileModule(`${declarations.join("\n")}\nreturn (${callback});`,
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const handler=new Function(...Object.keys(deps),compiled)(...Object.values(deps));
  const res={statusCode:200,body:undefined as any,status(n:number){this.statusCode=n;return this;},json(value:any){this.body=value;return this;}};
  await handler({body,params:{id},user:{id:actor},talentAuth:{candidateId:candidate}},res);
  return res;
}
