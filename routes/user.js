const express = require("express");
const csrf = require("csurf");
var passport = require("passport");
var LocalStrategy = require("passport-local").Strategy;
const Product = require("../models/product");
const Order = require("../models/order");
const Cart = require("../models/cart");
const middleware = require("../middleware");
const router = express.Router();
const crypto = require('crypto');
const resetToken = require('../model/resetTokens');
const user = require('../models/user');
const mailer = require('../models/sendMail');
const bcryptjs = require('bcryptjs');
require('../controller/passportLocal')(passport);
require('../controller/googleAuth')(passport);
const userRoutes = require('../controller/accountRoutes');
const googleAuth=require('../controller/googleAuth')
const {
  userSignUpValidationRules,
  userSignInValidationRules,
  validateSignup,
  validateSignin,
} = require("../config/validator");
const csrfProtection = csrf();
router.use(csrfProtection);

// GET: display the signup form with csrf token
router.get("/signup", middleware.isNotLoggedIn, (req, res) => {
  var errorMsg = req.flash("error")[0];
  res.render("user/signup", {
    csrfToken: req.csrfToken(),
    errorMsg,
    pageName: "Sign Up",
  });
});
// POST: handle the signup logic



router.get("/forgot-password", async (req, res) => {
  // render reset password page
  // not checking if user is authenticated
  // so that you can use as an option to change password too
  res.render("user/forgot-password.ejs", { csrfToken: req.csrfToken() });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  // not checking if the field is empty or not
  // check if a user existss with this email
  var userData = await user.findOne({ email: email });
  console.log(userData);
  if (userData) {
    if (userData.provider == "google") {
      // type is for bootstrap alert types
      res.render("user/forgot-password.ejs", {
        csrfToken: req.csrfToken(),
        msg: "User exists with Google account. Try resetting your google account password or logging using it.",
        type: "danger",
      });
    } else {
      // user exists and is not with google
      // generate token
      var token = crypto.randomBytes(32).toString("hex");
      // add that to database
      await resetToken({ token: token, email: email }).save();
      // send an email for verification
      mailer.sendResetEmail(email, token);

      res.render("user/forgot-password.ejs", {
        csrfToken: req.csrfToken(),
        msg: "Reset email sent. Check your email for more info.",
        type: "success",
      });
    }
  } else {
    res.render("user/forgot-password.ejs", {
      csrfToken: req.csrfToken(),
      msg: "No user Exists with this email.",
      type: "danger",
    });
  }
});


router.get("/reset-password", async (req, res) => {
  // do as in user verify , first check for a valid token
  // and if the token is valid send the forgot password page to show the option to change password

  const token = req.query.token;
  if (token) {
    var check = await resetToken.findOne({ token: token });
    if (check) {
      // token verified
      // send forgot-password page with reset to true
      // this will render the form to reset password
      // sending token too to grab email later
      res.render("user/forgot-password.ejs", {
        csrfToken: req.csrfToken(),
        reset: true,
        email: check.email,
      });
    } else {
      res.render("user/forgot-password.ejs", {
        csrfToken: req.csrfToken(),
        msg: "Token Tampered or Expired.",
        type: "danger",
      });
    }
  } else {
    // doesnt have a token
    // I will simply redirect to profile
    res.redirect("user/signin");
  }
});

router.post("/reset-password", async (req, res) => {
  // get passwords
  const { password, password2, email } = req.body;
  console.log(password);
  console.log(password2);
  if (!password || !password2 || password2 != password) {
    res.render("user/forgot-password.ejs", {
      csrfToken: req.csrfToken(),
      reset: true,
      err: "Passwords Don't Match !",
      email: email,
    });
  } else {
    // encrypt the password
    var salt = await bcryptjs.genSalt(12);
    if (salt) {
      var hash = await bcryptjs.hash(password, salt);
      await user.findOneAndUpdate(
        { email: email },
        { $set: { password: hash } }
      );
      res.redirect("signin");
    } else {
      res.render("user/forgot-password.ejs", {
        csrfToken: req.csrfToken(),
        reset: true,
        err: "Unexpected Error Try Again",
        email: email,
      });
    }
  }
});


function checkAuth(req, res, next) {
  if (req.isAuthenticated()) {
      res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, post-check=0, pre-check=0');
      next();
  } else {
      req.flash('error_messages', "Please Login to continue !");
      res.redirect('/signin');
  }
}





router.post(
  "/signup",
  [
    middleware.isNotLoggedIn,
    userSignUpValidationRules(),
    validateSignup,
    passport.authenticate("local.signup", {
      successRedirect: "/",
      failureRedirect: "/signup",
      failureFlash: true,
    }),
  ],
  async (req, res) => {
    try {
      //if there is cart session, save it to the user's cart in db
      if (req.session.cart) {
        const cart = await new Cart(req.session.cart);
        cart.user = req.user._id;
        await cart.save();
      }
      // redirect to the previous URL
      if (req.session.oldUrl) {
        var oldUrl = req.session.oldUrl;
        req.session.oldUrl = null;
        res.redirect(oldUrl);
      } else {
        res.redirect("/");
      }
    } catch (err) {
      console.log(err);
      req.flash("error", err.message);
      return res.redirect("/signup");
    }
  }
);

// GET: display the signin form with csrf token
router.get("/signin", middleware.isNotLoggedIn, async (req, res) => {
  var errorMsg = req.flash("error")[0];
  res.render("user/signin", {
    csrfToken: req.csrfToken(),
    errorMsg,
    pageName: "Sign In",
  });
});

router.post('/signin', (req, res, next) => {
  
  passport.authenticate('local', {
      failureRedirect: 'signin',
      successRedirect: '/home',
      failureFlash: true,
  })(req, res, next);
   
});






router.post(
  "/signin",
  [
    middleware.isNotLoggedIn,
    userSignInValidationRules(),
    validateSignin,
    passport.authenticate("local.signin", {
      failureRedirect: "/user/sign",
      failureFlash: true,
    }),
  ],
  async (req, res) => {
    try {
      // cart logic when the user logs in
      let cart = await Cart.findOne({ user: req.user._id });
      // if there is a cart session and user has no cart, save it to the user's cart in db
      if (req.session.cart && !cart) {
        const cart = await new Cart(req.session.cart);
        cart.user = req.user._id;
        await cart.save();
      }
      // if user has a cart in db, load it to session
      if (cart) {
        req.session.cart = cart;
      }
      // redirect to old URL before signing in
      if (req.session.oldUrl) {
        var oldUrl = req.session.oldUrl;
        req.session.oldUrl = null;
        res.redirect(oldUrl);
      } else {
        res.redirect("/user/profile");
      }
    } catch (err) {
      console.log(err);
      req.flash("error", err.message);
      return res.redirect("/");
    }
  }
);

// GET: display user's profile
router.get("/profile", middleware.isLoggedIn, async (req, res) => {
  const successMsg = req.flash("success")[0];
  const errorMsg = req.flash("error")[0];
  try {
    // find all orders of this user
    allOrders = await Order.find({ user: req.user });
    res.render("user/profile", {
      orders: allOrders,
      errorMsg,
      successMsg,
      pageName: "User Profile",
    });
  } catch (err) {
    console.log(err);
    return res.redirect("/");
  }
});

// GET: logout
router.get("/logout", middleware.isLoggedIn, (req, res) => {
  req.logout();
  req.session.cart = null;
  res.redirect("/");
});

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email',] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/signin' }), (req, res) => {
    res.redirect('/');
});


module.exports = router;
