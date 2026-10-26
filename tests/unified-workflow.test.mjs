import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const redirect=readFileSync(new URL("../editorial.html",import.meta.url),"utf8");
test("Discover, Studio, Published belong to one accessible document",()=>{
 for(const name of ["discover","studio","published"]){
  assert.match(html,new RegExp('data-view="'+name+'"'));
  assert.match(html,new RegExp('id="'+name+'View"'));
 }
 assert.doesNotMatch(html,/href="\/editorial\.html"/);
 assert.doesNotMatch(html,/<iframe\b/i);
});
test("RSS source selection enters in-page Studio",()=>{
 assert.match(js,/function startDraft\(s\)/);
 assert.match(js,/selectedId=s\.id;navigate\("studio"\)/);
 assert.match(js,/\.netlify\/functions\/official-feed/);
});
test("No unattended or automated X posts",()=>{
 assert.doesNotMatch(js,/api\.x\.com\/2\/tweets|api\.twitter\.com\/2\/tweets/i);
 assert.match(html,/https:\/\/x\.com\/compose\/post/);
 assert.match(js,/sourceURLAccepted/);
});
test("Review and manager key remain separate from public RSS",()=>{
 assert.match(html,/id="sourceVerified"/);
 assert.match(html,/id="markReady"/);
 assert.match(js,/sessionStorage\.setItem\("signaldesk:manager:key"/);
 assert.doesNotMatch(js,/localStorage\.setItem\([^)]*managerKey/i);
});
test("Legacy editorial URL routes back to unified Studio",()=>{
 assert.match(redirect,/url=\/#studio/);
});
