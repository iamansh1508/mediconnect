// Google OAuth 2.0 strategy using passport-google-oauth20
// Handles authentication with Google accounts

const passport = require('passport');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  try {
    const GoogleStrategy = require('passport-google-oauth20').Strategy;
    const User = require('../../shared/User.model');
    const { generateAccessAndRefreshTokens } = require('./auth.controller');

    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/v1/auth/google/callback',
      passReqToCallback: true,
    }, async (req, accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ provider: 'google', providerId: profile.id });

        if (!user) {
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            user.provider = 'google';
            user.providerId = profile.id;
            user.profileImage = profile.photos[0]?.value || user.profileImage;
            await user.save();
          } else {
            user = await User.create({
              email: profile.emails[0].value,
              name: profile.displayName,
              username: profile.emails[0].value.split('@')[0],
              password: null,
              role: 'patient',
              provider: 'google',
              providerId: profile.id,
              profileImage: profile.photos[0]?.value,
              isEmailVerified: true,
            });
          }
        } else {
          if (profile.photos[0]?.value && user.profileImage !== profile.photos[0]?.value) {
            user.profileImage = profile.photos[0]?.value;
            await user.save();
          }
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }));

    passport.serializeUser((user, done) => {
      done(null, user._id);
    });

    passport.deserializeUser(async (id, done) => {
      try {
        const user = await User.findById(id);
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
  } catch (e) {
    // Swallow strategy registration failures and keep passport usable.
  }
}

module.exports = passport;
