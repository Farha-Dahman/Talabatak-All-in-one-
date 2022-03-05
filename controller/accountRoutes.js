const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const resetToken = require('../model/resetTokens');
const user = require('../model/user');
const mailer = require('./sendMail');
const bcryptjs = require('bcryptjs');


// adding the checkAuth middleware to make sure that 
// only authenticated users can send emails
router.get('/user/send-verification-email', checkAuth, async (req, res) => {
    // check if user is google or already verified
    if (req.user.isVerified || req.user.provider == 'google') {
        // already verified or google user
        // since we won't show any such option in the UI 
        // most probably this is being called by mistake or can be an attack
        // simply redirect to profile 
        res.redirect('/profile');
    } else {
        // generate a token 
        var token = crypto.randomBytes(32).toString('hex');
        // add that to database
        await resetToken({ token: token, email: req.user.email }).save();
        // send an email for verification
        mailer.sendVerifyEmail(req.user.email, token);
        res.render('profile', { username: req.user.username, verified: req.user.isVerified, emailsent: true });
    }
});


router.get('/user/verifyemail', async (req, res) => {
    // grab the token
    const token = req.query.token;
    // check if token exists 
    // or just send an error
    if (token) {
        var check = await resetToken.findOne({ token: token });
        if (check) {
            // token verified
            // set the property of verified to true for the user
            var userData = await user.findOne({ email: check.email });
            userData.isVerified = true;
            await userData.save();
            // delete the token now itself
            await resetToken.findOneAndDelete({ token: token });
            res.redirect('/profile');
        } else {
            res.render('profile', { username: req.user.username, verified: req.user.isVerified, err: "Invalid token or Token has expired, Try again." });
        }
    } else {
        // doesnt have a token
        // I will simply redirect to profile 
        res.redirect('/profile');
    }
});

module.exports = router;