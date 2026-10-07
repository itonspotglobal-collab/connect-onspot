import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAppUrl, buildTalentApplicationsUrl, buildClientApplicationUrl, canonicalizeApplicationEmailLinks, getAppBaseUrl } from "../lib/appUrl";
import { getSafeReturnTo } from "../../shared/internalRedirect";
import { legacyAppRedirect } from "../lib/legacyAppRedirect";
import { buildEmailContext, buildClientEmailContext, renderApplicantEmail } from "../services/emailVariableResolver";

const previous = process.env.PUBLIC_APP_URL;
const previousNodeEnv = process.env.NODE_ENV;
before(() => { process.env.PUBLIC_APP_URL = "https://correct-domain.example///"; });
after(() => {
  if (previous === undefined) delete process.env.PUBLIC_APP_URL; else process.env.PUBLIC_APP_URL = previous;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
});

describe("canonical application email destinations", () => {
  it("normalizes trailing slashes and preserves a resource path, query and hash", () => {
    assert.equal(getAppBaseUrl(), "https://correct-domain.example");
    assert.equal(buildAppUrl("/contracts/123"), "https://correct-domain.example/contracts/123");
    assert.equal(buildAppUrl("/contracts?id=123#document"), "https://correct-domain.example/contracts?id=123#document");
  });
  it("fails closed for missing, malformed, credentialed or non-origin configuration", () => {
    for (const value of ["", "garbage", "javascript:alert(1)", "https://user:secret@example.test", "https://example.test/app", "https://example.test?query=1", "https://example.test#fragment", "https:\\\\example.test"]) {
      process.env.PUBLIC_APP_URL=value;
      assert.throws(() => buildAppUrl("/contracts?id=123"));
    }
    process.env.PUBLIC_APP_URL="https://correct-domain.example";
  });
  it("requires HTTPS in production, allowing loopback HTTP only in development", () => {
    process.env.PUBLIC_APP_URL="http://localhost:5000/";
    process.env.NODE_ENV="development";
    assert.equal(getAppBaseUrl(), "http://localhost:5000");
    process.env.NODE_ENV="production";
    assert.throws(getAppBaseUrl);
    process.env.PUBLIC_APP_URL="https://correct-domain.example";
    process.env.NODE_ENV=previousNodeEnv;
  });
  it("rejects external and normalized protocol-relative path attacks", () => {
    for (const path of ["https://external.example", "//external.example", "javascript:alert(1)", "/\\external.example", "/%2f%2fexternal.example", "/%255cexternal.example", "/x/..//external.example", "/x/%2e%2e//external.example", "/\nexternal.example", "/contracts?next=%0aevil"]) {
      assert.equal(getSafeReturnTo(path), null, path);
      assert.throws(() => buildAppUrl(path), path);
    }
  });
  it("accepts real return destinations without discarding query state", () => {
    for (const path of ["/contracts/123", "/talent/offers/123", "/contracts?id=123", "/my-applications?offerId=offer-123", "/messages?thread=thread-123", "/contracts?id=100%25"]) {
      assert.equal(getSafeReturnTo(path), path);
    }
  });
  it("renders the offer CTA to the exact offer instead of a generic portal", () => {
    const rendered=renderApplicantEmail({subject:"You have a new offer",bodyHtml:'<a href="{{portal_url}}">Review Offer</a>'},
      buildEmailContext({email:"test@example.test",portalUrlOverride:buildTalentApplicationsUrl({offerId:"offer-123"})}));
    assert.equal(rendered.unresolvedKeys.length,0);
    assert.match(rendered.bodyHtml,/https:\/\/correct-domain.example\/my-applications\?offerId=offer-123/);
  });
  it("builds exact contract and interview destinations, with role-specific Client URLs", () => {
    assert.equal(buildAppUrl("/contracts?id=contract-123"), "https://correct-domain.example/contracts?id=contract-123");
    assert.equal(buildTalentApplicationsUrl({interviewId:"interview-123",applicationId:"application-123"}),
      "https://correct-domain.example/my-applications?applicationId=application-123&interviewId=interview-123");
    assert.equal(buildClientApplicationUrl({jobId:"job-123",applicationId:"application-123",interviewId:"interview-123"}),
      "https://correct-domain.example/client-profile?jobId=job-123&applicationId=application-123&interviewId=interview-123");
  });
  it("builds application, Client job and organization invitation CTAs through the same origin", () => {
    assert.equal(buildEmailContext({email:"test@example.test",applicationId:"application-123"}).portalUrl,
      "https://correct-domain.example/my-applications?applicationId=application-123");
    assert.equal(buildClientEmailContext({clientEmail:"test@example.test",jobId:"job-123",approvalStatus:"approved"}).jobUrl,
      "https://correct-domain.example/client/jobs/job-123/edit");
    assert.equal(buildAppUrl("/organization-invite/opaque-token"), "https://correct-domain.example/organization-invite/opaque-token");
  });
  it("repairs saved template application hrefs but leaves marketing and meeting links alone", () => {
    const old='<a href="https://talent.onspotglobal.com/contracts?id=123&amp;foo=bar#document">Review</a><a href="https://onspotglobal.com/my-applications?offerId=abc">Offer</a><a href="https://onspotglobal.com/">Marketing</a><a href="https://teams.microsoft.com/meeting">Join</a>';
    const html=canonicalizeApplicationEmailLinks(old);
    assert.match(html,/correct-domain.example\/contracts\?id=123&amp;foo=bar#document/);
    assert.match(html,/correct-domain.example\/my-applications\?offerId=abc/);
    assert.match(html,/href="https:\/\/onspotglobal.com\/"/);
    assert.match(html,/href="https:\/\/teams.microsoft.com\/meeting"/);
  });
  it("redirects the verified legacy domain with complete path/query, not the homepage", () => {
    let redirected:unknown; let next=0;
    const res={redirect:(status:number,url:string)=>{redirected={status,url};},status:()=>res,type:()=>res,send:()=>{}};
    legacyAppRedirect({method:"GET",hostname:"talent.onspotglobal.com",path:"/contracts",originalUrl:"/contracts?id=123&foo=bar"} as any,res as any,()=>{next++;});
    assert.deepEqual(redirected,{status:308,url:"https://correct-domain.example/contracts?id=123&foo=bar"});
    for(const hostname of ["onspotglobal.com","evil.example","connect.onspotglobal.com"]){
      legacyAppRedirect({method:"GET",hostname,path:"/contracts",originalUrl:"/contracts?id=123"} as any,res as any,()=>{next++;});
    }
    assert.equal(next,3);
  });
});
