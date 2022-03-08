const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const resetToken = require('../model/resetTokens');
const user = require('../model/user');
const mailer = require('./sendMail');
const bcryptjs = require('bcryptjs');

router.get('/user/forgot-password', async (req, res) => {
    // render reset password page 
    // not checking if user is authenticated 
    // so that you can use as an option to change password too
    res.render('forgot-password.ejs', { csrfToken: req.csrfToken() });

});

router.post('/user/forgot-password', async (req, res) => {
    const { email } = req.body;
    // not checking if the field is empty or not 
    // check if a user existss with this email
    var userData = await user.findOne({ email: email });
    console.log(userData);
    if (userData) {
        if (userData.provider == 'google') {
            // type is for bootstrap alert types
            res.render('forgot-password.ejs', { csrfToken: req.csrfToken(), msg: "User exists with Google account. Try resetting your google account password or logging using it.", type: 'danger' });
        } else {
            // user exists and is not with google
            // generate token
            var token = crypto.randomBytes(32).toString('hex');
            // add that to database
            await resetToken({ token: token, email: email }).save();
            // send an email for verification
            mailer.sendResetEmail(email, token);

            res.render('forgot-password.ejs', { csrfToken: req.csrfToken(), msg: "Reset email sent. Check your email for more info.", type: 'success' });
        }
    } else {
        res.render('forgot-password.ejs', { csrfToken: req.csrfToken(), msg: "No user Exists with this email.", type: 'danger' });

    }
});

router.get('/user/reset-password', async (req, res) => {
    //  check for a valid token 
   
    const token = req.query.token;
    if (token) {
        var check = await resetToken.findOne({ token: token });
        if (check) {
            // token verified
            // send forgot-password page with reset to true
            res.render('forgot-password.ejs', { csrfToken: req.csrfToken(), reset: true, email: check.email });
        } else {
            res.render('forgot-password.ejs', { csrfToken: req.csrfToken(), msg: "Token Tampered or Expired.", type: 'danger' });
        }
    } else {
        // doesnt have a token
        //redirect to login
        res.redirect('/login');
    }

});


router.post('/user/reset-password', async (req, res) => {
    // get passwords
    const { password, password2, email } = req.body;
    console.log(password);
    console.log(password2);
    if (!password || !password2 || (password2 != password) ){
        res.render('forgot-password.ejs', { csrfToken: req.csrfToken(), reset: true, err: "Passwords Don't Match the password should be more than 12 charachter containing also at least 1 nonalphapatical charachter  !", email: email });
   }  else {
        // encrypt the password
        var salt = await bcryptjs.genSalt(12);
        if (salt) {
            var hash = await bcryptjs.hash(password, salt);
            await user.findOneAndUpdate({ email: email }, { $set: { password: hash } });
            res.redirect('/login');
        } else {
            res.render('forgot-password.ejs', { csrfToken: req.csrfToken(), reset: true, err: "Unexpected Error Try Again", email: email });

        }
    }
});


module.exports = router;