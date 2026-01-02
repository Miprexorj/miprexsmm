const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");
const app = express();
app.use(express.json());
app.use((req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","*");
  if(req.method==="OPTIONS") return res.sendStatus(200);
  next();
});

const usersFile = "users.json";
const ordersFile = "orders.json";

if(!fs.existsSync(usersFile)){
  fs.writeFileSync(usersFile, JSON.stringify({ admin:{ pass:"123456", balance:0, role:"admin" } }, null, 2));
}
if(!fs.existsSync(ordersFile)){
  fs.writeFileSync(ordersFile, JSON.stringify([], null, 2));
}

function readUsers(){ return JSON.parse(fs.readFileSync(usersFile)); }
function writeUsers(data){ fs.writeFileSync(usersFile, JSON.stringify(data,null,2)); }
function readOrders(){ return JSON.parse(fs.readFileSync(ordersFile)); }
function writeOrders(data){ fs.writeFileSync(ordersFile, JSON.stringify(data,null,2)); }

// REGISTER
app.post("/register",(req,res)=>{
  const { u,p } = req.body;
  let users = readUsers();
  if(!u||!p) return res.json({ ok:false, msg:"Eksik bilgi" });
  if(users[u]) return res.json({ ok:false, msg:"Kullanıcı zaten var" });
  users[u] = { pass:p, balance:0, role:"user" };
  writeUsers(users);
  res.json({ ok:true, msg:"Kayıt başarılı" });
});

// LOGIN
app.post("/login",(req,res)=>{
  const { u,p } = req.body;
  let users = readUsers();
  if(!users[u]||users[u].pass!==p) return res.json({ ok:false });
  res.json({ ok:true, role:users[u].role, balance:users[u].balance });
});

// CHANGE PASSWORD
app.post("/changepass", (req, res) => {
  const { username, oldPass, newPass } = req.body;
  let users = readUsers();
  if(!users[username]) return res.json({ ok:false, msg:"Kullanıcı yok" });
  if(users[username].pass !== oldPass) return res.json({ ok:false, msg:"Eski şifre yanlış" });
  users[username].pass = newPass;
  writeUsers(users);
  res.json({ ok:true, msg:"Şifre başarıyla değiştirildi" });
});

// CREATE ORDER
app.post("/order", async (req,res)=>{
  const { username, service, link, quantity } = req.body;
  let users = readUsers();
  if(!users[username]) return res.json({ ok:false, msg:"Kullanıcı yok" });

  // Fiyat ve provider maliyeti TL
  let userPriceTL=0, providerPriceTL=0;
  if(service==101){ userPriceTL=20*(quantity/1000); providerPriceTL=5*(quantity/1000); }
  else if(service==102){ userPriceTL=100*(quantity/1000); providerPriceTL=30*(quantity/1000); }
  else if(service==103){ userPriceTL=30*(quantity/1000); providerPriceTL=15*(quantity/1000); }

  const profitTL = userPriceTL - providerPriceTL;

  // Sipariş kaydı öncesi provider çağrısı
  try {
    const response = await fetch("https://speedsmm.in/api/v2", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: "820cf40410ddfa6c07e865b26d41dd1d", // provider API key
        action: "add",
        service: service,
        link: link,
        quantity: quantity
      })
    });

    const data = await response.json();

    // Önemli: provider onay verirse kar ekle
    if(data.status && data.status.toLowerCase() === "success"){
      users[username].balance += profitTL;
      writeUsers(users);

      // Siparişi orders.json kaydet
      let orders = readOrders();
      orders.push({ username, service, link, quantity, profitTL, providerOrderId: data.order || null });
      writeOrders(orders);

      res.json({ ok:true, provider:data, userPriceTL, profitTL });
    } else {
      res.json({ ok:false, msg:"Provider siparişi onaylamadı", provider:data });
    }

  } catch(err){
    res.status(500).json({ ok:false, error:err.message });
  }
});

// ADMIN ENDPOINTS
app.get("/admin/users",(req,res)=>res.json(readUsers()));
app.get("/admin/orders",(req,res)=>res.json(readOrders()));

app.get("/",(req,res)=>res.send("SMM PANEL AKTİF 🚀"));
app.listen(process.env.PORT||3000,()=>console.log("Server çalışıyor"));
