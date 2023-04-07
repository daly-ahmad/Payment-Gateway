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

//API Testing currency exchange


//set name into session post login
app.use(function(req, res, next) {
  if (req.user){
    res.locals.username = req.user;
    console.log(req.user.name);
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
      'X-RapidAPI-Key': 'b153ec2390mshd951f51c0f4316cp1055d0jsn0901c8c5965e',
      'X-RapidAPI-Host': 'exchangerate-api.p.rapidapi.com'
    }
  };
  
  axios.request(options).then(function (response) {
    console.log(response.data.rates.USD);
    const usd = response.data.rates.USD;
    const twd = response.data.rates.TWD;
    const myr = response.data.rates.MYR;
    console.log("User is " + req.user.name)
    res.render("index.ejs", {usd, twd, myr})
  }).catch(function (error) {
    console.error(error);
  });
})

app.post("/", requireLogin, (req, res) => {
  const options = {
    method: 'GET',
    url: 'https://exchangerate-api.p.rapidapi.com/rapid/latest/BND',
    headers: {
      'X-RapidAPI-Key': 'b153ec2390mshd951f51c0f4316cp1055d0jsn0901c8c5965e',
      'X-RapidAPI-Host': 'exchangerate-api.p.rapidapi.com'
    }
  };
  
  axios.request(options).then(function (response) {
    console.log(response.data.rates.USD);
    const usd = response.data.rates.USD;
    const twd = response.data.rates.TWD;
    const myr = response.data.rates.MYR;
    
    res.render("index.ejs", {usd, twd, myr})
  }).catch(function (error) {
    console.error(error);
  });
  
})


app.post("/payment", async (req, res) => {
  const { 
    order_id, 
    finalAmount, 
  } = req.body;
  const user = req.user.name;
  const email = req.user.email;
  const phone = req.user.phone;
  const merchant_id = req.user.merchant_id;
  console.log("User is " + user)
  try {
    let transaction = new Transaction({ 
      name : user, 
      email : email, 
      phone: phone,
      merchant_id: merchant_id,
      order_id,
      amount : finalAmount,
     });
    await transaction.save();
  } catch (error) {
    console.log(error);
  }

  var options = {
    method: 'POST',
    url: 'https://pay.beep.solutions/generateorder',
    headers: {
    },
    data: {
      user: process.env.API_USER,
      apiToken: process.env.API_TOKEN,
      returnUrl: '',
      action: '',
      order_id: order_id,
      order_amount: finalAmount,
      callbackUrl: ''
    }
  };

  axios.request(options).then(function (response) {
    console.log(response.data.result.Token);
    var orderToken = response.data.result.Token;
    res.redirect("https://pay.beep.solutions/order?Token=" + orderToken);
  }).catch(function (error) {
    console.error(error);
  });
})

app.get("/register", requireAdmin, (req, res) => {
    res.render("register.ejs")
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
