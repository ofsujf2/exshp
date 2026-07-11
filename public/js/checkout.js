// public/js/checkout.js — ExecutiveShop
(function(){
var S={
  step:1,needsShipping:false,
  shipping:{line1:"",line2:"",city:"",state:"",postal_code:"",country:"IT"},
  guest_email:"",payment_method:null,wallet_id:null,
  wallets:[],methods:[],coupon_code:"",discount:0,freeShipping:false,couponError:null
};

// Real payment icons (SVG logos, no emojis)
var ICONS={
  paypal_manual: '<span style="font-size:1.8rem;">&#127991;</span>',
  revolut_manual: '<span style="font-size:1.8rem;">&#128179;</span>',
  crypto_manual: '<span style="font-size:1.8rem;">&#8383;</span>'
};
var LABELS={paypal_manual:"PayPal",revolut_manual:"Revolut",crypto_manual:"Crypto"};
var DESC={
  paypal_manual:"PayPal email payment. Manual verification by staff.",
  revolut_manual:"Instant Revolut transfer. Manual verification by staff.",
  crypto_manual:"Pay with Bitcoin or Litecoin. Manual verification by staff."
};
var NET={BTC:"Bitcoin",LTC:"Litecoin"};

async function init(){
  var el=document.getElementById("stepContent");if(!el)return;
  if(ESH.cart.count()===0){
    el.innerHTML='<div class="glass checkout-panel text-center"><h3>Your cart is empty</h3><p class="text-muted mt-1">Add some products.</p><a href="/products.html" class="btn btn-primary mt-3">Browse products</a></div>';
    document.getElementById("summaryCard").innerHTML="";return;
  }
  S.needsShipping=ESH.cart.hasPhysical();S.step=1;
  try{var a=await ESH.api("/api/payment-methods");if(a.ok)S.methods=a.data.methods;}catch(e){}
  try{var b=await ESH.api("/api/wallets/public");if(b.ok)S.wallets=b.data.wallets.filter(function(w){return w.network==="BTC"||w.network==="LTC";});}catch(e){}
  render();
}

function renderSteps(){
  var steps=["Cart"];
  if(S.needsShipping||!window.__eshUser)steps.push("Details");
  steps.push("Payment");
  var h='<div class="checkout-steps">';
  for(var i=0;i<steps.length;i++){var n=i+1,cls=n<S.step?"done":n===S.step?"active":"";h+='<div class="checkout-step '+cls+'"><span class="num">'+(n<S.step?"&#10003;":n)+'</span>'+steps[i]+'</div>';}
  h+='</div>';return h;
}

function hasDetailStep(){
  return S.needsShipping || !window.__eshUser;
}

function render(){
  document.querySelector(".checkout-steps-wrap").innerHTML=renderSteps();
  var el=document.getElementById("stepContent");
  var hasDetail=hasDetailStep();
  if(S.step===1)el.innerHTML=renderCart();
  else if(hasDetail&&S.step===2)el.innerHTML=renderDetails();
  else el.innerHTML=renderPayment();
  renderSummary();bindEvents();
}

function renderCart(){
  var items=ESH.cart.get(),h='<div class="glass checkout-panel"><h3>Your cart</h3>';
  for(var i=0;i<items.length;i++){var it=items[i];h+='<div class="flex justify-between items-center" style="padding:0.8rem 0;border-bottom:1px solid var(--border-soft);"><div><div style="font-weight:600;">'+esc(it.title)+'</div><div class="text-muted" style="font-size:0.8rem;">'+(it.type==="digital"?"Digital":"Physical")+" &middot; "+ESH.formatPrice(it.price)+'</div></div><div class="flex items-center gap-1"><input type="number" min="1" value="'+it.qty+'" data-qty="'+it.product_id+'" style="width:60px;text-align:center;padding:0.4rem;"><button class="icon-btn" data-remove="'+it.product_id+'" title="Remove">&times;</button></div></div>';}
  h+='<div class="flex justify-between mt-2"><a href="/products.html" class="btn btn-ghost btn-sm">&larr; Continue shopping</a><button class="btn btn-primary" id="btnNext">Continue</button></div></div>';return h;
}

function renderDetails(){
  var h='<div class="glass checkout-panel"><h3>';
  if(S.needsShipping&&!window.__eshUser)h+='Email & Shipping';
  else if(S.needsShipping)h+='Shipping address';
  else h+='Your email';
  h+='</h3>';
  
  // Email field ALWAYS if not logged in
  if(!window.__eshUser){
    h+='<div class="field"><label>Email * (required)</label><input id="guestEmail" type="email" placeholder="you@email.com" value="'+esc(S.guest_email)+'"></div>';
  }
  
  if(S.needsShipping){
    var s=S.shipping;
    h+='<div class="form-row"><div class="field"><label>Address *</label><input id="line1" value="'+esc(s.line1)+'" placeholder="123 Main St"></div><div class="field"><label>Apt/Suite</label><input id="line2" value="'+esc(s.line2)+'"></div></div>';
    h+='<div class="form-row"><div class="field"><label>City *</label><input id="city" value="'+esc(s.city)+'"></div><div class="field"><label>State</label><input id="state" value="'+esc(s.state)+'"></div></div>';
    h+='<div class="form-row"><div class="field"><label>Postal code *</label><input id="postal_code" value="'+esc(s.postal_code)+'"></div><div class="field"><label>Country</label><input id="country" value="'+esc(s.country)+'"></div></div>';
  }
  
  h+='<div class="flex justify-between mt-2"><button class="btn btn-ghost btn-sm" id="btnBack">&larr; Back</button><button class="btn btn-primary" id="btnNext">Continue to payment</button></div></div>';
  return h;
}

function renderPayment(){
  var available=["paypal_manual","revolut_manual","crypto_manual"];
  var detail="";
  if(S.payment_method==="crypto_manual"){
    detail='<div class="wallet-options">';
    for(var i=0;i<S.wallets.length;i++){var w=S.wallets[i];detail+='<div class="wallet-option '+(S.wallet_id===w.id?"selected":"")+'" data-wallet="'+w.id+'"><div><strong>'+(NET[w.network]||w.network)+'</strong><div class="net">Min. '+ESH.formatPrice(w.min_amount)+'</div></div><span class="badge badge-blue">'+w.network+'</span></div>';}
    detail+='</div>';
  }else if(S.payment_method){detail='<div class="pay-detail">'+(DESC[S.payment_method]||"")+'</div>';}
  var h='<div class="glass checkout-panel"><h3>Payment method</h3><p class="text-muted mb-1" style="font-size:0.85rem;">Manual verification by staff.</p><div class="pay-methods">';
  for(var i=0;i<available.length;i++){var c=available[i];h+='<div class="pay-method '+(S.payment_method===c?"selected":"")+'" data-method="'+c+'">'+(ICONS[c]||"")+'<span>'+(LABELS[c]||c)+'</span>'+(c==="crypto_manual"?"<small>BTC &middot; LTC</small>":"")+'</div>';}
  h+='</div><div id="payDetail">'+detail+'</div><div class="mt-2"><div class="coupon-row"><input id="couponInput" placeholder="Discount code" value="'+esc(S.coupon_code)+'"><button class="btn btn-ghost" id="applyCoupon">Apply</button></div>';
  if(S.couponError)h+='<div class="alert alert-danger mt-1">'+S.couponError+'</div>';if(S.discount>0)h+='<div class="alert alert-success mt-1">Discount: -'+ESH.formatPrice(S.discount)+'</div>';
  h+='</div><div class="flex justify-between mt-3"><button class="btn btn-ghost btn-sm" id="btnBack">&larr; Back</button><button class="btn btn-primary" id="confirmOrder" '+(S.payment_method?"":"disabled")+'>Confirm & pay</button></div></div>';return h;
}

function renderSummary(){
  var items=ESH.cart.get(),sub=ESH.cart.subtotal(),ship=(S.needsShipping&&!S.freeShipping)?6.9:0,tax=+((sub-S.discount)*0.22).toFixed(2),tot=+(sub-S.discount+tax+ship).toFixed(2);
  var h='<div class="glass summary-card"><h3 class="mb-2">Order summary</h3><div class="summary-line-items">';
  for(var i=0;i<items.length;i++)h+='<div class="summary-line-item"><span>'+items[i].qty+"&times; "+esc(items[i].title)+'</span><span>'+ESH.formatPrice(items[i].price*items[i].qty)+'</span></div>';
  h+='</div><div class="summary-item"><span>Subtotal</span><span>'+ESH.formatPrice(sub)+'</span></div>';
  if(S.discount>0)h+='<div class="summary-item"><span>Discount</span><span>-'+ESH.formatPrice(S.discount)+'</span></div>';
  h+='<div class="summary-item"><span>Shipping</span><span>'+(ship?ESH.formatPrice(ship):"Free")+'</span></div><div class="summary-item"><span>VAT (22%)</span><span>'+ESH.formatPrice(tax)+'</span></div><div class="summary-item total"><span>Total</span><span>'+ESH.formatPrice(tot)+'</span></div><div class="trust-row">Secure payment</div></div>';
  document.getElementById("summaryCard").innerHTML=h;
}

function bindEvents(){
  document.querySelectorAll("[data-qty]").forEach(function(el){el.onchange=function(){ESH.cart.updateQty(Number(this.dataset.qty),Number(this.value));S.needsShipping=ESH.cart.hasPhysical();render();};});
  document.querySelectorAll("[data-remove]").forEach(function(el){el.onclick=function(){ESH.cart.remove(Number(this.dataset.remove));S.needsShipping=ESH.cart.hasPhysical();if(ESH.cart.count()===0)return init();render();};});
  var n=document.getElementById("btnNext");if(n)n.onclick=function(){
    var hasDetail=hasDetailStep();
    if(S.step===1&&hasDetail){S.step=2;}
    else if(S.step===2&&hasDetail){
      var emailEl=document.getElementById("guestEmail");if(emailEl)S.guest_email=emailEl.value.trim();
      if(!window.__eshUser&&!S.guest_email){ESH.toast("Email is required.","error");return;}
      if(S.needsShipping){
        S.shipping={line1:val("line1"),line2:val("line2"),city:val("city"),state:val("state"),postal_code:val("postal_code"),country:val("country")};
        if(!S.shipping.line1||!S.shipping.city||!S.shipping.postal_code){ESH.toast("Fill all required fields.","error");return;}
      }
      S.step=3;
    }else if(S.step===1&&!hasDetail){S.step=3;}
    render();
  };
  var b=document.getElementById("btnBack");if(b)b.onclick=function(){S.step=Math.max(1,S.step-1);render();};
  document.querySelectorAll("[data-method]").forEach(function(el){el.onclick=function(){S.payment_method=this.dataset.method;S.wallet_id=null;render();};});
  document.querySelectorAll("[data-wallet]").forEach(function(el){el.onclick=function(){S.wallet_id=Number(this.dataset.wallet);render();};});
  var a=document.getElementById("applyCoupon");if(a)a.onclick=async function(){var c=document.getElementById("couponInput").value.trim();S.coupon_code=c;if(!c){S.discount=0;S.freeShipping=false;S.couponError=null;return render();}var r=await ESH.api("/api/coupons/preview",{method:"POST",body:{code:c,subtotal:ESH.cart.subtotal()}});if(!r.ok){S.discount=0;S.freeShipping=false;S.couponError=r.error;}else{S.discount=r.data.discount;S.freeShipping=r.data.free_shipping;S.couponError=null;}render();};
  var cf=document.getElementById("confirmOrder");if(cf)cf.onclick=submitOrder;
}

function val(id){var el=document.getElementById(id);return el?el.value.trim():"";}

async function submitOrder(){
  if(!window.__eshUser&&!S.guest_email){return ESH.toast("Email is required.","error");}
  if(S.payment_method==="crypto_manual"&&!S.wallet_id){return ESH.toast("Select a cryptocurrency.","error");}
  var btn=document.getElementById("confirmOrder");btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Processing...';
  var r=await ESH.api("/api/checkout",{method:"POST",body:{items:ESH.cart.get().map(function(i){return{product_id:i.product_id,quantity:i.qty};}),payment_method:S.payment_method,wallet_id:S.payment_method==="crypto_manual"?S.wallet_id:null,coupon_code:S.coupon_code||null,guest_email:S.guest_email||undefined,shipping_address:S.needsShipping?S.shipping:undefined}});
  if(!r.ok){ESH.toast(r.error,"error");btn.disabled=false;btn.textContent="Confirm & pay";return;}ESH.cart.clear();
  var o=r.data.order,pi=r.data.payment_instructions,b="";
  if(pi.type==="paypal")b='<div class="glass" style="padding:1.5rem;text-align:left;margin-top:1.5rem;"><strong>PayPal</strong><div style="background:var(--panel);border-radius:10px;padding:1rem;margin-top:0.5rem;"><div>Send <strong>'+ESH.formatPrice(pi.amount)+'</strong> to:</div><code style="color:var(--blue-2);word-break:break-all;">'+esc(pi.email)+'</code><div style="margin-top:0.5rem;font-size:0.85rem;color:var(--muted);">Ref: <strong>'+esc(pi.order_number)+'</strong></div></div></div>';
  else if(pi.type==="revolut")b='<div class="glass" style="padding:1.5rem;text-align:left;margin-top:1.5rem;"><strong>Revolut</strong><div style="background:var(--panel);border-radius:10px;padding:1rem;margin-top:0.5rem;"><div>Pay <strong>'+ESH.formatPrice(pi.amount)+'</strong>:</div><a href="'+esc(pi.link)+'" target="_blank" style="display:inline-block;margin:0.5rem 0;padding:0.6rem 1.2rem;background:var(--blue);color:#fff;border-radius:8px;font-weight:600;">Open Revolut</a><div style="font-size:0.85rem;color:var(--muted);">Ref: <strong>'+esc(pi.order_number)+'</strong></div></div></div>';
  else if(pi.type==="crypto")b='<div class="glass" style="padding:1.5rem;text-align:left;margin-top:1.5rem;"><strong>'+esc(pi.network)+'</strong><div style="background:#0a0c10;border:1px solid var(--border);border-radius:10px;padding:1rem;margin-top:0.5rem;"><div>Send <strong>'+ESH.formatPrice(pi.amount_eur)+'</strong> to:</div><code style="display:block;padding:0.6rem;background:rgba(0,0,0,0.3);border-radius:8px;color:var(--blue-2);word-break:break-all;font-size:0.8rem;margin-top:0.5rem;">'+esc(pi.address)+'</code><div style="margin-top:0.5rem;font-size:0.85rem;color:var(--muted);">Order: <strong>'+esc(pi.order_number)+'</strong></div></div></div>';
  else b='<div class="glass" style="padding:1.5rem;margin-top:1.5rem;text-align:center;">'+esc(pi.note||"")+'</div>';
  document.querySelector(".checkout-steps-wrap").innerHTML="";
  document.getElementById("stepContent").innerHTML='<div class="glass checkout-panel success-screen"><div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg></div><h2>Order received</h2><p style="color:var(--muted);">Order: <strong>'+esc(o.order_number)+'</strong></p><span class="badge badge-warning">Awaiting verification</span>'+b+'<div style="margin-top:1.5rem;display:flex;gap:0.8rem;justify-content:center;"><a href="/dashboard.html" class="btn btn-primary">My orders</a><a href="/products.html" class="btn btn-ghost">Continue shopping</a></div></div>';
  document.getElementById("summaryCard").innerHTML="";
}

function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}
window.addEventListener("DOMContentLoaded",init);
})();
