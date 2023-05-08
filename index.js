const express = require("express")
const passport = require("passport");
const initializePassport = require("./passport");
const session = require("express-session");
const flash = require("express-flash");
const override = require("method-override");
const MongoStore = require("connect-mongo");
const axios = require("axios");

initializePassport(passport);
const app = express()


const mongoose = require("mongoose");
require("dotenv").config();

const bcrypt = require("bcryptjs");

//models
const User = require("./models/user");
const Transaction = require("./models/transaction");
const Pocket_Transaction = require("./models/pocket_transaction");

app.set("view-engine", "ejs")
app.use(express.urlencoded({ extended: false }))

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("mongoDB is connected"))
  .catch((e) => console.log(e.message));


app.use(flash());
app.use(
  session({
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      //ttl: 365 * 24 * 60 * 60, // = 365 days.
    }),
    secret: process.env.SECRET,
    resave: false, // if nothing is changed dont resave
    saveUninitialized: false, // dont save empty value in session
    //proxy: true,
    cookie: { secure: false }
  })
);
app.use(passport.initialize());
app.use(passport.session());

//using files in public folder
app.use(express.static(__dirname + '/public'));

//set name into session post login
app.use(function(req, res, next) {
  if (req.user){
    res.locals.username = req.user;
  }
  else{
    console.log("Not logged in")
  }
  next(); 
});

function requireAdmin(req, res, next) {
  if (req.isAuthenticated()) {
    if (typeof req.user == "undefined") {
      console.log("typeof error" + req.user.name);
    } 
    else {
      if (req.user.priv == "admin") {
        console.log("you are admin")
        return next();
      }
      else {
        console.log("not admin")
      }
    }
}
  res.redirect("/");
}   

function requireLogin(req, res, next) {
      if (req.isAuthenticated()) {
        return next();
      }
      res.redirect("/login");
}   

function requireLogout(req, res, next) {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
}  

app.use(override("_method"));




app.get("/", requireLogin, (req, res) => {
  const options = {
    method: 'GET',
    url: 'https://exchangerate-api.p.rapidapi.com/rapid/latest/BND',
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY_XCHANGE,
      'X-RapidAPI-Host': 'exchangerate-api.p.rapidapi.com'
    }
  };
  
  axios.request(options).then(function (response) {
    const usd = response.data.rates.USD;
    const twd = response.data.rates.TWD;
    const myr = response.data.rates.MYR;
    res.render("index.ejs", {usd, twd, myr})
  }).catch(function (error) {
    console.error(error);
  });
})

//pocketAPI
app.post("/pocketpayment", async (req, res) => {
  const { 
    name,
    telephone,
    amount,
    currency,
  } = req.body;
  const poc_trans = await Pocket_Transaction.find({});
  var order_id;
  if(poc_trans.length){
    order_id = poc_trans.length +1;
  }
  else {
    order_id = 1;
  }
  //const order_id = poc_trans.length +1;
  //const order_id = poc_trans.length;
  const initialAmount = req.body.finalAmount //convert to cent
  const finalAmount = (Number(req.body.finalAmount) + Number(req.body.finalAmount  * 0.03))*100; //convert to cent
  const finalfinalAmount = parseFloat(finalAmount).toFixed(2);
  const user = req.user.name;
  const email = req.user.email;
  const phone = req.user.phone;
  const merchant_id = req.user.merchant_id;
  //const order_id_status = 0;

  var pocket_hashed_data;
  let current_date = new Date();
  let day = ("0" + current_date.getDate()).slice(-2);
  let month = ("0" + (current_date.getMonth() + 1)).slice(-2);
  let year = current_date.getFullYear();
  let hours = current_date.getHours();
  let minutes = current_date.getMinutes();

  var order_info = day + "/" + month + "/" + year + ", " + hours + ":" + minutes;
  var return_url = "https://gorush-payment-gateway.herokuapp.com/status/:" + order_id;


  var pocket_get_hash = {
    method: 'POST',
    url: 'https://pay.threeg.asia/payments/hash',
    headers: {
    },
    data: {
      api_key: process.env.POCKET_KEY,
      salt : process.env.POCKET_SALT,
      "order_id" : order_id,
      "order_desc" : "Description",
      "order_info" : order_info,
      "subamount_1" : finalfinalAmount,
      "subamount_1_label" : "Order Total (BND)",
      "subamount_2" : "0",
      "subamount_3" : "0",
      "subamount_4" : "0",
      "subamount_5" : "0",
      "discount" : "0",
      "return_url" : return_url
    }
  };

  
  
  await axios.request(pocket_get_hash).then(function (response) {
    console.log("My hashed data is " + response.data.hashed_data);
    console.log("Poc trans length is " + order_id);
    pocket_hashed_data = response.data.hashed_data;
    return pocket_hashed_data;
  })
  .catch(function (error) {
    console.error(error);
  });

  function set_order_id() {
    var order_id;
    if(poc_trans.length){
      order_id = poc_trans.length +1;
    }
    else {
      order_id = 1;
    }
  }

  function submit_payment() {
    set_order_id();
    console.log("Most likely because Hashed Data is " + pocket_hashed_data + " and order_id is " + order_id);

    var options2 = {
      method: 'POST',
      url: 'https://pay.threeg.asia/payments/create',
      headers: {
      },
      data: {
        "api_key": process.env.POCKET_KEY,
        "salt" : process.env.POCKET_SALT,
        "hashed_data": pocket_hashed_data,
        "order_id" : order_id,
        "order_desc" : "Description",
        "order_info" : order_info,
        "subamount_1" : finalfinalAmount,
        "subamount_1_label" : "Order Total (BND)",
        "subamount_2" : "0",
        "subamount_3" : "0",
        "subamount_4" : "0",
        "subamount_5" : "0",
        "discount" : "0",
        "return_url" : return_url
        
      }
    };

    axios.request(options2).then(function (response) {
      if(response.data.payment_url === "undefined"){
        console.log("Message is " + response.data.message);
        console.log("Most likely because Hashed Data is " + pocket_hashed_data);
  
        res.redirect("index.ejs");
      }
      else{
        console.log("Payment_url is " + response.data.payment_url);
        console.log("Success_indicator is " + response.data.success_indicator);
        console.log("Order_ref is " + response.data.order_ref);
        console.log("Order_info is " + order_info);
        console.log("Hashed Data is still " + pocket_hashed_data);
  
        let pocket_transaction = new Pocket_Transaction({ 
          name : name, 
          email : email, 
          phone: telephone,
          merchant_id: merchant_id,
          order_id : order_id,
          amount : amount,
          currency : currency,
          amount_bnd : initialAmount,
          order_info : order_info,
          transaction_hashed_data : pocket_hashed_data,
          order_id_status: "0"
         });

        pocket_transaction.save();
        res.redirect(response.data.payment_url);
      }
    }).catch(function (error) {
      console.error(error);
    });
  }
  //4388 0812 3456 7890
  //EXP : 12/25
  //CVV : 321
  function get_hash() {
    axios.request(pocket_get_hash).then(function (response) {
      console.log("My hashed data is " + response.data.hashed_data);
      pocket_hashed_data = response.data.hashed_data;
      return pocket_hashed_data;

      
    })
    
    submit_payment();
  }
  //get_hash();
  submit_payment();
  
})

app.get("/register", requireAdmin, (req, res) => {
    res.render("register.ejs")
})

app.get("/status/:order_id", requireAdmin, async (req, res) => {
  var status_result;
  var method;
  var final_amount;
  var order_id = req.params.order_id;
  var neworder_id = order_id.replace(':', '');
  
  var check_status = {
    method: 'POST',
    url: 'https://pay.threeg.asia/payments/status',
    headers: {
    },
    data: {
      "api_key": process.env.POCKET_KEY,
      "salt" : process.env.POCKET_SALT,
      "order_id" : neworder_id,
    }
  };

  await axios.request(check_status).then(function (response) {
    method = response.data.method;
    final_amount = response.data.final_amount;
    
    if(response.data.status_id == 0) {
      status_result = "Pending";
      console.log("Status_id of order " + neworder_id + " is " + response.data.status_id + "/" + status_result + " @ BND " + response.data.final_amount);
    }
    else if (response.data.status_id == 1) {
      status_result = "Paid";
      console.log("Status_id of order " + neworder_id + " is " + response.data.status_id + "/" + status_result);
    }
    else if (response.data.status_id == 2) {
      status_result = "Refunded";
      console.log("Status_id of order " + neworder_id + " is " + response.data.status_id + "/" + status_result);
    }
    else {
      status_result = "???";
      console.log("Status_id of order " + neworder_id + " is " + response.data.status_id + "/" + status_result);
    }
  })

  res.render("status.ejs", {status_result:status_result, order_id:neworder_id, method:method, final_amount:final_amount})
})


app.post("/register", async (req, res) => {
    const { 
      name, 
      email, 
      password, 
      phone,
      priv,
      merchant_id,
    } = req.body;
    try {
      let user = await User.findOne({ email: req.body.email });
      if (user) {
        return res.status(400).json({ error: "Email already used" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({ 
        name, 
        email, 
        password: hashedPassword,
        phone,
        priv,
        merchant_id,
       });
      await user.save();
      res.redirect("/login");
    } catch (error) {
      console.log(error);
    }
});

app.get("/login", requireLogout, (req, res) => {
    res.render("login.ejs")
})

app.post("/login",
    passport.authenticate("local", {
      successRedirect: "/",
      failureRedirect: "/login",
      failureFlash: true,
    }),
);

//edit profile
app.get("/edit", requireAdmin, async (req, res) => {
  const user = await User.find({});
  res.render("edit.ejs", { user: user })
  
})

app.post("/edit/:_id", async (req, res) => {
  const { _id, name, email, password, priv } = req.body;
  

    await User.updateMany({ 
      _id:_id
      },
      {
      $set: {
        name:name,
        email:email,
        priv:priv,
      },
      },
      {
        new: true,
      }
    )
    console.log("redirecting from updating user")
    res.redirect("/edit");
});

app.post("/delete/:_id", async (req, res) => {
  const { _id, name, email, password, priv } = req.body;
  

    await User.findOneAndDelete({ 
      _id:_id
      },
    )
    console.log("redirecting from deleting user")
    res.redirect("/edit");
});

app.get("/transaction", requireAdmin, async (req, res) => {
  const pocket_transaction = await Pocket_Transaction.find({});
  var newstatus= [];
  
  for (var i = 0; i < pocket_transaction.length; i++){
    var order_id = pocket_transaction[i].order_id;
    var check_status = {
    
      method: 'POST',
      url: 'https://pay.threeg.asia/payments/status',
      headers: {
      },
      data: {
        "api_key": process.env.POCKET_KEY,
        "salt" : process.env.POCKET_SALT,
        "order_id" : order_id,
      }
    }

    await axios.request(check_status).then(function (response) {
      console.log("At i = " + i + ", order_id = " + order_id + ", status id = " + response.data.status_id + ", order status id = " + pocket_transaction[i].order_id_status);
      newstatus[i] = response.data.status_id;
      Pocket_Transaction.updateMany({ 
        order_id:order_id,
        },
        {
        $set: {
          order_id_status:newstatus
        },
        },
        {
          upsert: true, new: true,
        }
      )
    })
  }
  res.render("transaction.ejs", {pocket_transaction: pocket_transaction, newstatus: newstatus})
  
})

//post one
// app.post("/transaction", requireLogin, async (req, res) => {
//   const pocket_transaction = await Pocket_Transaction.find({});

//   var newstatus = [];

//   for (var i = 0; i < pocket_transaction.length; i++){
//     var order_id = pocket_transaction[i].order_id;
//     var check_status = {
    
//       method: 'POST',
//       url: 'https://pay.threeg.asia/payments/status',
//       headers: {
//       },
//       data: {
//         "api_key": process.env.POCKET_KEY,
//         "salt" : process.env.POCKET_SALT,
//         "order_id" : order_id,
//       }
//     }

//     await axios.request(check_status).then(function (response) {
//       console.log("At i = " + i + ", order_id = " + order_id + ", status id = " + response.data.status_id + ", order id status = " + pocket_transaction[i].order_id_status);
//       newstatus[i] = response.data.status_id;
//       Pocket_Transaction.updateOne({ 
//         order_id:order_id,
//         },
//         {
//         $set: {
//           order_id_status:response.data.status_id
//         },
//         },
//         {
//           upsert: true
//         }
//       )
//     })
//   }
//   res.render("transaction.ejs", {pocket_transaction: pocket_transaction, newstatus: newstatus})
  
// })

//unfinished pages
app.get("/wip", requireLogin, (req, res) => {
  res.render("wip.ejs")
})

//logging out
app.delete("/logout", (req, res) => {
  req.logout(function(err) {
    if (err) { 
      return next(err); 
    };})
  res.redirect("/login");
});


app.listen(3000, () => console.log("Server is running"));

//
