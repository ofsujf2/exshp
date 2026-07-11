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
  paypal_manual: '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARzQklUCAgICHwIZIgAAAcESURBVHic7Z3bdds4EIb/2bPv8VYQpoLVVhC6gngriFJBnAqsrSDeCsxUsHIFpiuwXIGpCiJXMPsAKJZl4jIgLrKM7xyfOCQ9gPgLA2AGBIFKpVKpVCqVSqVSyQvFMMLMMwCfAcwAnOh/3wIrABsAPYBrIlpNNThJEGb+DGABoJlakSNhALAgoh+hBoIEYeYGwBWANrTgI6cH8IWIBukfigVh5hbAf1CuqWJmA+BU6sZEgmgxbiR/U8FfElG8BdFu6g61ZUjZQIky+Fz8m8DwFaoYIZxA3TsvvARh5jlqBz6FlpnPfC70clnM/IA6tJ3KQEQfXBc5W4ie9DUxavTGafS9tOLjsubT61LRON2WjyBvJQySg9Z1we8eRt5Nr4c3a6jwwwYqToS93wFg4zOu18P0Rv93G2Nr9e85P9MuznKdnTozc5y6jHIL4BJAT0SbhOU8Q/vyM/3zZ65yAYCIpgV0OR1dnI84DWaeMXOX8HM+w1Wfki3kj5ytwgUrF9cB+JiyHFcLkczUY3J9SGIAABENRNQC+AbgsVQ9SgkyOZGTCiK6hOr8i4jiM8oqgnYh7/V/GzyfnLqykoP+2f393rdVEtGKVWS7R+YR2UEJwsyXUKngJEFMZh4ALKFcZm+7VotyhszphlIuy8R2vpCKBsA5gBtmfmCVgjaiRfs3YX1eUEqQoVC5uzQAOma+Y2bbl2CBjP3JWxZkywzAne6zXqD7nctclTk0l1WKBmqdgIkuTzWqILvMmHkxdkKnX69zVKKUILEmhfcATnd+vgD4gXCfb+vkD2PulDOew8y90NTCYOeEw+NTozkLZm4D7T3Ddb9LtJB1RFvD2EEi2hDRHKq1SGkNNvsAW2JKCDJYzkkDezZbgBqySimakCshSDRf7DHbHqByLrGIaWuUEoKMduisYkcSfDtu6QAiafjdRQlBesNxqavwbWmvanHfIbmsVIJIuU9k14vcgjxaQuCN0NYwrSpGiibOcgti+1ZLfbdvC4k5ckvev+QWpB87yB4r+kbwWQrktZ52j95gqwmwJSa3IIPheCO0Y3N9u0gFeYRKYI2RZX5yKC4reoeuh9HWBNQIS4vQIa1NTFZBLCsOowrCKuH0XWjzEfaZ/SehvSByCmIbTr63nBvD6K60r7+BXOSF6SknVs/HHMZ8JkaEU9NFLKMdsdEw8wUz/4xZN237IcDmKK77nXPVyTB2kMNGWDcen82XHzoyPAqr1tHEKsxFTpfVG443Geuwzz8OMUL6okkUbyEoE+6+BXDu8VhD9gddswlieSw4pyBrAHOfZBOrbGSWoe4uuVyWLY8gHWFN4T385jBzABfJazNCLkEGy7ncLmtuO8nMFxA8Vx6booIEjrCmYpy96/os8lXlJbkE6Q3HG6kh2gNq6Y+EGZtXKa4QdxGGmNIuS9pCXqRtiagbO+7g3HJuIbQVlSyCRBxhmTpkU4TWhC0utcSRP0GVY4QlXQzdsCFXoqO9UoGjkUOQwXJO2kJGbQX6ftscYyG0FY1iggSOsEZtaTqhrU9seC4kwXoub3IIYvL7sUMSnfD6E9hbidReFEq6rDaire23WrqExzgnCRy9TSa5IJYAXhNgbnCcl3burWlOEmhvMqkFsX1jmwTlhYyObHOSLrAewaQWZLCcC1njZLO3HbJKn3QyzklyPjm1JbUgo+7K4SaMeO7s2QnNNjq6ayKr20otSG84niyoSEQhM21jqF3nTrLFt0o9Y5g6yivtSw6mlbymzWck3/ouwP6FaaIYaC+I1IK0huM95G7Ff7vusC0xGhhGXIGDhSBSCzLqmvQHbOEnyhrq5s4lBRPROfxEWUM9HPoN9paQ5bHo1DvKbQB8MK2X1S5ijqcNKoHnL0kZQl75sFdGo8vY2t9uqtkDWPlu2aQXPUzOsx/Cnou2iddkLH4/djnLCPdi+uq+CHX4yYluGqsNAu5Y7bOVDFYbZUYhRmVi4NoCKaReM213yzym/b1yQtYLjxKjQrGIIgqrVvGVx2/SVYwydDmttheVGBWLyU9m/hpYjxkzf2f3t/WBHTvFWcr4qMt4iPy5f+Gqg88oa4X4uz9v89ZLAOv9ED0zf8TTRpczqBGS9Js/QI2kXpTBKlv5bsduizwL9u6JyFqOjyA9Cu9ucETc6r2BjfhMDA9jn6jjoHdd4CNIN7kalS3OoKfvK48G5F2lfoysiahxXeQby1pMqUkFgD1V/AvJewx71M49FGdnvkX6YskVyr2d5rXyCGAW/cWS2mD2R7yOgFYSsRblQ3Ti5xQFV4e/Ih4hfA8uEJCg0qLMUGjt6yvhFspNiedwQRnDnbfRfEHhJ44OjDWAv4lI5KZ2mZa90vDTW89aqNhQ1jefFeQeT9nNZUiLqFQqlUqlUqlUKpXS/A+sqjmvM0UlDwAAAABJRU5ErkJggg==" style="width:28px;height:28px;">'&#127991;</span>',
  revolut_manual: '<img src="data:image/png;base64,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" style="width:28px;height:28px;">'&#128179;</span>',
  crypto_manual: '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAC91BMVEUAAAD4lBr3lBv3kxr/qiv/v0D3lBv4kxr4kxv/mxv3lBv/lSv4lhz4kxr4lBv3lxv3lRv4kxv4lBr6lhv4lRz3lBv3lyD5lBv4kxv6kx34kxr4lBr3kxv6lBz/nSf4lBr//4D3kxr4lhv4lBr7lB34lBr7lh33lBr4kxr3kxv/nyD4kxv/lyP/lRr3lBv4lBv6lRv3lBv4lBv4lBv4kxr/lCH4lBr4lBr3lBv6lBv/niT3kxr////+/v3+/fz5uWr3lBz3kxv4p0X++vX837z71KT97975sVr3lB3+/v74qUj3mCX83bj4pUD+8+f5sVv3myz7zJP5s175tGD++/b7zZX6wn/97dn97936xIP4ojr3mCT3mSf3liL++vb4pD/5rlX82a/6wn797tv6xof84sH4qUn827L5r1b4pkT7z5r+8uT83LX969b958z++/f+9+/6wn36xIL+9u34ojv6wHr97Nj3njL6xob5s1/3lR73lR/+/fv++fL6x4n83bf95cn4p0b6vHL4pkP7zpf4pkL3min6yIv+/Pn5uWz6w4D95sr6v3n97Nf5tWL4qkz848T84sL+9uz4qkv3nC36xYX95836vnX848P6vXP++fT83rn96dL81qn4oDb96M/7zpj+9ev70qH7z5v3lSD+8+b5uGn6wXv97tz71KX96tL3lyL827P96M771ab5tmX84L/4qUr70qD3njH7z5n4q074q03++PH+8eP6xYT84L798N/++PD6u3D71af96tP70Z784cH5slz969T5t2b706P6w4H3mCb96dH5r1f5rlP5tGH4rFD84L34qEf4oTn6x4r++fP3mir3myv5sl33nS/5um73mSj70Jz3nC77y5L4pUH84cD5sFf7yo7+9Oj3nTD5um3816r95Mf7zJT95Mb+9+783rr82Kz969X4rE/98eH4oDf6x4j4rVH82K398eL7zZb5sVn+9On3liH3njP3lyP82K76vXT837v5uWv+/Pr4qEaA3nGYAAAAO3RSTlMA/uzCBgTGudocqQxJ+9JChPnMOItDIHy7NK/f7TcNiALES/M+1D3piagQlRYdhtlexayrdB91uIVfFSGgzMAAAAaaSURBVHhexdtldxvJEgbgEhriGLKGxI7XsWNI7MQUvm+Zw8zMzMxMy8zMzMzMcJmZmZnvhz2arH16xoq6eiTdef6ARqffOdNdXUWuVBfXj0wf0ZBZ5M/J8RdlNoxIH1lfXE3/Fz0ycgNViKoqkJvRg5IpmJUd7omYeoazs4KUHOfU9IVI35pzKOHyC+pgoK4gnxKpT6EPhnyFfShRKlPgSkolJUJeAK4F8iheaUMQlyFpFI/Q0P6IU/+hIXKtvAIJUFFO7oRKfEgIX0mIXBhcioQpdZGEMj8SyF9GZvoN8CGhfAP6kYHgQCTcwCCJndsbSdD7XBIa1AtJ0eszJDIsFUmSOkz0/1ORNKmDBOvfC0nUS5uDYG8kVe+g5v0fiCQb2I9iGYCkG0AxlPlgZvKT110xHkZ8ZTG+P36YOTSbmTu+t386DPgH01mESmHoc3zGj2CiNETRlcDUl9jyICLWv7X6uYOQKKGoyn0wdSNb3kPEHGZeuub37dDylVMUoQrAPAKW+xFxPVs2Qq8i2iIMB9xG4BkAWHSYLbMgMJy6SesPPccSH2XLfESMY0vT+RDon0ZOjRCY8+Jtr92OLlexZQwifsaWNyDSSA55kLiDmdl6CDUCLdIIqPLILgCBSc38qU1jLrodv+Ez9kkjoAqQTSUkprHqvsvYMhYRf2HLhK9AqJJUKZCYw9GsQMQMtrwDqRRS9IHIYxzVXZvnrh2/lS33QEytHxRCHoHoOprY8lmIFVKXfB8kFu+cvItjk0cA8OVTpwKITVm5l2M4/PRaiBVQp1SYePdCjuWyG+6FTF1X/Q1mVnJsUy8WPkJnNa8GZqazzvyPIFFDlmBfmDnEeo8fgl7fIEVkwdDzrHj2qbmb7+Lujn8VelkUkQ1D+1kxDgA2rL6enfYuglY2RYRh6En1vZsEC5ZtPMJ2x6AVturvPWFm/M3chR9Dl2+/PoFtTkKnZw8iyoChK1gxB4rvL2XV2FboZBBRLgxdx4ppUH3cwarLoZNLRIF4ItA8CTY7WHWnaFtSFU8E7oDdEtsi/BQ6VUTVMHSNPQIOx1nxCrSqqRiGXmLF23B4mRVboFVMo2BI/YnmD+AwjxVboVVPtYmMAPY1sWIdtGopHWYmqj/xZzjMYNVOaKVTSjwRaIHdrP+y6guSvXHYOAKqeW8+8XV0emTGBFatgl6YMo0j4DT133e+33L/TQtGb2O7S6GXSUUw8hSLrRoPvSLyw8gCllp6CgJ+yoGRz7PQ1OcgkWP4AK1fZpkbr4XwAfzuI7CrmaObvWJaG2T8VOQ+Al9btPyCNR3c3dFWSBUZvoajuQs3LQaAg8tPr2KnX5+AUCY1GEVA3Xh+iE4T737BuQgXQaaBRsDAWlacVjciq53pvAEiIyjddQRmQnXtGLZpHgeJdKqNKwKqFvuXaNMSCIykercRuBVOLWyzHwL1RluyiZot7wpWzYNAsdGmdCcrDqCb/7HNF6FXTVTl7kTQ9E10t51V06BVJTqYLNxyz4HFAMZNcEbA6UFWfQNaAdHR7FvM3HzrutHNrHgWUbzAqpuglSs5nE6K+gWche52s+kSZOiP5+p5TxeB77DNdwXHc0GBom0sR/Ewulu2jVU3H4ROWFKiOcDRHL7kB8uXwGbiD9nmFmhlS4pUV/HZXHjJxh9PuReW8y//SRPb7YFWlqBMN4U1rn54zc+3zmtip23TBWU6QaGyrX3l5O3swt3QqpGWatvadxz7BZtpWigv1VIdBDbM/eURlvsVtOqMy/Wt14xmobGLTcr1+T4I3cIyszcYXVhQIWTaXmXLQ4//lmM5MhN6hYaXVuoHfyHwu5OP8tls2W16aSUtU1zMlvsQ8QeObtOCR4yv7ajSKAJ/RMQFbPnTA09f+Vf+VPPe255odXNxSQFZBNQP/ZXK1fXf/t6+fub650/9A1IBN5fXJ7oi4Ly6NpdHDkOgN1eNgNq9YG6IqwaGyWz5p9rAMh8a0gYGGqqPwHa2/EttYBkDN4a6amJp5zN2xx2BipC7Np7zHti8i3mqLQL7YM5XHkcj03l7dsQdgZI4W7nUCDwEc6WhRDSzLdvz6NXM/B8Y8w9OWDvflEvXPQNTvjKvGxo9b+n0uqnV67ZerxubvW7t9ri5fZDX7f1eDzh4PeLh8ZCLx2M+g70edPJ61Mu10PD4h92GhygeaY2IS2OaxwOPHo98ejz0muCx31QYSC3I93bw2ePRb8+H35OvunhUbXpKuHP8P5ySXjvK5fj/J86IE8PpwyWFAAAAAElFTkSuQmCC" style="width:28px;height:28px;">'&#8383;</span>'
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
